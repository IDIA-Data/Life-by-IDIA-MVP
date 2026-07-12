// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title IDIA Governance Token
 * @author IDIA Data Inc.
 * @notice Participatory utility token for the IDIA Governance Protocol.
 *         Wyoming DUNA compliant. 10B total supply minted at deployment
 *         directly to 5 escrow contracts per the allocation schedule:
 *
 *           Team & Advisors ........  15%  =  1,500,000,000 IDIA
 *           Ecosystem / Treasury ...  30%  =  3,000,000,000 IDIA
 *           Liquidity & Staking ....  35%  =  3,500,000,000 IDIA
 *           Early Investors ........  10%  =  1,000,000,000 IDIA
 *           Public Sale / Airdrop ..  10%  =  1,000,000,000 IDIA
 *                                   ────    ───────────────
 *                                   100%   10,000,000,000 IDIA
 *
 * @dev Standards: ERC20 + ERC20Votes + ERC20Permit + ERC20Burnable
 *      - ERC20Votes enables on-chain governance (delegate, getVotes)
 *      - ERC20Permit enables gasless approvals via EIP-2612
 *      - ERC20Burnable enables deflationary mechanics
 *      - Ownable gates admin functions to the Multi-sig (Gnosis Safe)
 */
contract IDIA is ERC20, ERC20Burnable, ERC20Votes, ERC20Permit, Ownable {

    // ── Errors ──────────────────────────────────────────────
    error IDIA__ZeroAddressIllegal();

    // ── Events (granular stall-protection logging) ──────────
    event MintSequenceStarted(uint256 totalSupply);
    event EscrowFunded(string category, address indexed escrow, uint256 amount);
    event MintSequenceFinished(uint256 totalSupply);
    event GovernancePulseStarted(bytes32 indexed callId);
    event GovernancePulseFinished(bytes32 indexed callId);

    // ── Constants ───────────────────────────────────────────
    uint256 public constant TOTAL_SUPPLY = 10_000_000_000;

    uint256 public constant TEAM_ADVISORS_PCT     = 15;
    uint256 public constant ECOSYSTEM_TREASURY_PCT = 30;
    uint256 public constant LIQUIDITY_STAKING_PCT  = 35;
    uint256 public constant EARLY_INVESTORS_PCT    = 10;
    uint256 public constant PUBLIC_AIRDROP_PCT     = 10;

    // ── Escrow addresses (immutable after deployment) ───────
    address public immutable teamEscrow;
    address public immutable ecosystemEscrow;
    address public immutable liquidityEscrow;
    address public immutable investorEscrow;
    address public immutable publicEscrow;

    /**
     * @param _teamEscrow      Escrow for Team & Advisors (15%)
     * @param _ecosystemEscrow Escrow for Ecosystem / Treasury Fund (30%)
     * @param _liquidityEscrow Escrow for Liquidity & Staking Rewards (35%)
     * @param _investorEscrow  Escrow for Early Investors (10%)
     * @param _publicEscrow    Escrow for Public Sale / Airdrop (10%)
     * @param _protocolOwner   The Gnosis Safe (Multi-sig) for admin functions
     */
    constructor(
        address _teamEscrow,
        address _ecosystemEscrow,
        address _liquidityEscrow,
        address _investorEscrow,
        address _publicEscrow,
        address _protocolOwner
    )
        ERC20("IDIA Token", "IDIA")
        ERC20Permit("IDIA Token")
        Ownable(_protocolOwner)
    {
        if (_teamEscrow == address(0))      revert IDIA__ZeroAddressIllegal();
        if (_ecosystemEscrow == address(0)) revert IDIA__ZeroAddressIllegal();
        if (_liquidityEscrow == address(0)) revert IDIA__ZeroAddressIllegal();
        if (_investorEscrow == address(0))  revert IDIA__ZeroAddressIllegal();
        if (_publicEscrow == address(0))    revert IDIA__ZeroAddressIllegal();
        if (_protocolOwner == address(0))   revert IDIA__ZeroAddressIllegal();

        teamEscrow      = _teamEscrow;
        ecosystemEscrow = _ecosystemEscrow;
        liquidityEscrow = _liquidityEscrow;
        investorEscrow  = _investorEscrow;
        publicEscrow    = _publicEscrow;

        uint256 unit = TOTAL_SUPPLY * 10 ** decimals() / 100;

        emit MintSequenceStarted(TOTAL_SUPPLY);

        _mint(_teamEscrow,      unit * TEAM_ADVISORS_PCT);
        emit EscrowFunded("Team & Advisors", _teamEscrow, unit * TEAM_ADVISORS_PCT);

        _mint(_ecosystemEscrow, unit * ECOSYSTEM_TREASURY_PCT);
        emit EscrowFunded("Ecosystem / Treasury", _ecosystemEscrow, unit * ECOSYSTEM_TREASURY_PCT);

        _mint(_liquidityEscrow, unit * LIQUIDITY_STAKING_PCT);
        emit EscrowFunded("Liquidity & Staking", _liquidityEscrow, unit * LIQUIDITY_STAKING_PCT);

        _mint(_investorEscrow,  unit * EARLY_INVESTORS_PCT);
        emit EscrowFunded("Early Investors", _investorEscrow, unit * EARLY_INVESTORS_PCT);

        _mint(_publicEscrow,    unit * PUBLIC_AIRDROP_PCT);
        emit EscrowFunded("Public Sale / Airdrop", _publicEscrow, unit * PUBLIC_AIRDROP_PCT);

        emit MintSequenceFinished(TOTAL_SUPPLY);
    }

    /**
     * @notice Bridge for the Life App Governance Tab to signal on-chain
     *         governance state updates via the Synapse Engine.
     */
    function syncGovernanceState(bytes32 callId) external onlyOwner {
        emit GovernancePulseStarted(callId);
        emit GovernancePulseFinished(callId);
    }

    // ── Required overrides for multiple inheritance ─────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
