// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IDIATeamVestingManager (v2 — Per-Beneficiary Start Dates)
 * @author IDIA Data Inc.
 *
 * @dev Team token vesting with individual start dates per member.
 *
 *   Key differences from the investor VestingManager:
 *     - 36 months instead of 72
 *     - Each beneficiary has their OWN vesting start date
 *       (no global vestingStartDate)
 *     - The CEO who already received 10% can be deposited with
 *       startTimestamp backdated and 0% immediate
 *     - Future hires get added later with their employment start date
 *
 *   depositFor(beneficiary, amount, startTimestamp):
 *     - startTimestamp = when this person's 36 months begins
 *     - Can be in the past (backdated for existing team)
 *     - Can be in the future (pre-loaded for a known start date)
 *     - Each beneficiary gets exactly one deposit (no duplicates)
 *
 *   Example scenarios:
 *     CEO (started Jan 2026, already got 10%):
 *       depositFor(ceo, 90% of allocation, Jan 1 2026 timestamp)
 *       → vesting already has 6 months elapsed, first push sends 6 months
 *
 *     Dev hired today:
 *       10% sent directly from escrow to wallet (edge function)
 *       depositFor(dev, 90% of allocation, today's timestamp)
 *       → first monthly unlock in 30 days
 *
 *     Future hire starting Dec 2026:
 *       depositFor(hire, 90% of allocation, Dec 1 2026 timestamp)
 *       → nothing unlocks until Jan 2027
 *
 * Compiler: 0.8.24, cancun, optimization 200, viaIR on
 */
contract IDIATeamVestingManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────
    error NotSafe();
    error NotAuthorized();
    error NotAuthorizedDepositor();
    error NothingToClaim();
    error NoVestingSchedule();
    error AlreadyForfeited();
    error ZeroAmount();
    error ZeroAddress();
    error ZeroStartDate();
    error ScheduleAlreadyExists();
    error InvalidRange();
    error ETHTransferFailed();
    error ContractPaused();

    // ── Events ──────────────────────────────────────────────
    event VestingCreated(address indexed beneficiary, uint256 totalAmount, uint256 startTimestamp);
    event TokensPushed(address indexed beneficiary, uint256 amount, uint256 totalClaimed, uint256 monthsUnlocked);
    event PushFailed(address indexed beneficiary, uint256 index, uint256 amount, string reason);
    event TokensClaimed(address indexed beneficiary, uint256 amount, uint256 totalClaimed);
    event BatchPushCompleted(uint256 fromIndex, uint256 toIndex, uint256 processedCount, uint256 totalPushed);
    event VestingForfeited(address indexed beneficiary, uint256 unvestedReturned, address treasury);
    event EmergencyRecovery(address indexed token, address indexed recipient, uint256 amount);
    event ETHRecovered(address indexed recipient, uint256 amount);
    event Paused(uint256 timestamp);
    event Unpaused(uint256 timestamp);
    event TokensMigrated(address indexed newContract, uint256 amount);
    event OperatorAuthorized(address indexed operator);
    event OperatorRevoked(address indexed operator);

    // ── Structs ─────────────────────────────────────────────

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimed;
        uint256 startTimestamp;  // Per-beneficiary vesting start
        bool forfeited;
    }

    // ── Constants ────────────────────────────────────────────

    uint256 public constant VESTING_MONTHS = 36;
    uint256 public constant MONTH_DURATION = 30 days;

    // ── State ───────────────────────────────────────────────

    IERC20 public immutable idiaToken;
    address public immutable safe;

    bool public paused;

    mapping(address => bool) public authorizedDepositors;
    mapping(address => bool) public authorizedOperators;
    mapping(address => VestingSchedule) public schedules;
    address[] public beneficiaries;
    uint256 public totalVestingBalance;

    // ── Constructor ─────────────────────────────────────────

    constructor(address _idiaToken, address _safe) {
        if (_idiaToken == address(0) || _safe == address(0)) revert ZeroAddress();
        idiaToken = IERC20(_idiaToken);
        safe = _safe;
    }

    modifier onlySafe() {
        if (msg.sender != safe) revert NotSafe();
        _;
    }

    modifier onlySafeOrOperator() {
        if (msg.sender != safe && !authorizedOperators[msg.sender]) revert NotAuthorized();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ── Pause / Unpause ─────────────────────────────────────

    function pause() external onlySafe { paused = true; emit Paused(block.timestamp); }
    function unpause() external onlySafe { paused = false; emit Unpaused(block.timestamp); }

    // ── Operator Management (Safe only) ─────────────────────

    function authorizeOperator(address operator) external onlySafe {
        if (operator == address(0)) revert ZeroAddress();
        authorizedOperators[operator] = true;
        emit OperatorAuthorized(operator);
    }

    function revokeOperator(address operator) external onlySafe {
        authorizedOperators[operator] = false;
        emit OperatorRevoked(operator);
    }

    // ── Depositor Management (Safe only) ────────────────────

    function authorizeDepositor(address depositor) external onlySafe {
        if (depositor == address(0)) revert ZeroAddress();
        authorizedDepositors[depositor] = true;
    }

    function revokeDepositor(address depositor) external onlySafe {
        authorizedDepositors[depositor] = false;
    }

    // ── Deposit ─────────────────────────────────────────────

    /**
     * @notice Deposit tokens into vesting for a team member.
     * @param beneficiary    The team member's wallet address
     * @param amount         Total IDIA to vest (the 90% portion)
     * @param startTimestamp  When this person's 36-month vesting begins.
     *                        Can be past, present, or future.
     */
    function depositFor(
        address beneficiary,
        uint256 amount,
        uint256 startTimestamp
    ) external nonReentrant {
        if (!authorizedDepositors[msg.sender]) revert NotAuthorizedDepositor();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (startTimestamp == 0) revert ZeroStartDate();

        VestingSchedule storage schedule = schedules[beneficiary];
        if (schedule.totalAmount > 0) revert ScheduleAlreadyExists();

        idiaToken.safeTransferFrom(msg.sender, address(this), amount);

        schedule.totalAmount = amount;
        schedule.startTimestamp = startTimestamp;
        beneficiaries.push(beneficiary);
        totalVestingBalance += amount;

        emit VestingCreated(beneficiary, amount, startTimestamp);
    }

    // ═══════════════════════════════════════════════════════
    // PUSH DISTRIBUTION (Edge function calls this monthly)
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Push unlocked tokens to team members in a batch.
     * @dev Each beneficiary's vesting is calculated from their own
     *      startTimestamp. Members whose vesting hasn't started yet
     *      (future startTimestamp) are automatically skipped.
     */
    function pushDistributionBatch(
        uint256 fromIndex,
        uint256 toIndex
    ) external onlySafeOrOperator nonReentrant whenNotPaused {
        if (fromIndex >= toIndex) revert InvalidRange();
        if (toIndex > beneficiaries.length) revert InvalidRange();

        uint256 processedCount = 0;
        uint256 totalPushed = 0;

        for (uint256 i = fromIndex; i < toIndex; i++) {
            address inv = beneficiaries[i];
            VestingSchedule storage schedule = schedules[inv];

            if (schedule.totalAmount == 0 || schedule.forfeited) continue;
            if (block.timestamp <= schedule.startTimestamp) continue;

            uint256 vested = _vestedAmount(schedule);
            uint256 amountDue = vested - schedule.claimed;

            if (amountDue == 0) continue;

            (bool ok, ) = address(idiaToken).call(
                abi.encodeWithSelector(IERC20.transfer.selector, inv, amountDue)
            );

            if (ok) {
                schedule.claimed += amountDue;
                totalVestingBalance -= amountDue;
                totalPushed += amountDue;
                processedCount++;

                uint256 monthsElapsed = _monthsElapsedFor(schedule);
                emit TokensPushed(inv, amountDue, schedule.claimed, monthsElapsed);
            } else {
                emit PushFailed(inv, i, amountDue, "transfer_failed");
            }
        }

        emit BatchPushCompleted(fromIndex, toIndex, processedCount, totalPushed);
    }

    // ── Manual Claim (backup) ───────────────────────────────

    function claim() external nonReentrant whenNotPaused {
        VestingSchedule storage schedule = schedules[msg.sender];
        if (schedule.totalAmount == 0) revert NoVestingSchedule();
        if (schedule.forfeited) revert AlreadyForfeited();
        if (block.timestamp <= schedule.startTimestamp) revert NothingToClaim();

        uint256 vested = _vestedAmount(schedule);
        uint256 amountDue = vested - schedule.claimed;
        if (amountDue == 0) revert NothingToClaim();

        schedule.claimed += amountDue;
        totalVestingBalance -= amountDue;

        idiaToken.safeTransfer(msg.sender, amountDue);
        emit TokensClaimed(msg.sender, amountDue, schedule.claimed);
    }

    // ── Forfeit (Safe only) ─────────────────────────────────

    function forfeit(address beneficiary, address treasury) external onlySafe nonReentrant {
        if (treasury == address(0)) revert ZeroAddress();

        VestingSchedule storage schedule = schedules[beneficiary];
        if (schedule.totalAmount == 0) revert NoVestingSchedule();
        if (schedule.forfeited) revert AlreadyForfeited();

        uint256 vested = _vestedAmount(schedule);
        uint256 unvested = schedule.totalAmount - vested;

        uint256 unclaimedVested = vested - schedule.claimed;
        if (unclaimedVested > 0) {
            schedule.claimed += unclaimedVested;
            totalVestingBalance -= unclaimedVested;
            idiaToken.safeTransfer(beneficiary, unclaimedVested);
        }

        schedule.forfeited = true;
        if (unvested > 0) {
            totalVestingBalance -= unvested;
            idiaToken.safeTransfer(treasury, unvested);
        }

        emit VestingForfeited(beneficiary, unvested, treasury);
    }

    // ═══════════════════════════════════════════════════════
    // MIGRATION
    // ═══════════════════════════════════════════════════════

    function migrateTokens(address newContract) external onlySafe {
        if (!paused) revert ContractPaused();
        if (newContract == address(0)) revert ZeroAddress();

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance > 0) idiaToken.safeTransfer(newContract, balance);
        emit TokensMigrated(newContract, balance);
    }

    function exportSchedules(
        uint256 fromIndex, uint256 toIndex
    ) external view returns (
        address[] memory addresses,
        uint256[] memory totalAmounts,
        uint256[] memory claimedAmounts,
        uint256[] memory startTimestamps,
        bool[] memory forfeitedFlags
    ) {
        if (toIndex > beneficiaries.length) toIndex = beneficiaries.length;
        uint256 count = toIndex - fromIndex;

        addresses = new address[](count);
        totalAmounts = new uint256[](count);
        claimedAmounts = new uint256[](count);
        startTimestamps = new uint256[](count);
        forfeitedFlags = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            address inv = beneficiaries[fromIndex + i];
            VestingSchedule storage s = schedules[inv];
            addresses[i] = inv;
            totalAmounts[i] = s.totalAmount;
            claimedAmounts[i] = s.claimed;
            startTimestamps[i] = s.startTimestamp;
            forfeitedFlags[i] = s.forfeited;
        }
    }

    // ── Recovery ────────────────────────────────────────────

    function emergencyRecover(address token, address recipient) external onlySafe {
        if (recipient == address(0)) revert ZeroAddress();

        if (token == address(idiaToken)) {
            uint256 balance = idiaToken.balanceOf(address(this));
            uint256 excess = balance > totalVestingBalance ? balance - totalVestingBalance : 0;
            if (excess == 0) revert ZeroAmount();
            idiaToken.safeTransfer(recipient, excess);
            emit EmergencyRecovery(token, recipient, excess);
        } else {
            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) revert ZeroAmount();
            IERC20(token).safeTransfer(recipient, balance);
            emit EmergencyRecovery(token, recipient, balance);
        }
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

    // ── View Functions ──────────────────────────────────────

    function claimable(address beneficiary) external view returns (uint256) {
        VestingSchedule storage s = schedules[beneficiary];
        if (s.totalAmount == 0 || s.forfeited) return 0;
        if (block.timestamp <= s.startTimestamp) return 0;
        return _vestedAmount(s) - s.claimed;
    }

    function getSchedule(address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 vestedAmount,
        uint256 claimedAmount,
        uint256 claimableAmount,
        uint256 unvestedAmount,
        uint256 startTimestamp,
        uint256 monthsUnlocked,
        uint256 nextUnlockTimestamp,
        bool isForfeited
    ) {
        VestingSchedule storage s = schedules[beneficiary];
        totalAmount = s.totalAmount;
        startTimestamp = s.startTimestamp;
        vestedAmount = _vestedAmount(s);
        claimedAmount = s.claimed;
        claimableAmount = s.forfeited ? 0 : vestedAmount - claimedAmount;
        unvestedAmount = totalAmount - vestedAmount;
        isForfeited = s.forfeited;
        monthsUnlocked = _monthsElapsedFor(s);

        if (s.startTimestamp > 0 && monthsUnlocked < VESTING_MONTHS) {
            nextUnlockTimestamp = s.startTimestamp + ((monthsUnlocked + 1) * MONTH_DURATION);
        }
    }

    /// @notice Get unlock schedule for a specific beneficiary
    function getUnlockSchedule(address beneficiary) external view returns (uint256[36] memory unlockDates) {
        VestingSchedule storage s = schedules[beneficiary];
        for (uint256 i = 0; i < 36; i++) {
            unlockDates[i] = s.startTimestamp + ((i + 1) * MONTH_DURATION);
        }
    }

    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }

    // ── Internal ────────────────────────────────────────────

    function _monthsElapsedFor(VestingSchedule storage schedule) internal view returns (uint256) {
        if (schedule.startTimestamp == 0 || block.timestamp <= schedule.startTimestamp) return 0;
        uint256 elapsed = block.timestamp - schedule.startTimestamp;
        uint256 months = elapsed / MONTH_DURATION;
        return months > VESTING_MONTHS ? VESTING_MONTHS : months;
    }

    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (schedule.totalAmount == 0) return 0;
        uint256 months = _monthsElapsedFor(schedule);
        if (months == 0) return 0;
        if (months >= VESTING_MONTHS) return schedule.totalAmount;
        return (schedule.totalAmount * months) / VESTING_MONTHS;
    }
}
