// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title IDIATokenBeta
 * @author IDIA Data Inc.
 * @notice Non-transferable receipt token issued for ACA (Auditable Consent Artifact)
 *         contributions during beta. Mints record on-chain provenance of data sales;
 *         burns record redemptions. Tokens themselves cannot be transferred between
 *         users — they are records, not currency.
 *
 * @dev Uses OpenZeppelin's Ownable, Pausable, ReentrancyGuard for safety.
 *      Designed to be deployed by an admin wallet (which becomes owner) and grant
 *      authorized minter rights to backend treasury wallets.
 *
 *      Out of scope (intentionally): ERC-20 transfer/transferFrom/approve/allowance.
 *      This is NOT an ERC-20 token. It does not satisfy IERC20. Wallets and exchanges
 *      should not display this as a tradable asset.
 */
contract IDIATokenBeta is Ownable, Pausable, ReentrancyGuard {
    // ─── Token metadata ─────────────────────────────────────────────────

    string public constant name = "IDIA Token Beta";
    string public constant symbol = "IDIA-B";
    uint8 public constant decimals = 18;

    // ─── Operational toggles ─────────────────────────────────────────────

    /// @notice Owner can pause/unpause minting independently of burning
    bool public mintingEnabled = true;

    /// @notice Owner can pause/unpause burning independently of minting
    bool public burningEnabled = true;

    // ─── Authorization ────────────────────────────────────────────────────

    /// @notice Addresses authorized to mint on behalf of users (treasury wallets)
    mapping(address => bool) public authorizedMinters;

    // ─── Balances ─────────────────────────────────────────────────────────

    /// @notice Token balance per holder
    mapping(address => uint256) public balanceOf;

    /// @notice Total tokens currently in circulation
    uint256 public totalSupply;

    // ─── Holder tracking (for unique address enumeration) ────────────────

    /// @notice All unique addresses that have ever held tokens
    address[] private _allHolders;

    /// @notice Tracks whether an address is in `_allHolders` to prevent duplicates
    mapping(address => bool) private _isKnownHolder;

    // ─── Provenance ledger: mint receipts ────────────────────────────────

    struct MintRecord {
        address recipient;
        bytes32 acaHash;
        uint256 amount;
        uint256 timestamp;
        address minter;
    }

    /// @notice Sequential mint records, indexed by mint ID (starts at 1)
    mapping(uint256 => MintRecord) public mintRecords;

    /// @notice ID of the next mint to be recorded; current count is mintCount
    uint256 public mintCount;

    /// @notice Lookup: given an ACA hash, find the mint ID(s) that referenced it
    mapping(bytes32 => uint256[]) public mintsByAca;

    // ─── Provenance ledger: burn receipts ────────────────────────────────

    struct BurnRecord {
        address from;
        bytes32 acaHash; // Optional: 0x0 if burn isn't tied to a specific ACA
        uint256 amount;
        uint256 timestamp;
        string reason; // Optional human-readable reason (e.g., "redeemed for USDC")
    }

    /// @notice Sequential burn records, indexed by burn ID (starts at 1)
    mapping(uint256 => BurnRecord) public burnRecords;

    /// @notice ID of the next burn to be recorded; current count is burnCount
    uint256 public burnCount;

    /// @notice Lookup: per-holder list of their burn record IDs
    mapping(address => uint256[]) public burnsByAddress;

    // ─── Events ───────────────────────────────────────────────────────────

    event ACAMinted(
        address indexed recipient,
        bytes32 indexed acaHash,
        uint256 amount,
        uint256 indexed mintId,
        uint256 timestamp,
        address minter
    );

    event ACABurned(
        address indexed from,
        bytes32 indexed acaHash,
        uint256 amount,
        uint256 indexed burnId,
        uint256 timestamp,
        string reason
    );

    event MinterAuthorized(address indexed minter, address indexed authorizedBy);
    event MinterRevoked(address indexed minter, address indexed revokedBy);
    event MintingToggled(bool enabled, address indexed by);
    event BurningToggled(bool enabled, address indexed by);
    event TransferAttempted(address indexed from, address indexed to); // Diagnostic log

    // ─── Errors (cheaper than require strings on EVM ≥ 0.8.4) ────────────

    error MintingDisabled();
    error BurningDisabled();
    error NotAuthorizedMinter();
    error InvalidRecipient();
    error InvalidAmount();
    error InsufficientBalance(uint256 available, uint256 requested);
    error TransfersNotAllowed();
    error NativeFundsNotAccepted();
    error ERC20TokensNotAccepted();

    // ─── Modifiers ────────────────────────────────────────────────────────

    modifier onlyAuthorizedMinter() {
        if (!authorizedMinters[msg.sender] && msg.sender != owner()) revert NotAuthorizedMinter();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────

    /// @notice Deployer becomes owner and is auto-authorized as a minter
    constructor() Ownable(msg.sender) {
        authorizedMinters[msg.sender] = true;
        emit MinterAuthorized(msg.sender, msg.sender);
    }

    // ─── Admin: Operational toggles ──────────────────────────────────────

    function setMintingEnabled(bool enabled) external onlyOwner {
        mintingEnabled = enabled;
        emit MintingToggled(enabled, msg.sender);
    }

    function setBurningEnabled(bool enabled) external onlyOwner {
        burningEnabled = enabled;
        emit BurningToggled(enabled, msg.sender);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ─── Admin: Minter authorization ─────────────────────────────────────

    function authorizeMinter(address minter) external onlyOwner {
        if (minter == address(0)) revert InvalidRecipient();
        authorizedMinters[minter] = true;
        emit MinterAuthorized(minter, msg.sender);
    }

    function revokeMinter(address minter) external onlyOwner {
        authorizedMinters[minter] = false;
        emit MinterRevoked(minter, msg.sender);
    }

    // ─── Mint ─────────────────────────────────────────────────────────────

    /**
     * @notice Mint tokens to a recipient as a receipt for an ACA contribution.
     * @param recipient The user wallet receiving the receipt token
     * @param acaHash The cryptographic hash of the ACA being recorded
     * @param amount Token amount (in smallest units, i.e. wei)
     * @return mintId The sequential ID assigned to this mint record
     *
     * Reentrancy: Protected via `nonReentrant`. State changes are completed
     * before the event emission per checks-effects-interactions.
     */
    function mintForACA(
        address recipient,
        bytes32 acaHash,
        uint256 amount
    )
        external
        whenNotPaused
        nonReentrant
        onlyAuthorizedMinter
        returns (uint256 mintId)
    {
        if (!mintingEnabled) revert MintingDisabled();
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();

        // Track unique holders
        if (!_isKnownHolder[recipient]) {
            _isKnownHolder[recipient] = true;
            _allHolders.push(recipient);
        }

        // Effects (mutate state before emitting events)
        balanceOf[recipient] += amount;
        totalSupply += amount;
        mintCount += 1;
        mintId = mintCount;

        mintRecords[mintId] = MintRecord({
            recipient: recipient,
            acaHash: acaHash,
            amount: amount,
            timestamp: block.timestamp,
            minter: msg.sender
        });
        mintsByAca[acaHash].push(mintId);

        emit ACAMinted(recipient, acaHash, amount, mintId, block.timestamp, msg.sender);
    }

    /**
     * @notice Batch mint for gas efficiency when processing many receipts at once.
     * @dev All arrays must be the same length. Reverts if any single mint fails.
     */
    function batchMintForACA(
        address[] calldata recipients,
        bytes32[] calldata acaHashes,
        uint256[] calldata amounts
    )
        external
        whenNotPaused
        nonReentrant
        onlyAuthorizedMinter
        returns (uint256[] memory mintIds)
    {
        if (!mintingEnabled) revert MintingDisabled();
        require(
            recipients.length == acaHashes.length && acaHashes.length == amounts.length,
            "Length mismatch"
        );

        uint256 len = recipients.length;
        mintIds = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            address recipient = recipients[i];
            bytes32 acaHash = acaHashes[i];
            uint256 amount = amounts[i];

            if (recipient == address(0)) revert InvalidRecipient();
            if (amount == 0) revert InvalidAmount();

            if (!_isKnownHolder[recipient]) {
                _isKnownHolder[recipient] = true;
                _allHolders.push(recipient);
            }

            balanceOf[recipient] += amount;
            totalSupply += amount;
            mintCount += 1;
            uint256 mintId = mintCount;

            mintRecords[mintId] = MintRecord({
                recipient: recipient,
                acaHash: acaHash,
                amount: amount,
                timestamp: block.timestamp,
                minter: msg.sender
            });
            mintsByAca[acaHash].push(mintId);
            mintIds[i] = mintId;

            emit ACAMinted(recipient, acaHash, amount, mintId, block.timestamp, msg.sender);
        }
    }

    // ─── Burn ─────────────────────────────────────────────────────────────

    /**
     * @notice Burn caller's own tokens. Used for redemption flows.
     * @param amount Token amount to burn
     * @param acaHash Optional ACA hash this burn references (or bytes32(0))
     * @param reason Optional human-readable description
     * @return burnId The sequential ID assigned to this burn record
     */
    function burn(
        uint256 amount,
        bytes32 acaHash,
        string calldata reason
    )
        external
        whenNotPaused
        nonReentrant
        returns (uint256 burnId)
    {
        if (!burningEnabled) revert BurningDisabled();
        if (amount == 0) revert InvalidAmount();
        if (balanceOf[msg.sender] < amount) {
            revert InsufficientBalance(balanceOf[msg.sender], amount);
        }

        balanceOf[msg.sender] -= amount;
        totalSupply -= amount;
        burnCount += 1;
        burnId = burnCount;

        burnRecords[burnId] = BurnRecord({
            from: msg.sender,
            acaHash: acaHash,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason
        });
        burnsByAddress[msg.sender].push(burnId);

        emit ACABurned(msg.sender, acaHash, amount, burnId, block.timestamp, reason);
    }

    /**
     * @notice Authorized burn from another user's balance (for redemption flows
     *         where backend processes the burn after user signs an off-chain message).
     * @dev Restricted to authorized minters / owner. This is NOT an approve/transferFrom
     *      pattern; it's a privileged operation for backend-orchestrated redemptions.
     */
    function burnFrom(
        address from,
        uint256 amount,
        bytes32 acaHash,
        string calldata reason
    )
        external
        whenNotPaused
        nonReentrant
        onlyAuthorizedMinter
        returns (uint256 burnId)
    {
        if (!burningEnabled) revert BurningDisabled();
        if (from == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (balanceOf[from] < amount) {
            revert InsufficientBalance(balanceOf[from], amount);
        }

        balanceOf[from] -= amount;
        totalSupply -= amount;
        burnCount += 1;
        burnId = burnCount;

        burnRecords[burnId] = BurnRecord({
            from: from,
            acaHash: acaHash,
            amount: amount,
            timestamp: block.timestamp,
            reason: reason
        });
        burnsByAddress[from].push(burnId);

        emit ACABurned(from, acaHash, amount, burnId, block.timestamp, reason);
    }

    // ─── Read functions for indexers and UI ─────────────────────────────

    /// @notice Total number of unique addresses that have ever held this token
    function totalHolders() external view returns (uint256) {
        return _allHolders.length;
    }

    /// @notice Get a holder address by index (use with totalHolders() for pagination)
    function holderAt(uint256 index) external view returns (address) {
        require(index < _allHolders.length, "Index out of range");
        return _allHolders[index];
    }

    /// @notice Returns all mint IDs that referenced a given ACA hash
    function getMintIdsByAca(bytes32 acaHash) external view returns (uint256[] memory) {
        return mintsByAca[acaHash];
    }

    /// @notice Returns all burn IDs from a given address
    function getBurnIdsByAddress(address user) external view returns (uint256[] memory) {
        return burnsByAddress[user];
    }

    // ─── Transfer prevention ─────────────────────────────────────────────

    /// @dev IDIA-B is non-transferable. These functions exist only to surface
    ///      a clear error if a wallet UI tries to transfer (unlike a silent revert
    ///      from a missing function selector).
    function transfer(address to, uint256) external returns (bool) {
        emit TransferAttempted(msg.sender, to);
        revert TransfersNotAllowed();
    }

    function transferFrom(address from, address to, uint256) external returns (bool) {
        emit TransferAttempted(from, to);
        revert TransfersNotAllowed();
    }

    function approve(address, uint256) external pure returns (bool) {
        revert TransfersNotAllowed();
    }

    function allowance(address, address) external pure returns (uint256) {
        return 0;
    }

    // ─── Reject unexpected funds ─────────────────────────────────────────

    /// @dev Reject native token transfers; this contract is not a treasury.
    receive() external payable {
        revert NativeFundsNotAccepted();
    }

    fallback() external payable {
        revert NativeFundsNotAccepted();
    }

    /// @notice Recover ERC-20 tokens accidentally sent to this contract.
    ///         (Doesn't accept them by default, but if someone uses a non-standard
    ///         ERC-20 that bypasses fallback, the owner can rescue them.)
    function rescueTokens(address token, address to, uint256 amount) external onlyOwner {
        if (to == address(0)) revert InvalidRecipient();
        // Low-level call to avoid hard dependency on IERC20
        (bool success, bytes memory data) = token.call(
            abi.encodeWithSignature("transfer(address,uint256)", to, amount)
        );
        require(success && (data.length == 0 || abi.decode(data, (bool))), "Token rescue failed");
    }
}
