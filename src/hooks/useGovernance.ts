/**
 * useGovernance — React hook for on-chain governance interactions.
 *
 * Provides proposal listing, voting, delegation, and proposal creation
 * all connected to the deployed IDIAGovernor contract.
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

  // Fetch governance parameters
  useEffect(() => {
    (async () => {
      try {
        const [p, q] = await Promise.all([
          governanceService.getGovernorParams(),
          governanceService.getCurrentQuorum(),
        ]);
        setParams(p);
        setCurrentQuorum(q);
      } catch (e: any) {
        console.warn('[useGovernance] Failed to load params:', e.message);
      }
    })();
  }, []);

  // Fetch proposals
  const refreshProposals = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const props = await governanceService.getRecentProposals(address);
      setProposals(props);
    } catch (e: any) {
      console.error('[useGovernance] Failed to load proposals:', e.message);
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (address) refreshProposals();
  }, [address, refreshProposals]);

  // Fetch delegation
  const refreshDelegation = useCallback(async () => {
    if (!address) return;
    try {
      const info = await governanceService.getDelegationInfo(address);
      setDelegation(info);
    } catch (e: any) {
      console.warn('[useGovernance] Failed to load delegation:', e.message);
    }
  }, [address]);

  useEffect(() => {
    if (address) refreshDelegation();
  }, [address, refreshDelegation]);

  // Cast vote
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

  // Create proposal (default timing)
  const createProposal = useCallback(async (description: string): Promise<string | null> => {
    try {
      const { hash, proposalId } = await governanceService.propose(description);
      toast({
        title: 'Proposal Created',
        description: `ID: ${proposalId?.slice(0, 12)}... TX: ${hash.slice(0, 10)}...`,
      });
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

  // Create proposal with custom timing
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

  // Delegation actions
  const selfDelegate = useCallback(async (): Promise<boolean> => {
    try {
      await governanceService.selfDelegate();
      toast({ title: 'Delegated', description: 'Voting power activated (self-delegation).' });
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
