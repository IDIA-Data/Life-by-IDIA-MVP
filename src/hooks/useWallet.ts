/**
 * React hook for IDIA Life wallet — exposes ETH, IDIA, and USDC balances
 * along with wallet lifecycle, network switching, and governance delegation.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  walletService,
  WalletInfo,
  WalletBalances,
  NetworkConfig,
  TransactionResult,
} from '../services/walletService';

interface UseWalletReturn {
  // State
  wallet: WalletInfo | null;
  balances: WalletBalances | null;
  votingPower: string | null;
  delegatee: string | null;
  loading: boolean;
  balancesLoading: boolean;
  error: string | null;

  // Network
  activeNetwork: NetworkConfig | null;
  activeNetworkKey: string;
  availableNetworks: Array<{ key: string; config: NetworkConfig }>;
  switchNetwork: (key: string) => Promise<void>;

  // Wallet lifecycle
  createWallet: () => Promise<{ address: string; mnemonic: string }>;
  importWallet: (mnemonic: string) => Promise<{ address: string }>;
  deleteWallet: () => Promise<void>;
  getSeedPhrase: () => string | null;

  // Actions
  refreshBalances: () => Promise<void>;
  sendNative: (to: string, amount: string) => Promise<TransactionResult>;
  sendIDIA: (to: string, amount: string) => Promise<TransactionResult>;
  delegateVotes: (delegatee?: string) => Promise<TransactionResult>;
}

export function useWallet(): UseWalletReturn {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [votingPower, setVotingPower] = useState<string | null>(null);
  const [delegatee, setDelegatee] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load wallet on mount
  useEffect(() => {
    (async () => {
      try {
        const info = await walletService.loadWallet();
        setWallet(info);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Fetch balances when wallet is loaded
  const refreshBalances = useCallback(async () => {
    if (!wallet) return;
    setBalancesLoading(true);
    setError(null);

    try {
      const [allBalances, power, delegate] = await Promise.all([
        walletService.getAllBalances(),
        walletService.getVotingPower().catch(() => '0'),
        walletService.getDelegatee().catch(() => '0x0000000000000000000000000000000000000000'),
      ]);
      setBalances(allBalances);
      setVotingPower(power);
      setDelegatee(delegate);
    } catch (e: any) {
      console.error('Balance fetch failed:', e);
      setError(e.message);
    } finally {
      setBalancesLoading(false);
    }
  }, [wallet]);

  useEffect(() => {
    if (wallet) refreshBalances();
  }, [wallet, refreshBalances]);

  // Auto-refresh balances every 30 seconds
  useEffect(() => {
    if (!wallet) return;
    const interval = setInterval(refreshBalances, 30_000);
    return () => clearInterval(interval);
  }, [wallet, refreshBalances]);

  const createWallet = useCallback(async () => {
    const result = await walletService.createWallet();
    setWallet({ address: result.address, activeNetwork: walletService.getActiveNetworkKey() });
    return result;
  }, []);

  const importWallet = useCallback(async (mnemonic: string) => {
    const result = await walletService.importWallet(mnemonic);
    setWallet({ address: result.address, activeNetwork: walletService.getActiveNetworkKey() });
    return result;
  }, []);

  const deleteWallet = useCallback(async () => {
    await walletService.deleteWallet();
    setWallet(null);
    setBalances(null);
    setVotingPower(null);
    setDelegatee(null);
  }, []);

  const switchNetwork = useCallback(async (key: string) => {
    await walletService.switchNetwork(key);
    setWallet(prev => prev ? { ...prev, activeNetwork: key } : null);
    // Balances will auto-refresh via the useEffect dependency on wallet
  }, []);

  const sendNative = useCallback(async (to: string, amount: string) => {
    const result = await walletService.sendNative(to, amount);
    refreshBalances(); // refresh after send
    return result;
  }, [refreshBalances]);

  const sendIDIA = useCallback(async (to: string, amount: string) => {
    const result = await walletService.sendIDIA(to, amount);
    refreshBalances();
    return result;
  }, [refreshBalances]);

  const delegateVotes = useCallback(async (target?: string) => {
    const result = await walletService.delegateVotes(target);
    // Refresh voting power after delegation
    const [power, delegate] = await Promise.all([
      walletService.getVotingPower(),
      walletService.getDelegatee(),
    ]);
    setVotingPower(power);
    setDelegatee(delegate);
    return result;
  }, []);

  return {
    wallet,
    balances,
    votingPower,
    delegatee,
    loading,
    balancesLoading,
    error,
    activeNetwork: wallet ? walletService.getActiveNetwork() : null,
    activeNetworkKey: walletService.getActiveNetworkKey(),
    availableNetworks: walletService.getAvailableNetworks(),
    switchNetwork,
    createWallet,
    importWallet,
    deleteWallet,
    getSeedPhrase: () => walletService.getSeedPhrase(),
    refreshBalances,
    sendNative,
    sendIDIA,
    delegateVotes,
  };
}
