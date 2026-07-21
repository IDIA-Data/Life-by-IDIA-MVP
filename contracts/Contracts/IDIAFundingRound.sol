// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IDIAFundingRound (v4 — Batched Push + Migration)
 * @author IDIA Data Inc.
 *
 * @dev Distribution is PUSH-BASED with pagination. An edge function calls
 *      distributeBatch(fromIndex, toIndex) in chunks. Each investor's
 *      distribution is tracked — duplicates are detected and reverted
 *      before any work is done.
 *
 *   Safe Lifecycle:
 *     openRound()                         → accept USDC
 *     closeRound()                        → stop USDC
 *     finalize()                          → lock totals
 *     [Escrow sends IDIA to this contract]
 *     distributeBatch(0, 50)              → push tokens (edge function)
 *     distributeBatch(50, 100)            → next batch
 *     ...until all distributed
 *     withdrawUSDC(treasury, lpStaging)   → 50/50 split
 *
 *   Migration: pause() → migrateTokens() → deploy new contract
 *
 * Compiler: 0.8.24, cancun, optimization 200, viaIR on
 */
contract IDIAFundingRound is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────
    error NotSafe();
    error NotOpen();
    error NotClosed();
    error NotFinalized();
    error NotWhitelisted();
    error NotCreated();
    error ZeroAmount();
    error ZeroAddress();
    error ExceedsCap();
    error InsufficientIDIA();
    error NothingToRefund();
    error RoundNotCancelled();
    error SettingsLocked();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error SmartContractNotAllowed();
    error InvalidState();
    error InvalidRange();
    error ETHTransferFailed();
    error ContractPaused();
    /// @dev Carries the index and address of the already-distributed investor
    error AlreadyDistributed(uint256 index, address investor);

    // ── Events ──────────────────────────────────────────────
    event InvestorWhitelisted(address indexed investor);
    event InvestorRemoved(address indexed investor);
    event RoundOpened(uint256 timestamp, uint256 deadline);
    event RoundClosed(uint256 timestamp, uint256 totalUSDC, uint256 contributorCount);
    event RoundCancelled(uint256 timestamp);
    event Contributed(address indexed investor, uint256 usdcAmount, uint256 totalContributed);
    event RoundFinalized(uint256 totalUSDC, uint256 totalIDIA, uint256 contributorCount);
    event TokensDistributed(address indexed investor, uint256 index, uint256 immediateAmount, uint256 vestingAmount);
    event BatchDistributed(uint256 fromIndex, uint256 toIndex, uint256 processedCount);
    event USDCRefunded(address indexed investor, uint256 amount);
    event USDCWithdrawn(address indexed treasury, uint256 opsAmount, address indexed lpStaging, uint256 lpAmount);
    event DustSwept(address indexed recipient, uint256 amount);
    event EmergencyRecovery(address indexed token, address indexed recipient, uint256 amount);
    event ETHRecovered(address indexed recipient, uint256 amount);
    event Paused(uint256 timestamp);
    event Unpaused(uint256 timestamp);
    event TokensMigrated(address indexed newContract, uint256 idiaAmount, uint256 usdcAmount);

    // ── State ───────────────────────────────────────────────

    IERC20 public immutable usdc;
    IERC20 public immutable idiaToken;
    address public immutable safe;

    address public vestingManager;

    uint256 public totalIDIAAllocation;
    uint256 public usdcCap;
    uint256 public immediateReleaseBps = 1000; // 10%
    bool public settingsLocked;
    bool public requireEOA;
    uint256 public deadline;
    bool public paused;

    enum RoundState { Created, Open, Closed, Finalized, Cancelled }
    RoundState public state;

    // Whitelist + investor tracking
    mapping(address => bool) public whitelisted;
    address[] public investors; // Index-addressable for batch iteration

    // Contributions
    mapping(address => uint256) public contributions;
    uint256 public totalUSDCRaised;
    uint256 public contributorCount;

    // Distribution tracking (per-investor)
    mapping(address => bool) public distributed;
    uint256 public distributedCount;
    uint256 public totalIDIADistributed;

    // Pro-rata allocations (stored during finalize for gas efficiency)
    mapping(address => uint256) public idiaAllocations;

    // Refund tracking
    mapping(address => bool) public hasRefunded;

    // ── Constructor ─────────────────────────────────────────

    constructor(
        address _usdc,
        address _idiaToken,
        address _safe,
        uint256 _totalIDIA,
        uint256 _usdcCap
    ) {
        if (_usdc == address(0) || _idiaToken == address(0) || _safe == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        idiaToken = IERC20(_idiaToken);
        safe = _safe;
        totalIDIAAllocation = _totalIDIA;
        usdcCap = _usdcCap;
        state = RoundState.Created;
    }

    modifier onlySafe() {
        if (msg.sender != safe) revert NotSafe();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ── Pause / Unpause (Safe only) ─────────────────────────

    function pause() external onlySafe {
        paused = true;
        emit Paused(block.timestamp);
    }

    function unpause() external onlySafe {
        paused = false;
        emit Unpaused(block.timestamp);
    }

    // ── Whitelist (Safe only) ───────────────────────────────

    function addInvestors(address[] calldata _investors) external onlySafe {
        for (uint256 i = 0; i < _investors.length; i++) {
            address inv = _investors[i];
            if (inv != address(0) && !whitelisted[inv]) {
                whitelisted[inv] = true;
                investors.push(inv);
                emit InvestorWhitelisted(inv);
            }
        }
    }

    function removeInvestor(address _investor) external onlySafe {
        whitelisted[_investor] = false;
        emit InvestorRemoved(_investor);
    }

    // ── Settings (Safe only, locked once round opens) ───────

    function setVestingManager(address _vm) external onlySafe {
        if (_vm == address(0)) revert ZeroAddress();
        vestingManager = _vm;
    }

    function setImmediateReleaseBps(uint256 _bps) external onlySafe {
        if (settingsLocked) revert SettingsLocked();
        require(_bps <= 10000, "Max 100%");
        immediateReleaseBps = _bps;
    }

    function setRequireEOA(bool _val) external onlySafe {
        if (settingsLocked) revert SettingsLocked();
        requireEOA = _val;
    }

    function setDeadline(uint256 _val) external onlySafe {
        if (settingsLocked) revert SettingsLocked();
        deadline = _val;
    }

    // ═══════════════════════════════════════════════════════
    // ROUND LIFECYCLE — Safe manually calls each step
    // ═══════════════════════════════════════════════════════

    function openRound() external onlySafe {
        if (state != RoundState.Created) revert NotCreated();
        settingsLocked = true;
        state = RoundState.Open;
        emit RoundOpened(block.timestamp, deadline);
    }

    function closeRound() external onlySafe {
        if (state != RoundState.Open) revert NotOpen();
        state = RoundState.Closed;
        emit RoundClosed(block.timestamp, totalUSDCRaised, contributorCount);
    }

    function closeRoundAfterDeadline() external {
        if (state != RoundState.Open) revert NotOpen();
        if (deadline == 0 || block.timestamp < deadline) revert DeadlineNotPassed();
        state = RoundState.Closed;
        emit RoundClosed(block.timestamp, totalUSDCRaised, contributorCount);
    }

    function cancelRound() external onlySafe {
        if (state != RoundState.Open && state != RoundState.Closed) revert InvalidState();
        state = RoundState.Cancelled;
        emit RoundCancelled(block.timestamp);
    }

    /// @notice Finalize: calculate all pro-rata allocations in one pass.
    /// @dev For rounds with >500 investors, use finalizeBatch() instead.
    function finalize() external onlySafe {
        if (state != RoundState.Closed) revert NotClosed();
        if (totalUSDCRaised == 0) revert ZeroAmount();

        // Calculate and store allocations for all contributors
        for (uint256 i = 0; i < investors.length; i++) {
            address inv = investors[i];
            uint256 contrib = contributions[inv];
            if (contrib > 0) {
                idiaAllocations[inv] = (contrib * totalIDIAAllocation) / totalUSDCRaised;
            }
        }

        state = RoundState.Finalized;
        emit RoundFinalized(totalUSDCRaised, totalIDIAAllocation, contributorCount);
    }

    /// @notice Paginated finalize for large investor counts (>500).
    ///         Call repeatedly with consecutive ranges until all processed.
    ///         Final call must include `setFinalized = true`.
    function finalizeBatch(uint256 fromIndex, uint256 toIndex, bool setFinalized) external onlySafe {
        if (state != RoundState.Closed && state != RoundState.Finalized) revert NotClosed();
        if (totalUSDCRaised == 0) revert ZeroAmount();
        if (fromIndex >= toIndex) revert InvalidRange();
        if (toIndex > investors.length) revert InvalidRange();

        for (uint256 i = fromIndex; i < toIndex; i++) {
            address inv = investors[i];
            uint256 contrib = contributions[inv];
            if (contrib > 0 && idiaAllocations[inv] == 0) {
                idiaAllocations[inv] = (contrib * totalIDIAAllocation) / totalUSDCRaised;
            }
        }

        if (setFinalized && state == RoundState.Closed) {
            state = RoundState.Finalized;
            emit RoundFinalized(totalUSDCRaised, totalIDIAAllocation, contributorCount);
        }
    }

    // ═══════════════════════════════════════════════════════
    // CONTRIBUTE (Investors)
    // ═══════════════════════════════════════════════════════

    function contribute(uint256 amount) external nonReentrant whenNotPaused {
        if (state != RoundState.Open) revert NotOpen();
        if (!whitelisted[msg.sender]) revert NotWhitelisted();
        if (amount == 0) revert ZeroAmount();
        if (usdcCap > 0 && totalUSDCRaised + amount > usdcCap) revert ExceedsCap();
        if (deadline > 0 && block.timestamp > deadline) revert DeadlinePassed();
        if (requireEOA && msg.sender != tx.origin) revert SmartContractNotAllowed();

        usdc.safeTransferFrom(msg.sender, address(this), amount);

        if (contributions[msg.sender] == 0) contributorCount++;
        contributions[msg.sender] += amount;
        totalUSDCRaised += amount;

        emit Contributed(msg.sender, amount, contributions[msg.sender]);
    }

    // ═══════════════════════════════════════════════════════
    // BATCHED PUSH DISTRIBUTION (Edge function calls this)
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Distribute tokens to investors in a batch.
     * @param fromIndex Start index (inclusive) in the investors array
     * @param toIndex   End index (exclusive) in the investors array
     *
     * @dev The edge function calls this repeatedly:
     *      distributeBatch(0, 50)
     *      distributeBatch(50, 100)
     *      ...
     *
     *      OVERLAP PROTECTION: Before doing any transfers, this function
     *      checks every investor in the range. If ANY has already been
     *      distributed, the entire call reverts with AlreadyDistributed
     *      (carrying the index and address for monitoring).
     *
     *      Investors with 0 contribution are safely skipped.
     */
    function distributeBatch(uint256 fromIndex, uint256 toIndex) external onlySafe nonReentrant whenNotPaused {
        if (state != RoundState.Finalized) revert NotFinalized();
        if (vestingManager == address(0)) revert ZeroAddress();
        if (fromIndex >= toIndex) revert InvalidRange();
        if (toIndex > investors.length) revert InvalidRange();

        // ── PRE-CHECK: Detect overlaps BEFORE any state changes ──
        for (uint256 i = fromIndex; i < toIndex; i++) {
            address inv = investors[i];
            if (idiaAllocations[inv] > 0 && distributed[inv]) {
                // Revert with the index and address so the edge function
                // knows exactly which investor caused the collision.
                // Custom error data is available in the tx receipt.
                revert AlreadyDistributed(i, inv);
            }
        }

        // ── DISTRIBUTE ──────────────────────────────────────────
        uint256 processedCount = 0;

        // Approve VestingManager for this batch's total vesting amount
        uint256 batchVestingTotal = 0;
        for (uint256 i = fromIndex; i < toIndex; i++) {
            uint256 alloc = idiaAllocations[investors[i]];
            if (alloc > 0) {
                uint256 vesting = alloc - ((alloc * immediateReleaseBps) / 10000);
                batchVestingTotal += vesting;
            }
        }

        if (batchVestingTotal > 0) {
            idiaToken.approve(vestingManager, batchVestingTotal);
        }

        for (uint256 i = fromIndex; i < toIndex; i++) {
            address inv = investors[i];
            uint256 allocation = idiaAllocations[inv];

            // Skip non-contributors (whitelisted but didn't contribute)
            if (allocation == 0) continue;

            // Verify IDIA balance
            uint256 balance = idiaToken.balanceOf(address(this));
            if (balance < allocation) revert InsufficientIDIA();

            distributed[inv] = true;
            distributedCount++;
            totalIDIADistributed += allocation;

            uint256 immediate = (allocation * immediateReleaseBps) / 10000;
            uint256 vesting = allocation - immediate;

            // 10% → investor wallet
            if (immediate > 0) {
                idiaToken.safeTransfer(inv, immediate);
            }

            // 90% → VestingManager
            if (vesting > 0) {
                IVestingManager(vestingManager).depositFor(inv, vesting);
            }

            emit TokensDistributed(inv, i, immediate, vesting);
            processedCount++;
        }

        emit BatchDistributed(fromIndex, toIndex, processedCount);
    }

    // ═══════════════════════════════════════════════════════
    // REFUND (After cancellation)
    // ═══════════════════════════════════════════════════════

    function refund() external nonReentrant {
        if (state != RoundState.Cancelled) revert RoundNotCancelled();
        if (hasRefunded[msg.sender]) revert NothingToRefund();

        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NothingToRefund();

        hasRefunded[msg.sender] = true;
        contributions[msg.sender] = 0;

        usdc.safeTransfer(msg.sender, amount);
        emit USDCRefunded(msg.sender, amount);
    }

    // ═══════════════════════════════════════════════════════
    // WITHDRAWAL & RECOVERY (Safe only)
    // ═══════════════════════════════════════════════════════

    function withdrawUSDC(address treasury, address lpStaging) external onlySafe nonReentrant {
        if (state != RoundState.Finalized) revert NotFinalized();
        if (treasury == address(0) || lpStaging == address(0)) revert ZeroAddress();

        uint256 total = usdc.balanceOf(address(this));
        uint256 opsAmount = total / 2;
        uint256 lpAmount = total - opsAmount;

        usdc.safeTransfer(treasury, opsAmount);
        usdc.safeTransfer(lpStaging, lpAmount);
        emit USDCWithdrawn(treasury, opsAmount, lpStaging, lpAmount);
    }

    function sweepDust(address recipient) external onlySafe {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        idiaToken.safeTransfer(recipient, balance);
        emit DustSwept(recipient, balance);
    }

    function emergencyRecover(address token, uint256 amount, address recipient) external onlySafe {
        if (recipient == address(0)) revert ZeroAddress();
        if (token == address(usdc) && state == RoundState.Open) revert InvalidState();
        IERC20(token).safeTransfer(recipient, amount);
        emit EmergencyRecovery(token, recipient, amount);
    }

    function recoverETH(address payable recipient) external onlySafe {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();
        (bool ok, ) = recipient.call{value: balance}("");
        if (!ok) revert ETHTransferFailed();
        emit ETHRecovered(recipient, balance);
    }

    // ═══════════════════════════════════════════════════════
    // MIGRATION (Safe only)
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Migrate all remaining tokens to a new contract.
     * @dev Pause first, then migrate. The new contract handles
     *      any undistributed investors using data from events/DB.
     */
    function migrateTokens(address newContract) external onlySafe {
        if (!paused) revert ContractPaused(); // Must be paused to migrate
        if (newContract == address(0)) revert ZeroAddress();

        uint256 idiaBalance = idiaToken.balanceOf(address(this));
        uint256 usdcBalance = usdc.balanceOf(address(this));

        if (idiaBalance > 0) idiaToken.safeTransfer(newContract, idiaBalance);
        if (usdcBalance > 0) usdc.safeTransfer(newContract, usdcBalance);

        emit TokensMigrated(newContract, idiaBalance, usdcBalance);
    }

    receive() external payable {}

    // ── View Functions ──────────────────────────────────────

    function getInvestorCount() external view returns (uint256) { return investors.length; }
    function getContributorCount() external view returns (uint256) { return contributorCount; }

    /// @notice How many investors still need distribution?
    function getRemainingDistributions() external view returns (uint256) {
        return contributorCount > distributedCount ? contributorCount - distributedCount : 0;
    }

    /// @notice Get investor address at a specific index (for edge function iteration)
    function getInvestorAt(uint256 index) external view returns (address) {
        return investors[index];
    }

    function getInvestorAllocation(address investor) external view returns (
        uint256 usdcContributed,
        uint256 percentageBps,
        uint256 totalIDIA,
        uint256 immediateIDIA,
        uint256 vestingIDIA,
        bool isDistributed
    ) {
        usdcContributed = contributions[investor];
        isDistributed = distributed[investor];
        if (totalUSDCRaised > 0 && usdcContributed > 0) {
            percentageBps = (usdcContributed * 10000) / totalUSDCRaised;
            totalIDIA = idiaAllocations[investor];
            if (totalIDIA == 0) {
                totalIDIA = (usdcContributed * totalIDIAAllocation) / totalUSDCRaised;
            }
            immediateIDIA = (totalIDIA * immediateReleaseBps) / 10000;
            vestingIDIA = totalIDIA - immediateIDIA;
        }
    }
}

interface IVestingManager {
    function depositFor(address beneficiary, uint256 amount) external;
}
