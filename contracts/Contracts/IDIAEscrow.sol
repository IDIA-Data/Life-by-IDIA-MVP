// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title IDIAEscrow
 * @author IDIA Data Inc.
 * @notice Escrow vault for a specific IDIA token allocation category.
 *         Supports two distribution modes:
 *
 *         1. MANUAL (2-of-2): Treasury proposes → Approver executes.
 *         2. AUTOMATED (single-tx): Relayer calls automatedDistribute().
 *
 * @dev Constructor-optimized: approvers and automatedDistributor are set
 *      at deployment time. Only initialize(tokenAddress) must be called
 *      post-deployment (because the token is deployed after the escrows).
 */
contract IDIAEscrow is Ownable {
    using SafeERC20 for IERC20;

    // ── Errors ──────────────────────────────────────────────
    error Escrow__ZeroAddress();
    error Escrow__ZeroAmount();
    error Escrow__AlreadyInitialized();
    error Escrow__NotInitialized();
    error Escrow__NotTreasury();
    error Escrow__NotApprover();
    error Escrow__NotAutomatedDistributor();
    error Escrow__ProposalNotFound(uint256 id);
    error Escrow__ProposalNotPending(uint256 id);
    error Escrow__InsufficientBalance(uint256 requested, uint256 available);
    error Escrow__ApproverAlreadyRegistered(address approver);
    error Escrow__ApproverNotRegistered(address approver);
    error Escrow__Migrated(address newEscrow);

    // ── Events ──────────────────────────────────────────────
    event Initialized(address indexed token);
    event ApproverAdded(address indexed approver);
    event ApproverRemoved(address indexed approver);
    event AutomatedDistributorUpdated(address indexed oldDistributor, address indexed newDistributor);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    event DistributionProposed(
        uint256 indexed proposalId,
        address indexed recipient,
        uint256 amount,
        string reason
    );
    event DistributionApproved(
        uint256 indexed proposalId,
        address indexed approvedBy,
        address indexed recipient,
        uint256 amount
    );
    event DistributionCancelled(uint256 indexed proposalId);
    event EscrowMigrated(
        address indexed oldEscrow,
        address indexed newEscrow,
        uint256 amount,
        uint256 timestamp
    );
    event AutomatedDistribution(
        uint256 indexed proposalId,
        address indexed recipient,
        uint256 amount,
        string reason,
        address indexed executor
    );

    // ── Proposal State ──────────────────────────────────────
    enum ProposalStatus { Pending, Executed, Cancelled }

    struct Proposal {
        address recipient;
        uint256 amount;
        string reason;
        ProposalStatus status;
        uint256 proposedAt;
        address proposedBy;
        address approvedBy;
        uint256 executedAt;
    }

    // ── State ───────────────────────────────────────────────
    string public category;
    IERC20 public idiaToken;
    bool public initialized;

    address public treasury;
    address public automatedDistributor;
    mapping(address => bool) public isApprover;
    address[] private _approverList;

    mapping(uint256 => Proposal) public proposals;
    uint256 public proposalCount;
    uint256 public totalDistributed;

    bool public migrated;
    address public migratedTo;

    // ── Modifiers ───────────────────────────────────────────
    modifier onlyTreasury() {
        if (msg.sender != treasury) revert Escrow__NotTreasury();
        _;
    }

    modifier onlyApprover() {
        if (!isApprover[msg.sender]) revert Escrow__NotApprover();
        _;
    }

    modifier onlyAutomatedDistributor() {
        if (msg.sender != automatedDistributor) revert Escrow__NotAutomatedDistributor();
        _;
    }

    modifier whenInitialized() {
        if (!initialized) revert Escrow__NotInitialized();
        _;
    }

    modifier whenNotMigrated() {
        if (migrated) revert Escrow__Migrated(migratedTo);
        _;
    }

    /**
     * @param _category              Category name (e.g., "Team & Advisors")
     * @param _owner                 Gnosis Safe address
     * @param _treasury              Wallet that can propose manual distributions
     * @param _automatedDistributor  Relayer wallet for autonomous distributions (address(0) to skip)
     * @param _approvers             Array of initial approver addresses for manual flow
     */
    constructor(
        string memory _category,
        address _owner,
        address _treasury,
        address _automatedDistributor,
        address[] memory _approvers
    ) Ownable(_owner) {
        if (_owner == address(0)) revert Escrow__ZeroAddress();
        if (_treasury == address(0)) revert Escrow__ZeroAddress();

        category = _category;
        treasury = _treasury;

        if (_automatedDistributor != address(0)) {
            automatedDistributor = _automatedDistributor;
            emit AutomatedDistributorUpdated(address(0), _automatedDistributor);
        }

        for (uint256 i = 0; i < _approvers.length; i++) {
            if (_approvers[i] != address(0) && !isApprover[_approvers[i]]) {
                isApprover[_approvers[i]] = true;
                _approverList.push(_approvers[i]);
                emit ApproverAdded(_approvers[i]);
            }
        }
    }

    // ── Initialization (post-deployment, after token exists) ─

    function initialize(address _token) external onlyOwner {
        if (initialized) revert Escrow__AlreadyInitialized();
        if (_token == address(0)) revert Escrow__ZeroAddress();

        idiaToken = IERC20(_token);
        initialized = true;
        emit Initialized(_token);
    }

    // ── Role Management (Owner only) ────────────────────────

    function addApprover(address approver) external onlyOwner {
        if (approver == address(0)) revert Escrow__ZeroAddress();
        if (isApprover[approver]) revert Escrow__ApproverAlreadyRegistered(approver);

        isApprover[approver] = true;
        _approverList.push(approver);
        emit ApproverAdded(approver);
    }

    function removeApprover(address approver) external onlyOwner {
        if (!isApprover[approver]) revert Escrow__ApproverNotRegistered(approver);

        isApprover[approver] = false;
        for (uint256 i = 0; i < _approverList.length; i++) {
            if (_approverList[i] == approver) {
                _approverList[i] = _approverList[_approverList.length - 1];
                _approverList.pop();
                break;
            }
        }
        emit ApproverRemoved(approver);
    }

    function getApprovers() external view returns (address[] memory) {
        return _approverList;
    }

    function updateTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert Escrow__ZeroAddress();
        emit TreasuryUpdated(treasury, newTreasury);
        treasury = newTreasury;
    }

    function setAutomatedDistributor(address _distributor) external onlyOwner {
        emit AutomatedDistributorUpdated(automatedDistributor, _distributor);
        automatedDistributor = _distributor;
    }

    // ── Manual Distribution: Propose ────────────────────────

    function proposeDistribution(
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyTreasury whenInitialized whenNotMigrated returns (uint256 proposalId) {
        if (recipient == address(0)) revert Escrow__ZeroAddress();
        if (amount == 0) revert Escrow__ZeroAmount();

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance < amount) {
            revert Escrow__InsufficientBalance(amount, balance);
        }

        proposalId = proposalCount++;

        proposals[proposalId] = Proposal({
            recipient: recipient,
            amount: amount,
            reason: reason,
            status: ProposalStatus.Pending,
            proposedAt: block.timestamp,
            proposedBy: msg.sender,
            approvedBy: address(0),
            executedAt: 0
        });

        emit DistributionProposed(proposalId, recipient, amount, reason);
    }

    // ── Manual Distribution: Approve & Execute ──────────────

    function approveAndExecute(uint256 proposalId)
        external onlyApprover whenInitialized whenNotMigrated
    {
        if (proposalId >= proposalCount) {
            revert Escrow__ProposalNotFound(proposalId);
        }

        Proposal storage p = proposals[proposalId];

        if (p.status != ProposalStatus.Pending) {
            revert Escrow__ProposalNotPending(proposalId);
        }

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance < p.amount) {
            revert Escrow__InsufficientBalance(p.amount, balance);
        }

        p.status = ProposalStatus.Executed;
        p.approvedBy = msg.sender;
        p.executedAt = block.timestamp;
        totalDistributed += p.amount;

        idiaToken.safeTransfer(p.recipient, p.amount);

        emit DistributionApproved(proposalId, msg.sender, p.recipient, p.amount);
    }

    // ── Automated Distribution (single-tx, relayer only) ────

    /**
     * @notice Distribute tokens autonomously in a single transaction.
     * @dev Called by the DELT Protocol relayer when a liability receipt
     *      is minted. Creates a proposal record for audit trail parity
     *      and immediately executes the transfer. No human intermediary.
     */
    function automatedDistribute(
        address recipient,
        uint256 amount,
        string calldata reason
    ) external onlyAutomatedDistributor whenInitialized whenNotMigrated returns (uint256 proposalId) {
        if (recipient == address(0)) revert Escrow__ZeroAddress();
        if (amount == 0) revert Escrow__ZeroAmount();

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance < amount) {
            revert Escrow__InsufficientBalance(amount, balance);
        }

        proposalId = proposalCount++;

        proposals[proposalId] = Proposal({
            recipient: recipient,
            amount: amount,
            reason: reason,
            status: ProposalStatus.Executed,
            proposedAt: block.timestamp,
            proposedBy: msg.sender,
            approvedBy: msg.sender,
            executedAt: block.timestamp
        });

        totalDistributed += amount;
        idiaToken.safeTransfer(recipient, amount);

        emit DistributionProposed(proposalId, recipient, amount, reason);
        emit DistributionApproved(proposalId, msg.sender, recipient, amount);
        emit AutomatedDistribution(proposalId, recipient, amount, reason, msg.sender);
    }

    // ── Cancel (Treasury only) ──────────────────────────────

    function cancelProposal(uint256 proposalId) external onlyTreasury whenNotMigrated {
        if (proposalId >= proposalCount) {
            revert Escrow__ProposalNotFound(proposalId);
        }

        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Pending) {
            revert Escrow__ProposalNotPending(proposalId);
        }

        p.status = ProposalStatus.Cancelled;
        emit DistributionCancelled(proposalId);
    }

    // ── Migration (Owner only) ────────────────────────────

    /**
     * @notice Migrate the full token balance to a new escrow contract.
     * @dev Transfers all IDIA tokens to the new address and permanently
     *      freezes this contract. All write functions will revert after
     *      migration. Read functions remain available for historical
     *      audit trail access (proposals, distribution history).
     *
     *      The new escrow must be initialized separately after receiving
     *      the tokens. Only the Safe (owner) can trigger migration.
     *
     * @param newEscrow The address of the replacement escrow contract.
     */
    function migrate(address newEscrow) external onlyOwner whenInitialized whenNotMigrated {
        if (newEscrow == address(0)) revert Escrow__ZeroAddress();
        if (newEscrow == address(this)) revert Escrow__ZeroAddress(); // can't migrate to self

        uint256 balance = idiaToken.balanceOf(address(this));
        if (balance == 0) revert Escrow__ZeroAmount();

        // Cancel any pending proposals before migrating
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].status == ProposalStatus.Pending) {
                proposals[i].status = ProposalStatus.Cancelled;
                emit DistributionCancelled(i);
            }
        }

        migrated = true;
        migratedTo = newEscrow;

        idiaToken.safeTransfer(newEscrow, balance);

        emit EscrowMigrated(address(this), newEscrow, balance, block.timestamp);
    }

    // ── Read Functions ──────────────────────────────────────

    function escrowBalance() external view returns (uint256) {
        if (!initialized) return 0;
        return idiaToken.balanceOf(address(this));
    }

    function remainingBalance() external view returns (uint256) {
        if (!initialized) return 0;
        return idiaToken.balanceOf(address(this));
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        if (proposalId >= proposalCount) {
            revert Escrow__ProposalNotFound(proposalId);
        }
        return proposals[proposalId];
    }

    function pendingProposalCount() external view returns (uint256 count) {
        for (uint256 i = 0; i < proposalCount; i++) {
            if (proposals[i].status == ProposalStatus.Pending) count++;
        }
    }
}
