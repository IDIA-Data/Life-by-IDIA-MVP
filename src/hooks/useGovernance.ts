/**
 * useGovernance — React hook for on-chain governance interactions.
 *
 * Loads all governance data sequentially with delays between groups
 * to stay within Base free RPC rate limits.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  governanceService,
  ProposalOnChain,
  GovernorParams,
} from '../services/governanceService';
import { walletService } from '../services/walletService';
import { toast } from './use-toast';

interface UseGovernanceReturn {
  // State
  proposals: ProposalOnChain[];
  params: GovernorParams | null;
  currentQuorum: string;
  delegation: {
    balance: string;
    votingPower: string;
    delegatee: string;
    isDelegated: boolean;
    isSelfDelegated: boolean;
  } | null;
  loading: boolean;
  error: string | null;

  // Actions
  refreshProposals: () => Promise<void>;
  castVote: (proposalId: string, support: 0 | 1 | 2, reason?: string) => Promise<boolean>;
  createProposal: (description: string) => Promise<string | null>;
  createProposalWithTiming: (description: string, delayBlocks: number, periodBlocks: number) => Promise<string | null>;
  selfDelegate: () => Promise<boolean>;
  delegateTo: (address: string) => Promise<boolean>;
  undelegate: () => Promise<boolean>;
  refreshDelegation: () => Promise<void>;
}

export function useGovernance(): UseGovernanceReturn {
  const [proposals, setProposals] = useState<ProposalOnChain[]>([]);
  const [params, setParams] = useState<GovernorParams | null>(null);
  const [currentQuorum, setCurrentQuorum] = useState('0');
  const [delegation, setDelegation] = useState<UseGovernanceReturn['delegation']>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const address = walletService.getAddress();

  // Small delay helper
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

  // ── Load everything sequentially to avoid RPC rate limits ──

  const loadAll = useCallback(async () => {
    if (!address) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // 1. Governor params (10 RPC calls in 2 batches of 5, with delay between)
    try {
      const p = await governanceService.getGovernorParams();
      setParams(p);
    } catch (e: any) {
      console.warn('[useGovernance] Failed to load params:', e.message);
    }

    await delay(500);

    // 2. Current quorum (2 RPC calls: getBlockNumber + quorum)
    try {
      const q = await governanceService.getCurrentQuorum();
      setCurrentQuorum(q);
    } catch (e: any) {
      console.warn('[useGovernance] Failed to load quorum:', e.message);
    }

    await delay(500);

    // 3. Delegation info (3 sequential RPC calls)
    try {
      const info = await governanceService.getDelegationInfo(address);
      setDelegation(info);
    } catch (e: any) {
      console.warn('[useGovernance] Failed to load delegation:', e.message);
    }

    await delay(300);

    // 4. Proposals from DB + hasVoted per proposal (1 DB query + N sequential RPC calls)
    try {
      const props = await governanceService.getRecentProposals(address);
      setProposals(props);
    } catch (e: any) {
      console.error('[useGovernance] Failed to load proposals:', e.message);
      setError(e.message);
    }

    setLoading(false);
  }, [address]);

  // Initial load
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Targeted refresh functions ────────────────────────────

  const refreshProposals = useCallback(async () => {
    if (!address) return;
    setError(null);
    try {
      const props = await governanceService.getRecentProposals(address);
      setProposals(props);
    } catch (e: any) {
      console.error('[useGovernance] Failed to refresh proposals:', e.message);
      setError(e.message);
    }
  }, [address]);

  const refreshDelegation = useCallback(async () => {
    if (!address) return;
    try {
      const info = await governanceService.getDelegationInfo(address);
      setDelegation(info);
    } catch (e: any) {
      console.warn('[useGovernance] Failed to refresh delegation:', e.message);
    }
  }, [address]);

  // ── Actions ───────────────────────────────────────────────

  const castVote = useCallback(async (
    proposalId: string,
    support: 0 | 1 | 2,
    reason?: string,
  ): Promise<boolean> => {
    try {
      const { hash } = await governanceService.castVote(proposalId, support, reason);
      toast({
        title: 'Vote Cast',
        description: `${['Against', 'For', 'Abstain'][support]} vote recorded. TX: ${hash.slice(0, 10)}...`,
      });
      // Wait a moment for the indexer to process, then refresh
      await delay(2000);
      await refreshProposals();
      return true;
    } catch (e: any) {
      toast({
        title: 'Vote Failed',
        description: e.reason || e.message,
        variant: 'destructive',
      });
      return false;
    }
  }, [refreshProposals]);

  const createProposal = useCallback(async (description: string): Promise<string | null> => {
    try {
      const { hash, proposalId } = await governanceService.propose(description);
      toast({
        title: 'Proposal Created',
        description: `ID: ${proposalId?.slice(0, 12)}... TX: ${hash.slice(0, 10)}...`,
      });
      // Wait for indexer to pick it up
      await delay(3000);
      await refreshProposals();
      return proposalId || null;
    } catch (e: any) {
      toast({
        title: 'Proposal Failed',
        description: e.reason || e.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [refreshProposals]);

  const createProposalWithTiming = useCallback(async (
    description: string,
    delayBlocks: number,
    periodBlocks: number,
  ): Promise<string | null> => {
    try {
      const { hash, proposalId } = await governanceService.proposeWithTiming(
        description, delayBlocks, periodBlocks,
      );
      toast({
        title: 'Proposal Created',
        description: `Custom timing set. TX: ${hash.slice(0, 10)}...`,
      });
      // Wait for indexer to pick it up
      await delay(3000);
      await refreshProposals();
      return proposalId || null;
    } catch (e: any) {
      toast({
        title: 'Proposal Failed',
        description: e.reason || e.message,
        variant: 'destructive',
      });
      return null;
    }
  }, [refreshProposals]);

  const selfDelegate = useCallback(async (): Promise<boolean> => {
    try {
      await governanceService.selfDelegate();
      toast({ title: 'Delegated', description: 'Voting power activated (self-delegation).' });
      await delay(1000);
      await refreshDelegation();
      return true;
    } catch (e: any) {
      toast({ title: 'Delegation Failed', description: e.reason || e.message, variant: 'destructive' });
      return false;
    }
  }, [refreshDelegation]);

  const delegateTo = useCallback(async (target: string): Promise<boolean> => {
    try {
      await governanceService.delegate(target);
      toast({ title: 'Delegated', description: `Voting power delegated to ${target.slice(0, 8)}...` });
      await delay(1000);
      await refreshDelegation();
      return true;
    } catch (e: any) {
      toast({ title: 'Delegation Failed', description: e.reason || e.message, variant: 'destructive' });
      return false;
    }
  }, [refreshDelegation]);

  const undelegate = useCallback(async (): Promise<boolean> => {
    try {
      await governanceService.undelegate();
      toast({ title: 'Undelegated', description: 'Voting power deactivated.' });
      await delay(1000);
      await refreshDelegation();
      return true;
    } catch (e: any) {
      toast({ title: 'Undelegation Failed', description: e.reason || e.message, variant: 'destructive' });
      return false;
    }
  }, [refreshDelegation]);

  return {
    proposals,
    params,
    currentQuorum,
    delegation,
    loading,
    error,
    refreshProposals,
    castVote,
    createProposal,
    createProposalWithTiming,
    selfDelegate,
    delegateTo,
    undelegate,
    refreshDelegation,
  };
}