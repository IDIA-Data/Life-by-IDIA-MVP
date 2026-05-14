/**
 * React hook for IDIA Life wallet — exposes ETH, IDIA, and USDC balances
 * along with wallet lifecycle, network switching, and governance delegation.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  walletService,
  NETWORKS,
  TxRequest,
  TxResult,
  WalletInfo,
  WalletBalances,
  NetworkConfig,
} from '../services/walletService';

// --- Backwards Compatibility Aliases ---
// We alias the new types to the old names so the rest of your app doesn't break
export type TransactionResult = TxResult;
export type BalanceInfo = any; 

interface UseWalletReturn {
  // --- NEW STATE API ---
  wallet: WalletInfo | null;
  balances: WalletBalances | null;
  votingPower: string | null;
  delegatee: string | null;
  loading: boolean;
  balancesLoading: boolean;
  error: string | null;
  clearError: () => void;

  // --- NETWORK API ---
  activeNetwork: string; // Legacy string format
  activeNetworkConfig: NetworkConfig | null; // New config object format
  activeNetworkKey: string;
  networks: typeof NETWORKS;
  availableNetworks: Array<{ key: string; config: NetworkConfig }>;
  switchNetwork: (key: string) => Promise<void>;

  // --- LIFECYCLE API ---
  createWallet: () => Promise<{ address: string; mnemonic: string } | null>;
  importWallet: (mnemonic: string) => Promise<{ address: string } | null>;
  deleteWallet: () => Promise<void>;
  getSeedPhrase: () => Promise<string | null>;

  // --- BALANCES & TRANSACTIONS API ---
  balance: BalanceInfo | null;
  isBalanceLoading: boolean;
  refreshBalance: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  
  estimateTransaction: (tx: any) => Promise<string>;
  sendTransaction: (tx: TxRequest) => Promise<TransactionResult>;
  sendNative: (to: string, amount: string) => Promise<TransactionResult>;
  sendIDIA: (to: string, amount: string) => Promise<TransactionResult>;
  delegateVotes: (delegatee?: string) => Promise<TransactionResult>;
}

export function useWallet(): UseWalletReturn {
  const [wallet, setWallet] = useState<WalletInfo | null>(null);
  const [hasWallet, setHasWallet] = useState<boolean>(false); // Restored legacy state
  const [balances, setBalances] = useState<WalletBalances | null>(null);
  const [votingPower, setVotingPower] = useState<string | null>(null);
  const [delegatee, setDelegatee] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [balancesLoading, setBalancesLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  const [activeNetwork, setActiveNetwork] = useState<string>(walletService.getActiveNetworkKey());

  const clearError = useCallback(() => setError(null), []);

  // Legacy refresh balance mapping
  const refreshBalance = useCallback(async () => {
    if (!walletService.getAddress()) return;
    setIsBalanceLoading(true);
    try {
      // Maps the old getBalance requirement to the new getAllBalances method
      const b = await walletService.getAllBalances();
      setBalance(b as any);
    } catch (e: any) {
      console.error('Legacy Balance fetch failed:', e);
    } finally {
      setIsBalanceLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    (async () => {
      try {
        const exists = await walletService.hasWallet();
        setHasWallet(exists);
        if (exists) {
          const info = await walletService.loadWallet();
          setWallet(info);
          if (info) setActiveNetwork(info.activeNetwork);
        }
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
      
      // Keep legacy state synced
      setBalance(allBalances as any);
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
    setLoading(true); 
    setError(null);
    try {
      const r = await walletService.createWallet();
      setWallet({ address: r.address, activeNetwork: walletService.getActiveNetworkKey() });
      setHasWallet(true);
      setActiveNetwork(walletService.getActiveNetworkKey());
  
      return { address: r.address, mnemonic: r.mnemonic || '' };
    } catch (e: any) { 
      setError(e.message); 
      return null; 
    } finally { 
      setLoading(false); 
    }
  }, []);

  const importWallet = useCallback(async (mnemonic: string) => {
    setLoading(true); 
    setError(null);
    try {
      const r = await walletService.importWallet(mnemonic);
      setWallet({ address: r.address, activeNetwork: walletService.getActiveNetworkKey() });
      setHasWallet(true);
      setActiveNetwork(walletService.getActiveNetworkKey());

      return { address: r.address };
    } catch (e: any) { 
      setError(e.message); 
      return null; 
    } finally { 
      setLoading(false); 
    }
  }, []);

  const getSeedPhrase = useCallback(async () => {
    return await walletService.getSeedPhrase();
  }, []);

  const deleteWallet = useCallback(async () => {
    await walletService.deleteWallet();
    setWallet(null);
    setHasWallet(false);
    setBalances(null);
    setBalance(null);
    setVotingPower(null);
    setDelegatee(null);
  }, []);

  const switchNetwork = useCallback(async (networkKey: string) => {
    setError(null);
    try {
      await walletService.switchNetwork(networkKey);
      setActiveNetwork(networkKey);
      const info = await walletService.loadWallet();
      setWallet(info);
      refreshBalances();
    } catch (e: any) { 
      setError(e.message); 
    }
  }, [refreshBalances]);

  // Restored estimateTransaction for legacy components
  const estimateTransaction = useCallback(async (tx: any) => {
    try {
      if (typeof (walletService as any).estimateTransaction === 'function') {
        return await (walletService as any).estimateTransaction(tx);
      }
      return "0";
    } catch (e) {
      return "0";
    }
  }, []);

  const sendTransaction = useCallback(async (tx: TxRequest) => {
    const result = await walletService.sendTransaction(tx);
    refreshBalances();
    return result;
  }, [refreshBalances]);

  const sendNative = useCallback(async (to: string, amount: string) => {
    const result = await walletService.sendNative(to, amount);
    refreshBalances();
    return result;
  }, [refreshBalances]);

  const sendIDIA = useCallback(async (to: string, amount: string) => {
    const result = await walletService.sendIDIA(to, amount);
    refreshBalances();
    return result;
  }, [refreshBalances]);

  const delegateVotes = useCallback(async (target?: string) => {
    const result = await walletService.delegateVotes(target);
    const [power, delegate] = await Promise.all([
      walletService.getVotingPower(),
      walletService.getDelegatee(),
    ]);
    setVotingPower(power);
    setDelegatee(delegate);
    return result;
  }, []);

  return {
    // --- Unified Return Object ---
    wallet,
    balances,
    votingPower,
    delegatee,
    loading,
    balancesLoading,
    error,
    clearError,

    // Network data
    activeNetwork,
    activeNetworkConfig: NETWORKS[activeNetwork] as NetworkConfig,
    activeNetworkKey: walletService.getActiveNetworkKey(),
    networks: NETWORKS,
    availableNetworks: walletService.getAvailableNetworks(),
    switchNetwork,

    // Lifecycle
    createWallet,
    importWallet,
    deleteWallet,
    getSeedPhrase,

    // Balances
    balance,
    isBalanceLoading,
    refreshBalance,
    refreshBalances,

    // Transactions
    estimateTransaction,
    sendTransaction,
    sendNative,
    sendIDIA,
    delegateVotes,
  };
}