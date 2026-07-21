// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorCountingSimple.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";

/**
 * @title IDIAGovernor (v3 — Adjustable Quorum)
 * @author IDIA Data Inc.
 *
 * @notice On-chain governance for the IDIA Protocol under the Wyoming DUNA
 *         framework. Replaces GovernorVotesQuorumFraction (% of total supply)
 *         with an adjustable absolute quorum that can be changed via governance
 *         proposals.
 *
 * @dev Quorum model:
 *
 *      GovernorVotesQuorumFraction calculated quorum as:
 *        quorum = totalSupply × 4% = 400,000,000 IDIA (unreachable)
 *
 *      This contract uses an adjustable absolute threshold:
 *        quorum = quorumThreshold (e.g., 1,000 IDIA to start)
 *
 *      How quorum is changed:
 *        1. Someone creates a proposal: "Call updateQuorum(10000)"
 *        2. Voting happens (7 days). Current quorum must be met.
 *        3. Proposal queues in Timelock (48-hour delay).
 *        4. After delay, execute() calls Governor.updateQuorum(10000).
 *        5. Quorum is now 10,000 IDIA. Fully self-governing.
 *
 *      Safety:
 *        - quorumFloor: quorum can never be set below this (prevents 1-token capture)
 *        - quorumCeiling: quorum can never exceed this (prevents permanent lockout)
 *        - Safe retains emergencyUpdateQuorum() for crisis intervention
 *
 *      Block-timing calibrated for Base L2 (~2s blocks):
 *        - Voting Delay:  43200 blocks ≈ 1 day
 *        - Voting Period: 302400 blocks ≈ 7 days
 *        - Proposal Threshold: 0 (any token holder can propose)
 *
 *      Built for OpenZeppelin Contracts v5.x (Governor v2).
 *
 * Compiler: 0.8.24, cancun, optimization 200, viaIR on
 */
contract IDIAGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingSimple,
    GovernorVotes,
    GovernorTimelockControl
{
    // ── Errors ──────────────────────────────────────────────
    error NotExecutor();
    error NotSafe();
    error BelowFloor(uint256 proposed, uint256 floor);
    error AboveCeiling(uint256 proposed, uint256 ceiling);

    // ── Events ──────────────────────────────────────────────
    event QuorumUpdated(uint256 oldQuorum, uint256 newQuorum, string method);
    event QuorumFloorUpdated(uint256 oldFloor, uint256 newFloor);
    event QuorumCeilingUpdated(uint256 oldCeiling, uint256 newCeiling);

    // ── State ───────────────────────────────────────────────

    /// @notice The Safe address for emergency quorum overrides.
    address public immutable safe;

    /// @notice Current absolute quorum threshold (in token units with 18 decimals).
    ///         A proposal needs this many votes to be valid.
    uint256 public quorumThreshold;

    /// @notice Minimum quorum. Prevents a governance attack that lowers
    ///         quorum to 1 token, allowing a single holder to pass proposals.
    uint256 public quorumFloor;

    /// @notice Maximum quorum. Prevents an attack that raises quorum so high
    ///         that no proposal can ever pass again (permanent lockout).
    uint256 public quorumCeiling;

    // ── Constructor ─────────────────────────────────────────

    /**
     * @param _token          IDIA ERC20Votes token contract
     * @param _timelock       TimelockController that gates execution
     * @param _safe           Gnosis Safe for emergency quorum override
     * @param _initialQuorum  Starting quorum (e.g., 1000e18 = 1,000 IDIA)
     * @param _quorumFloor    Minimum quorum allowed (e.g., 100e18 = 100 IDIA) 5000000000000000000000 5000
     * @param _quorumCeiling  Maximum quorum allowed (e.g., 100_000_000e18 = 100M IDIA) 100000000000000000000000000
     */
    constructor(
        IVotes _token,
        TimelockController _timelock,
        address _safe,
        uint256 _initialQuorum,
        uint256 _quorumFloor,
        uint256 _quorumCeiling
    )
        Governor("IDIAGovernor")
        GovernorSettings(
            43200,   // votingDelay:  ~1 day at 2s/block on Base
            302400,  // votingPeriod: ~7 days at 2s/block on Base
            0        // proposalThreshold: 0 tokens required to propose
        )
        GovernorVotes(_token)
        GovernorTimelockControl(_timelock)
    {
        require(_safe != address(0), "Zero safe address");
        require(_quorumFloor <= _initialQuorum, "Initial below floor");
        require(_initialQuorum <= _quorumCeiling, "Initial above ceiling");
        require(_quorumFloor > 0, "Floor must be > 0");

        safe = _safe;
        quorumThreshold = _initialQuorum;
        quorumFloor = _quorumFloor;
        quorumCeiling = _quorumCeiling;

        emit QuorumUpdated(0, _initialQuorum, "constructor");
    }

    // ── Quorum Override ─────────────────────────────────────

    /**
     * @notice Returns the current quorum requirement.
     * @dev Replaces GovernorVotesQuorumFraction's percentage-of-total-supply
     *      with a simple absolute threshold. The blockNumber parameter is
     *      accepted for interface compatibility but not used (quorum is
     *      the same regardless of which block a proposal was created at).
     */
    function quorum(uint256 /* blockNumber */)
        public view override(Governor)
        returns (uint256)
    {
        return quorumThreshold;
    }

    // ── Quorum Updates (via governance proposal) ────────────

    /**
     * @notice Update the quorum threshold. Callable ONLY through a
     *         governance proposal that passes and executes via the Timelock.
     *
     * @dev To change quorum from 1,000 to 10,000 IDIA:
     *      1. Create proposal with target = Governor address,
     *         calldata = abi.encodeCall(updateQuorum, (10000e18))
     *      2. Vote during the 7-day window (need 1,000 IDIA quorum)
     *      3. Queue in Timelock (48-hour delay)
     *      4. Execute → Timelock calls this function → quorum = 10,000
     */
    function updateQuorum(uint256 _newQuorum) external {
        if (msg.sender != _executor()) revert NotExecutor();
        if (_newQuorum < quorumFloor) revert BelowFloor(_newQuorum, quorumFloor);
        if (_newQuorum > quorumCeiling) revert AboveCeiling(_newQuorum, quorumCeiling);

        uint256 old = quorumThreshold;
        quorumThreshold = _newQuorum;
        emit QuorumUpdated(old, _newQuorum, "governance");
    }

    /**
     * @notice Update the quorum floor. Also callable only via governance.
     */
    function updateQuorumFloor(uint256 _newFloor) external {
        if (msg.sender != _executor()) revert NotExecutor();
        require(_newFloor > 0, "Floor must be > 0");
        require(_newFloor <= quorumThreshold, "Floor exceeds current quorum");

        uint256 old = quorumFloor;
        quorumFloor = _newFloor;
        emit QuorumFloorUpdated(old, _newFloor);
    }

    /**
     * @notice Update the quorum ceiling. Also callable only via governance.
     */
    function updateQuorumCeiling(uint256 _newCeiling) external {
        if (msg.sender != _executor()) revert NotExecutor();
        require(_newCeiling >= quorumThreshold, "Ceiling below current quorum");

        uint256 old = quorumCeiling;
        quorumCeiling = _newCeiling;
        emit QuorumCeilingUpdated(old, _newCeiling);
    }

    // ── Emergency Override (Safe only) ──────────────────────

    /**
     * @notice Emergency quorum override. Callable ONLY by the Safe.
     * @dev Use only in crisis situations (governance attack, quorum set
     *      too high to pass any proposals, etc.). Still respects floor
     *      and ceiling bounds.
     */
    function emergencyUpdateQuorum(uint256 _newQuorum) external {
        if (msg.sender != safe) revert NotSafe();
        if (_newQuorum < quorumFloor) revert BelowFloor(_newQuorum, quorumFloor);
        if (_newQuorum > quorumCeiling) revert AboveCeiling(_newQuorum, quorumCeiling);

        uint256 old = quorumThreshold;
        quorumThreshold = _newQuorum;
        emit QuorumUpdated(old, _newQuorum, "emergency");
    }

    // ── View Helpers ────────────────────────────────────────

    /**
     * @notice Returns quorum parameters for frontends.
     */
    function getQuorumParams() external view returns (
        uint256 currentQuorum,
        uint256 floor,
        uint256 ceiling,
        address safeAddress
    ) {
        return (quorumThreshold, quorumFloor, quorumCeiling, safe);
    }

    // ── Required overrides (OZ 5.x diamond resolution) ─────

    function votingDelay()
        public view override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingDelay();
    }

    function votingPeriod()
        public view override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.votingPeriod();
    }

    function state(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl)
        returns (ProposalState)
    {
        return super.state(proposalId);
    }

    function proposalThreshold()
        public view override(Governor, GovernorSettings)
        returns (uint256)
    {
        return super.proposalThreshold();
    }

    function proposalNeedsQueuing(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl)
        returns (bool)
    {
        return super.proposalNeedsQueuing(proposalId);
    }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint48) {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl) returns (uint256) {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal view override(Governor, GovernorTimelockControl)
        returns (address)
    {
        return super._executor();
    }
}
