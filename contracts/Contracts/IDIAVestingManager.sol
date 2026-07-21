// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title IDIAVestingManager (v4 — Push Distribution + Migration)
 * @author IDIA Data Inc.
 *
 * @dev Automatic monthly distributions via edge function.
 *      Investors do NOT need to claim — tokens are pushed to them.
 *
 *   All investors share a GLOBAL vesting start date (set by Safe).
 *   72 monthly unlock dates, each 30 days apart.
 *   Edge function calls pushDistributionBatch() monthly to send
 *   unlocked tokens to investors.
 *
 *   ACCUMULATION MODEL:
 *     - Nothing is ever lost if a push is delayed
 *     - If the edge function misses months 2 and 3, month 4's push
 *       sends the accumulated unlocked amount (months 2+3+4)
 *     - Safe-to-call repeatedly: investors with 0 claimable are skipped
 *
 *   MIGRATION:
 *     - pause() → exportSchedules() → migrateTokens(newContract)
 *     - New contract re-initializes with exported data
 *
 * Compiler: 0.8.24, cancun, optimization 200, viaIR on
 */
contract IDIAVestingManager is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────
    error NotSafe();
    error NotAuthorizedDepositor();
    error NothingToClaim();
    error NoVestingSchedule();
    error AlreadyForfeited();
    error ZeroAmount();
    error ZeroAddress();
    error ScheduleAlreadyExists();
    error VestingNotStarted();
    error VestingAlreadyStarted();
    error InvalidRange();
    error ETHTransferFailed();
    error ContractPaused();

    // ── Events ──────────────────────────────────────────────
    event VestingStartDateSet(uint256 startDate);
    event VestingCreated(address indexed beneficiary, uint256 totalAmount);
    event TokensPushed(address indexed beneficiary, uint256 amount, uint256 totalClaimed, uint256 monthsUnlocked);
    event TokensClaimed(address indexed beneficiary, uint256 amount, uint256 totalClaimed);
    event BatchPushCompleted(uint256 fromIndex, uint256 toIndex, uint256 processedCount, uint256 totalPushed);
    event VestingForfeited(address indexed beneficiary, uint256 unvestedReturned, address treasury);
    event EmergencyRecovery(address indexed token, address indexed recipient, uint256 amount);
    event ETHRecovered(address indexed recipient, uint256 amount);
    event Paused(uint256 timestamp);
    event Unpaused(uint256 timestamp);
    event TokensMigrated(address indexed newContract, uint256 amount);

    // ── Structs ─────────────────────────────────────────────

    struct VestingSchedule {
        uint256 totalAmount;
        uint256 claimed;     // Total tokens sent to investor so far
        bool forfeited;
    }

    // ── Constants ────────────────────────────────────────────

    uint256 public constant VESTING_MONTHS = 72;
    uint256 public constant MONTH_DURATION = 30 days;

    // ── State ───────────────────────────────────────────────

    IERC20 public immutable idiaToken;
    address public immutable safe;

    uint256 public vestingStartDate;
    bool public paused;

    mapping(address => bool) public authorizedDepositors;
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

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    // ── Pause / Unpause ─────────────────────────────────────

    function pause() external onlySafe {
        paused = true;
        emit Paused(block.timestamp);
    }

    function unpause() external onlySafe {
        paused = false;
        emit Unpaused(block.timestamp);
    }

    // ── Configuration (Safe only) ───────────────────────────

    function setVestingStartDate(uint256 _startDate) external onlySafe {
        if (vestingStartDate != 0) revert VestingAlreadyStarted();
        if (_startDate == 0) revert ZeroAmount();
        vestingStartDate = _startDate;
        emit VestingStartDateSet(_startDate);
    }

    function authorizeDepositor(address depositor) external onlySafe {
        if (depositor == address(0)) revert ZeroAddress();
        authorizedDepositors[depositor] = true;
    }

    function revokeDepositor(address depositor) external onlySafe {
        authorizedDepositors[depositor] = false;
    }

    // ── Deposit (FundingRound only) ─────────────────────────

    function depositFor(address beneficiary, uint256 amount) external nonReentrant {
        if (!authorizedDepositors[msg.sender]) revert NotAuthorizedDepositor();
        if (beneficiary == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();

        VestingSchedule storage schedule = schedules[beneficiary];
        if (schedule.totalAmount > 0) revert ScheduleAlreadyExists();

        idiaToken.safeTransferFrom(msg.sender, address(this), amount);

        schedule.totalAmount = amount;
        beneficiaries.push(beneficiary);
        totalVestingBalance += amount;

        emit VestingCreated(beneficiary, amount);
    }

    // ═══════════════════════════════════════════════════════
    // PUSH DISTRIBUTION (Edge function calls this monthly)
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Push unlocked tokens to investors in a batch.
     * @param fromIndex Start index (inclusive) in beneficiaries array
     * @param toIndex   End index (exclusive) in beneficiaries array
     *
     * @dev Call monthly via edge function:
     *      pushDistributionBatch(0, 50)
     *      pushDistributionBatch(50, 100)
     *      ...
     *
     *      SAFE TO CALL REPEATEDLY:
     *      - Investors with 0 claimable are skipped (no revert)
     *      - Overlapping ranges are safe: already-pushed amounts
     *        are tracked in `claimed`, so the math gives 0 claimable
     *      - Idempotent: calling the same range twice in the same month
     *        processes the first time and skips the second
     *
     *      ACCUMULATION:
     *      - If month 2 push is missed, month 3 push sends months 2+3
     *      - Nothing is ever lost
     */
    function pushDistributionBatch(
        uint256 fromIndex,
        uint256 toIndex
    ) external onlySafe nonReentrant whenNotPaused {
        if (vestingStartDate == 0) revert VestingNotStarted();
        if (fromIndex >= toIndex) revert InvalidRange();
        if (toIndex > beneficiaries.length) revert InvalidRange();

        uint256 processedCount = 0;
        uint256 totalPushed = 0;
        uint256 monthsUnlocked = _monthsElapsed();

        for (uint256 i = fromIndex; i < toIndex; i++) {
            address inv = beneficiaries[i];
            VestingSchedule storage schedule = schedules[inv];

            // Skip: no schedule, forfeited, or nothing to send
            if (schedule.totalAmount == 0 || schedule.forfeited) continue;

            uint256 vested = _vestedAmount(schedule);
            uint256 claimable = vested - schedule.claimed;

            if (claimable == 0) continue;

            schedule.claimed += claimable;
            totalVestingBalance -= claimable;

            idiaToken.safeTransfer(inv, claimable);

            emit TokensPushed(inv, claimable, schedule.claimed, monthsUnlocked);
            processedCount++;
            totalPushed += claimable;
        }

        emit BatchPushCompleted(fromIndex, toIndex, processedCount, totalPushed);
    }

    // ── Manual Claim (backup if edge function fails) ────────

    /// @notice Investors can still claim manually as a backup
    function claim() external nonReentrant whenNotPaused {
        if (vestingStartDate == 0) revert VestingNotStarted();

        VestingSchedule storage schedule = schedules[msg.sender];
        if (schedule.totalAmount == 0) revert NoVestingSchedule();
        if (schedule.forfeited) revert AlreadyForfeited();

        uint256 vested = _vestedAmount(schedule);
        uint256 claimable = vested - schedule.claimed;
        if (claimable == 0) revert NothingToClaim();

        schedule.claimed += claimable;
        totalVestingBalance -= claimable;

        idiaToken.safeTransfer(msg.sender, claimable);

        emit TokensClaimed(msg.sender, claimable, schedule.claimed);
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
    // MIGRATION (Safe only)
    // ═══════════════════════════════════════════════════════

    /**
     * @notice Migrate all remaining tokens to a new VestingManager.
     * @dev Steps for migration:
     *      1. Deploy new VestingManager
     *      2. Call pause() on this contract
     *      3. Call exportSchedules() to get all investor data
     *      4. Initialize new contract with the data
     *      5. Call migrateTokens(newContract) to transfer IDIA
     *      6. Authorize new contract, update FundingRound reference
     */
    function migrateTokens(address newContract) external onlySafe {
        if (!paused) revert ContractPaused();
        if (newContract == address(0)) revert ZeroAddress();

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance > 0) {
            idiaToken.safeTransfer(newContract, balance);
        }

        emit TokensMigrated(newContract, balance);
    }

    /**
     * @notice Export vesting schedules for migration to a new contract.
     * @dev Returns paginated data. Call with consecutive ranges.
     *      Gas-free view function — call off-chain.
     */
    function exportSchedules(
        uint256 fromIndex,
        uint256 toIndex
    ) external view returns (
        address[] memory addresses,
        uint256[] memory totalAmounts,
        uint256[] memory claimedAmounts,
        bool[] memory forfeitedFlags
    ) {
        if (toIndex > beneficiaries.length) toIndex = beneficiaries.length;
        uint256 count = toIndex - fromIndex;

        addresses = new address[](count);
        totalAmounts = new uint256[](count);
        claimedAmounts = new uint256[](count);
        forfeitedFlags = new bool[](count);

        for (uint256 i = 0; i < count; i++) {
            address inv = beneficiaries[fromIndex + i];
            VestingSchedule storage s = schedules[inv];
            addresses[i] = inv;
            totalAmounts[i] = s.totalAmount;
            claimedAmounts[i] = s.claimed;
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
        if (s.totalAmount == 0 || s.forfeited || vestingStartDate == 0) return 0;
        return _vestedAmount(s) - s.claimed;
    }

    function getSchedule(address beneficiary) external view returns (
        uint256 totalAmount,
        uint256 vestedAmount,
        uint256 claimedAmount,
        uint256 claimableAmount,
        uint256 unvestedAmount,
        uint256 monthsUnlocked,
        uint256 nextUnlockTimestamp,
        bool isForfeited
    ) {
        VestingSchedule storage s = schedules[beneficiary];
        totalAmount = s.totalAmount;
        vestedAmount = _vestedAmount(s);
        claimedAmount = s.claimed;
        claimableAmount = s.forfeited ? 0 : vestedAmount - claimedAmount;
        unvestedAmount = totalAmount - vestedAmount;
        isForfeited = s.forfeited;
        monthsUnlocked = _monthsElapsed();

        if (vestingStartDate > 0 && monthsUnlocked < VESTING_MONTHS) {
            nextUnlockTimestamp = vestingStartDate + ((monthsUnlocked + 1) * MONTH_DURATION);
        }
    }

    function getUnlockSchedule() external view returns (uint256[72] memory unlockDates) {
        for (uint256 i = 0; i < 72; i++) {
            unlockDates[i] = vestingStartDate + ((i + 1) * MONTH_DURATION);
        }
    }

    function getBeneficiaryCount() external view returns (uint256) {
        return beneficiaries.length;
    }

    // ── Internal ────────────────────────────────────────────

    function _monthsElapsed() internal view returns (uint256) {
        if (vestingStartDate == 0 || block.timestamp <= vestingStartDate) return 0;
        uint256 elapsed = block.timestamp - vestingStartDate;
        uint256 months = elapsed / MONTH_DURATION;
        return months > VESTING_MONTHS ? VESTING_MONTHS : months;
    }

    function _vestedAmount(VestingSchedule storage schedule) internal view returns (uint256) {
        if (schedule.totalAmount == 0) return 0;
        uint256 months = _monthsElapsed();
        if (months == 0) return 0;
        if (months >= VESTING_MONTHS) return schedule.totalAmount;
        return (schedule.totalAmount * months) / VESTING_MONTHS;
    }
}
