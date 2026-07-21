// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IDIASynapseVault
 * @author IDIA Data Inc.
 *
 * @dev On-chain purchase point for Synapse Credits.
 *
 *   Flow:
 *     1. User approves USDC to this contract
 *     2. User calls purchaseCredits(creditCount)
 *     3. Contract transfers USDC to treasury
 *     4. Emits CreditsPurchased event
 *     5. Edge function (synapse-purchase-listener) picks up event
 *     6. Edge function credits wallets.synapse_gas_credits in Supabase
 *
 *   Pricing: $0.75/credit (750000 USDC-units at 6 decimals).
 *   Safe can update the price for future-proofing without redeploying.
 *   SPV/SPC split ($0.25 of $0.75) handled off-chain by treasury ops.
 *
 * Compiler: 0.8.24, cancun, optimization 200, viaIR on
 */
contract IDIASynapseVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────
    error NotSafe();
    error ZeroAmount();
    error ZeroAddress();
    error ContractPaused();
    error InsufficientAllowance();
    error ETHTransferFailed();

    // ── Events ──────────────────────────────────────────────

    /// @notice Emitted on every credit purchase. The edge function indexes this.
    /// @param buyer      Wallet address of the purchaser
    /// @param creditCount Number of Synapse Credits purchased
    /// @param usdcAmount  Total USDC paid (6 decimals)
    /// @param pricePerCredit USDC price per credit at time of purchase (6 decimals)
    event CreditsPurchased(
        address indexed buyer,
        uint256 creditCount,
        uint256 usdcAmount,
        uint256 pricePerCredit
    );

    event PriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TreasuryUpdated(address oldTreasury, address newTreasury);
    event Paused(uint256 timestamp);
    event Unpaused(uint256 timestamp);
    event EmergencyRecovery(address indexed token, address indexed recipient, uint256 amount);
    event ETHRecovered(address indexed recipient, uint256 amount);

    // ── State ───────────────────────────────────────────────

    IERC20 public immutable usdc;
    address public immutable safe;

    /// @notice USDC price per credit (6 decimals). Default: 750000 = $0.75
    uint256 public pricePerCredit;

    /// @notice Where USDC goes after purchase. Initially the Safe.
    address public treasury;

    bool public paused;

    /// @notice Total credits sold (for analytics)
    uint256 public totalCreditsSold;

    /// @notice Total USDC collected (for analytics)
    uint256 public totalUSDCCollected;

    // ── Constructor ─────────────────────────────────────────

    constructor(address _usdc, address _safe, address _treasury) {
        if (_usdc == address(0) || _safe == address(0) || _treasury == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        safe = _safe;
        treasury = _treasury;
        pricePerCredit = 750000; // $0.75 USDC (6 decimals)
    }

    modifier onlySafe() {
        if (msg.sender != safe) revert NotSafe();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ── Purchase ────────────────────────────────────────────

    /**
     * @notice Purchase Synapse Credits with USDC.
     * @param creditCount Number of credits to buy (1-3 typical per query)
     *
     * @dev User must approve this contract for (creditCount × pricePerCredit)
     *      USDC before calling. USDC transfers directly to treasury —
     *      this contract never holds user funds.
     */
    function purchaseCredits(uint256 creditCount) external nonReentrant whenNotPaused {
        if (creditCount == 0) revert ZeroAmount();

        uint256 totalCost = creditCount * pricePerCredit;

        // Verify allowance before attempting transfer (clearer error)
        uint256 allowed = usdc.allowance(msg.sender, address(this));
        if (allowed < totalCost) revert InsufficientAllowance();

        // Transfer USDC from buyer directly to treasury
        usdc.safeTransferFrom(msg.sender, treasury, totalCost);

        totalCreditsSold += creditCount;
        totalUSDCCollected += totalCost;

        emit CreditsPurchased(msg.sender, creditCount, totalCost, pricePerCredit);
    }

    // ── Admin (Safe only) ───────────────────────────────────

    /// @notice Update credit price. CEO wants $0.75 default but this
    ///         future-proofs against needing a contract redeployment.
    function setPrice(uint256 _newPrice) external onlySafe {
        if (_newPrice == 0) revert ZeroAmount();
        uint256 old = pricePerCredit;
        pricePerCredit = _newPrice;
        emit PriceUpdated(old, _newPrice);
    }

    function setTreasury(address _newTreasury) external onlySafe {
        if (_newTreasury == address(0)) revert ZeroAddress();
        address old = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(old, _newTreasury);
    }

    function pause() external onlySafe { paused = true; emit Paused(block.timestamp); }
    function unpause() external onlySafe { paused = false; emit Unpaused(block.timestamp); }

    // ── Recovery ────────────────────────────────────────────

    /// @notice Recover tokens accidentally sent to this contract.
    ///         This contract should NEVER hold funds (USDC goes directly
    ///         to treasury), so any balance here is accidental.
    function emergencyRecover(address token, address recipient) external onlySafe {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (balance == 0) revert ZeroAmount();
        IERC20(token).safeTransfer(recipient, balance);
        emit EmergencyRecovery(token, recipient, balance);
    }

    function recoverETH(address payable recipient) external onlySafe {
        if (recipient == address(0)) revert ZeroAddress();
        uint256 balance = address(this).balance;
        if (balance == 0) revert ZeroAmount();
        (bool ok, ) = recipient.call{value: balance}("");
        if (!ok) revert ETHTransferFailed();
        emit ETHRecovered(recipient, balance);
    }

    receive() external payable {}

    // ── View ────────────────────────────────────────────────

    /// @notice Calculate USDC cost for a given number of credits
    function getCost(uint256 creditCount) external view returns (uint256) {
        return creditCount * pricePerCredit;
    }
}
