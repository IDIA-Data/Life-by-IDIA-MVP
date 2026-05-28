/**
 * Governance Service — Reads proposals from Supabase (indexed by edge function),
 * fetches live vote state from on-chain, and writes to the Governor contract.
 */

import { ethers } from 'ethers';
import { walletService, NETWORKS } from './walletService';
import { supabase } from '../integrations/supabase/client';
import {
  PROTOCOL,
  ACTIVE_DEPLOYMENT,
  GOVERNOR_ABI,
  IDIA_TOKEN_ABI,
  PROPOSAL_STATES,
  BLOCKS_PER_DAY,
} from '../config/contracts';

// ── Types ────────────────────────────────────────────────────────────

export interface ProposalOnChain {
  proposalId: string;
  proposer: string;
  description: string;
  title: string;
  state: number;
  stateName: string;
  forVotes: string;
  againstVotes: string;
  abstainVotes: string;
  voteStart: number;
  voteEnd: number;
  hasVoted: boolean;
  targets: string[];
  values: string[];
  calldatas: string[];
  blockCreated: number;
  txHash: string | null;
}

export interface GovernorParams {
  votingDelay: number;
  votingPeriod: number;
  proposalThreshold: string;
  quorumNumerator: number;
  quorumDenominator: number;
  minVotingDelay: number;
  maxVotingDelay: number;
  minVotingPeriod: number;
  maxVotingPeriod: number;
  isPaused: boolean;
}

// ── Service ──────────────────────────────────────────────────────────

class GovernanceService {

  // Cache provider so all calls share one instance
  private _provider: ethers.JsonRpcProvider | null = null;

  private getProvider(): ethers.JsonRpcProvider {
    if (!this._provider) {
      const networkKey = ACTIVE_DEPLOYMENT === 'mainnet' ? 'base' : 'baseSepolia';
      const network = NETWORKS[networkKey];
      this._provider = new ethers.JsonRpcProvider(network.rpcUrl, network.chainId, {
        batchMaxCount: 5,
      });
    }
    return this._provider;
  }

  private getGovernorReadOnly(): ethers.Contract {
    return new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, this.getProvider());
  }

  private getTokenReadOnly(): ethers.Contract {
    return new ethers.Contract(PROTOCOL.idiaToken, IDIA_TOKEN_ABI, this.getProvider());
  }

  // Small delay to avoid RPC rate limits
  private delay(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms));
  }

  // ── Read: Governor Parameters ─────────────────────────────

  async getGovernorParams(): Promise<GovernorParams> {
    const gov = this.getGovernorReadOnly();

    // Batch 1: 5 calls
    const [votingDelay, votingPeriod, proposalThreshold, quorumNumerator, quorumDenominator] =
      await Promise.all([
        gov.votingDelay(),
        gov.votingPeriod(),
        gov.proposalThreshold(),
        gov.quorumNumerator(),
        gov['QUORUM_DENOMINATOR'](),
      ]);

    await this.delay(300);

    // Batch 2: 5 calls
    const [minVotingDelay, maxVotingDelay, minVotingPeriod, maxVotingPeriod, isPaused] =
      await Promise.all([
        gov.minVotingDelay(),
        gov.maxVotingDelay(),
        gov.minVotingPeriod(),
        gov.maxVotingPeriod(),
        gov.proposalsPaused(),
      ]);

    return {
      votingDelay: Number(votingDelay),
      votingPeriod: Number(votingPeriod),
      proposalThreshold: ethers.formatEther(proposalThreshold),
      quorumNumerator: Number(quorumNumerator),
      quorumDenominator: Number(quorumDenominator),
      minVotingDelay: Number(minVotingDelay),
      maxVotingDelay: Number(maxVotingDelay),
      minVotingPeriod: Number(minVotingPeriod),
      maxVotingPeriod: Number(maxVotingPeriod),
      isPaused,
    };
  }

  // ── Read: Current quorum requirement ──────────────────────

  async getCurrentQuorum(): Promise<string> {
    const gov = this.getGovernorReadOnly();
    const provider = this.getProvider();
    const blockNumber = await provider.getBlockNumber();
    try {
      const quorum = await gov.quorum(blockNumber - 1);
      return ethers.formatEther(quorum);
    } catch {
      return '0';
    }
  }

  // ── Read: Delegation info ─────────────────────────────────

  async getDelegationInfo(address: string): Promise<{
    balance: string;
    votingPower: string;
    delegatee: string;
    isDelegated: boolean;
    isSelfDelegated: boolean;
  }> {
    const token = this.getTokenReadOnly();

    // Sequential calls to avoid rate limits
    const balance = await token.balanceOf(address);
    const votes = await token.getVotes(address);
    const delegatee = await token.delegates(address);

    const isDelegated = delegatee !== ethers.ZeroAddress;
    const isSelfDelegated = delegatee.toLowerCase() === address.toLowerCase();

    return {
      balance: ethers.formatEther(balance),
      votingPower: ethers.formatEther(votes),
      delegatee,
      isDelegated,
      isSelfDelegated,
    };
  }

  // ── Read: Proposals from Database ─────────────────────────

  async getRecentProposals(address: string): Promise<ProposalOnChain[]> {
    const network = ACTIVE_DEPLOYMENT === 'mainnet' ? 'mainnet' : 'testnet';

    console.log(`[GovernanceService] Fetching proposals from database (network: ${network})`);

    // Read from the governance_proposals table (populated by the indexer edge function)
    const { data: dbProposals, error } = await supabase
      .from('governance_proposals')
      .select('*')
      .eq('network', network)
      .order('block_created', { ascending: false });

    if (error) {
      console.error('[GovernanceService] Database query failed:', error.message);
      return [];
    }

    if (!dbProposals || dbProposals.length === 0) {
      console.log('[GovernanceService] No proposals in database');
      return [];
    }

    console.log(`[GovernanceService] Found ${dbProposals.length} proposals in database`);

    // For each proposal, check if the current user has voted (live from chain)
    // Do this sequentially to avoid rate limits
    const gov = this.getGovernorReadOnly();
    const proposals: ProposalOnChain[] = [];

    for (const row of dbProposals) {
      let hasVoted = false;
      if (address) {
        try {
          hasVoted = await gov.hasVoted(row.proposal_id, address);
          // Small delay between hasVoted calls to avoid rate limits
          if (dbProposals.length > 3) {
            await this.delay(200);
          }
        } catch {
          // If hasVoted call fails, assume not voted
        }
      }

      proposals.push({
        proposalId: row.proposal_id,
        proposer: row.proposer,
        description: row.description,
        title: row.title || row.description.split('\n')[0].replace(/^#\s*/, '').slice(0, 120),
        state: row.state,
        stateName: row.state_name || PROPOSAL_STATES[row.state] || 'Unknown',
        forVotes: row.for_votes || '0',
        againstVotes: row.against_votes || '0',
        abstainVotes: row.abstain_votes || '0',
        voteStart: row.vote_start,
        voteEnd: row.vote_end,
        hasVoted,
        targets: row.targets || [],
        values: row.callvalues || [],
        calldatas: row.calldatas || [],
        blockCreated: row.block_created,
        txHash: row.tx_hash,
      });
    }

    return proposals;
  }

  // ── Read: Single proposal state (live from chain) ─────────

  async getProposalState(proposalId: string): Promise<{
    state: number;
    stateName: string;
    forVotes: string;
    againstVotes: string;
    abstainVotes: string;
  }> {
    const gov = this.getGovernorReadOnly();

    const state = await gov.state(proposalId);
    await this.delay(200);
    const votes = await gov.proposalVotes(proposalId);

    return {
      state: Number(state),
      stateName: PROPOSAL_STATES[Number(state)] || 'Unknown',
      againstVotes: ethers.formatEther(votes[0]),
      forVotes: ethers.formatEther(votes[1]),
      abstainVotes: ethers.formatEther(votes[2]),
    };
  }

  // ── Write: Create proposal (default timing) ───────────────

  async propose(
    description: string,
    targets: string[] = [PROTOCOL.idiaToken],
    values: string[] = ['0'],
    calldatas: string[] = ['0x'],
  ): Promise<{ hash: string; proposalId?: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error('Wallet not connected');

    const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, signer);
    const tx = await gov.propose(
      targets,
      values.map(v => BigInt(v)),
      calldatas,
      description,
    );
    const receipt = await tx.wait();
    const proposalId = this.extractProposalIdFromReceipt(receipt);

    // Trigger the indexer to pick up the new proposal immediately
    this.triggerIndexer().catch(() => {});

    return { hash: tx.hash, proposalId };
  }

  // ── Write: Create proposal with custom timing ─────────────

  async proposeWithTiming(
    description: string,
    customDelay: number,
    customPeriod: number,
    targets: string[] = [PROTOCOL.idiaToken],
    values: string[] = ['0'],
    calldatas: string[] = ['0x'],
  ): Promise<{ hash: string; proposalId?: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error('Wallet not connected');

    const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, signer);
    const tx = await gov.proposeWithTiming(
      targets,
      values.map(v => BigInt(v)),
      calldatas,
      description,
      customDelay,
      customPeriod,
    );
    const receipt = await tx.wait();
    const proposalId = this.extractProposalIdFromReceipt(receipt);

    // Trigger the indexer to pick up the new proposal immediately
    this.triggerIndexer().catch(() => {});

    return { hash: tx.hash, proposalId };
  }

  // ── Write: Cast vote ──────────────────────────────────────

  async castVote(
    proposalId: string,
    support: 0 | 1 | 2, // 0=Against, 1=For, 2=Abstain
    reason?: string,
  ): Promise<{ hash: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error('Wallet not connected');

    const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, signer);

    const tx = reason
      ? await gov.castVoteWithReason(proposalId, support, reason)
      : await gov.castVote(proposalId, support);

    await tx.wait();

    // Trigger the indexer to update vote tallies
    this.triggerIndexer().catch(() => {});

    return { hash: tx.hash };
  }

  // ── Write: Delegate ───────────────────────────────────────

  async delegate(delegatee: string): Promise<{ hash: string }> {
    const signer = walletService.getConnectedSigner();
    if (!signer) throw new Error('Wallet not connected');

    const token = new ethers.Contract(PROTOCOL.idiaToken, IDIA_TOKEN_ABI, signer);
    const tx = await token.delegate(delegatee);
    await tx.wait();
    return { hash: tx.hash };
  }

  async selfDelegate(): Promise<{ hash: string }> {
    const address = walletService.getAddress();
    if (!address) throw new Error('Wallet not connected');
    return this.delegate(address);
  }

  async undelegate(): Promise<{ hash: string }> {
    return this.delegate(ethers.ZeroAddress);
  }

  // ── Helpers ───────────────────────────────────────────────

  private extractProposalIdFromReceipt(receipt: ethers.TransactionReceipt): string | undefined {
    try {
      const govInterface = new ethers.Interface(GOVERNOR_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = govInterface.parseLog({ topics: log.topics as string[], data: log.data });
          if (parsed?.name === 'ProposalCreated') {
            return parsed.args[0].toString();
          }
        } catch { /* not our event */ }
      }
    } catch { /* parse failed */ }
    return undefined;
  }

  /**
   * Trigger the governance-indexer edge function to run immediately.
   * Used after creating a proposal or casting a vote so the DB
   * reflects the new state without waiting for the next cron run.
   */
  private async triggerIndexer(): Promise<void> {
    try {
      await supabase.functions.invoke('governance-indexer', {
        body: {},
      });
      console.log('[GovernanceService] Indexer triggered');
    } catch (e: any) {
      console.warn('[GovernanceService] Failed to trigger indexer:', e.message);
    }
  }
}

export const governanceService = new GovernanceService();