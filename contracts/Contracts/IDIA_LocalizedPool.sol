// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IDIA_LocalizedPool
 * @author IDIA Data Inc.
 * @notice Autonomous vault for regional Decentralization Pool funds.
 *         Each instance represents a single jurisdiction (e.g., Cincinnati_OH_US)
 *         and holds IDIA tokens allocated from the 10% "War Chest" revenue split.
 *
 * @dev Ownership is initially the deployer (Multi-sig via Factory), but can be
 *      transferred to a regional Governor or DAO as the jurisdiction matures.
 *      Uses SafeERC20 to handle non-standard token edge cases.
 *
 *      Constitutional Constraint: Only the owner (Multi-sig or regional Governor)
 *      can authorize fund disbursements, enforcing decentralized regional autonomy.
 */
contract IDIA_LocalizedPool is Ownable {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────
    error Pool__ZeroAddress();
    error Pool__ZeroAmount();
    error Pool__InsufficientBalance(uint256 requested, uint256 available);

    // ── Events (stall-protection logging) ───────────────────
    event AllocationPulseStarted(address indexed recipient, uint256 amount);
    event AllocationPulseFinished(address indexed recipient, uint256 amount, uint256 remainingBalance);
    event EmergencyWithdrawal(address indexed to, uint256 amount);

    // ── State ───────────────────────────────────────────────
    string public locationIdentifier;
    IERC20 public immutable idiaToken;

    constructor(
        string memory _location,
        address _idiaToken,
        address _initialOwner
    ) Ownable(_initialOwner) {
        if (_idiaToken == address(0)) revert Pool__ZeroAddress();
        if (_initialOwner == address(0)) revert Pool__ZeroAddress();

        locationIdentifier = _location;
        idiaToken = IERC20(_idiaToken);
    }

    // ── External ────────────────────────────────────────────

    /**
     * @notice Disburse funds from the regional pool to a recipient.
     * @dev Only callable by the pool owner (Multi-sig or regional Governor).
     *      Implements the Constitutional constraint that fund usage is governed
     *      by token-holder votes within the specific jurisdiction.
     * @param recipient The address to receive the IDIA tokens.
     * @param amount    The amount of IDIA tokens to disburse (in wei).
     */
    function executeCommunitySpend(address recipient, uint256 amount)
        external onlyOwner
    {
        if (recipient == address(0)) revert Pool__ZeroAddress();
        if (amount == 0) revert Pool__ZeroAmount();

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance < amount) {
            revert Pool__InsufficientBalance(amount, balance);
        }

        emit AllocationPulseStarted(recipient, amount);

        idiaToken.safeTransfer(recipient, amount);

        uint256 remaining = idiaToken.balanceOf(address(this));
        emit AllocationPulseFinished(recipient, amount, remaining);
    }

    /**
     * @notice View the pool's current IDIA token balance.
     */
    function poolBalance() external view returns (uint256) {
        return idiaToken.balanceOf(address(this));
    }

    /**
     * @notice Emergency withdrawal of all IDIA tokens to the owner.
     * @dev Safety valve — only callable by the Multi-sig.
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance == 0) revert Pool__ZeroAmount();

        emit EmergencyWithdrawal(owner(), balance);
        idiaToken.safeTransfer(owner(), balance);
    }
}
