// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

/**
 * @title IDIALiabilityReceipt
 * @author IDIA Data Inc.
 * @notice Soulbound (non-transferable, non-burnable) on-chain receipt for
 *         data purchases. Each token is a permanent proof of purchase with
 *         the ACA consent chain embedded.
 *
 * @dev Constructor-optimized: accepts an initial minter address so the
 *      relayer is ready to mint immediately after deployment without a
 *      separate grantRole transaction.
 */
contract IDIALiabilityReceipt is ERC721, AccessControl {

    // ── ERC-5192: Minimal Soulbound NFTs ────────────────────
    event Locked(uint256 tokenId);

    // ── Roles ───────────────────────────────────────────────
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // ── Errors ──────────────────────────────────────────────
    error Receipt__Soulbound();
    error Receipt__ZeroAddress();
    error Receipt__EmptyACAHashes();
    error Receipt__ReceiptNotFound(uint256 tokenId);

    // ── Events ──────────────────────────────────────────────_
    event ReceiptMinted(
        uint256 indexed tokenId,
        address indexed dataBuyer,
        bytes32 indexed synapseReceiptId,
        uint256 acaCount,
        uint256 purchaseAmount,
        uint256 timestamp
    );

    // ── Receipt Data ────────────────────────────────────────
    struct Receipt {
        address dataBuyer;
        bytes32[] acaHashes;
        uint256 purchaseAmount;
        bytes32 synapseReceiptId;
        string dataBundleRef;
        uint256 mintedAt;
        uint256 blockNumber;
    }

    // ── State ───────────────────────────────────────────────
    uint256 private _nextTokenId;
    mapping(uint256 => Receipt) private _receipts;
    mapping(address => uint256[]) private _buyerReceipts;
    mapping(bytes32 => uint256) private _synapseToTokenId;

    /**
     * @param admin   The Gnosis Safe address (DEFAULT_ADMIN_ROLE)
     * @param minter  The relayer wallet address (MINTER_ROLE). Pass address(0) to skip.
     */
    constructor(address admin, address minter) ERC721("IDIA Liability Receipt", "IDIA-LR") {
        if (admin == address(0)) revert Receipt__ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);

        if (minter != address(0)) {
            _grantRole(MINTER_ROLE, minter);
        }
    }

    // ── External: Mint ──────────────────────────────────────

    function mintReceipt(
        address dataBuyer,
        bytes32[] calldata acaHashes,
        uint256 purchaseAmount,
        bytes32 synapseReceiptId,
        string calldata dataBundleRef
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        if (dataBuyer == address(0)) revert Receipt__ZeroAddress();
        if (acaHashes.length == 0) revert Receipt__EmptyACAHashes();

        require(
            _synapseToTokenId[synapseReceiptId] == 0,
            "Receipt already minted for this Synapse ID"
        );

        tokenId = _nextTokenId++;

        _receipts[tokenId] = Receipt({
            dataBuyer: dataBuyer,
            acaHashes: acaHashes,
            purchaseAmount: purchaseAmount,
            synapseReceiptId: synapseReceiptId,
            dataBundleRef: dataBundleRef,
            mintedAt: block.timestamp,
            blockNumber: block.number
        });

        _buyerReceipts[dataBuyer].push(tokenId);
        _synapseToTokenId[synapseReceiptId] = tokenId + 1;

        _safeMint(dataBuyer, tokenId);

        emit ReceiptMinted(tokenId, dataBuyer, synapseReceiptId, acaHashes.length, purchaseAmount, block.timestamp);
        emit Locked(tokenId);
    }

    // ── External: Read ──────────────────────────────────────

    function getReceipt(uint256 tokenId) external view returns (Receipt memory) {
        if (tokenId >= _nextTokenId) revert Receipt__ReceiptNotFound(tokenId);
        return _receipts[tokenId];
    }

    function getACAHashes(uint256 tokenId) external view returns (bytes32[] memory) {
        if (tokenId >= _nextTokenId) revert Receipt__ReceiptNotFound(tokenId);
        return _receipts[tokenId].acaHashes;
    }

    function getReceiptsByBuyer(address buyer) external view returns (uint256[] memory) {
        return _buyerReceipts[buyer];
    }

    function getReceiptBySynapseId(bytes32 synapseReceiptId) external view returns (uint256) {
        uint256 stored = _synapseToTokenId[synapseReceiptId];
        require(stored > 0, "No receipt for this Synapse ID");
        return stored - 1;
    }

    function totalReceipts() external view returns (uint256) {
        return _nextTokenId;
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    // ── On-Chain Metadata ───────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        Receipt storage r = _receipts[tokenId];

        bytes memory acaArray = "[";
        for (uint256 i = 0; i < r.acaHashes.length; i++) {
            if (i > 0) acaArray = abi.encodePacked(acaArray, ",");
            acaArray = abi.encodePacked(acaArray, '"', _bytes32ToHex(r.acaHashes[i]), '"');
        }
        acaArray = abi.encodePacked(acaArray, "]");

        bytes memory json = abi.encodePacked(
            '{"name":"IDIA Liability Receipt #', Strings.toString(tokenId),
            '","description":"Soulbound on-chain receipt for IDIA data purchase. Contains ACA consent chain for regulatory compliance.",',
            '"attributes":[',
                '{"trait_type":"Data Buyer","value":"', Strings.toHexString(r.dataBuyer), '"},',
                '{"trait_type":"Purchase Amount (USDC)","value":', Strings.toString(r.purchaseAmount), '},',
                '{"trait_type":"Consent Records","value":', Strings.toString(r.acaHashes.length), '},',
                '{"trait_type":"Synapse Receipt","value":"', _bytes32ToHex(r.synapseReceiptId), '"},',
                '{"trait_type":"Data Bundle","value":"', r.dataBundleRef, '"},',
                '{"trait_type":"Minted At","value":', Strings.toString(r.mintedAt), '},',
                '{"trait_type":"Block Number","value":', Strings.toString(r.blockNumber), '}',
            '],',
            '"aca_hashes":', acaArray,
            '}'
        );

        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    // ── Soulbound: Disable All Transfers ────────────────────

    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Receipt__Soulbound();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override { revert Receipt__Soulbound(); }
    function setApprovalForAll(address, bool) public pure override { revert Receipt__Soulbound(); }

    // ── Interface Support ───────────────────────────────────

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return interfaceId == 0xb45a3c0e || super.supportsInterface(interfaceId);
    }

    // ── Internal Helpers ────────────────────────────────────

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66);
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(data[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }
}
