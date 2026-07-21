import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AddFundsModal from "../AddFundsModal";
import WalletSetupModal from "../WalletSetupModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";

import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import PsychometricTestingCenter from "../psychometric/PsychometricTestingCenter";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useSovereignWallet } from "@/hooks/useSovereignWallet";
import { useWallet } from "@/hooks/useWallet";
import { IS_TESTNET } from "@/config/contracts";
import { NFCPayrollModal } from "../NFCPayrollModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import SendRequestModal from "../SendRequestModal";
import PaymentTrigger from "../PaymentTrigger";
import { fireFinaleConfetti } from "../psychometric/confetti";
import { useChainReceiveWatcher, type ChainReceipt } from "@/hooks/useChainReceiveWatcher";
import {
  Wallet,
  CreditCard,
  TrendingUp,
  ArrowUpRight,
  ArrowDownLeft,
  Shield,
  Download,
  Smartphone,
  Plus,
  BrainCircuit,
  ArrowRight,
  Activity,
  Hash,
  Clock,
  Copy,
  AlertTriangle,
  Link2,
  RefreshCw,
  Loader2,
  Vote,
  Network,
  ExternalLink,
} from "lucide-react";

interface Transaction {
  id: string;
  transaction_type: string;
  amount: number;
  description: string;
  source: string;
  created_at: string;
  metadata?: any;
}

interface CreditSimulation {
  current_score: number | string;
  simulated_score: number;
  actions: string[];
}

const EnhancedWalletDashboard: React.FC = () => {
  const { profile, loading, updateProfile } = useEnhancedProfile();
  const {
    balance: walletBalance,
    loading: balanceLoading,
    fiatProvisioned,
    usdcProvisioned,
    usdcAddress,
  } = useWalletBalance();

  const [stableUserId, setStableUserId] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState<"create" | "import" | "view-seed">("create");
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isCopying, setIsCopying] = useState(false);

  useEffect(() => {
    console.log("[IDENTITY_SYNC:START] Evaluating profile hydration state...");
    try {
      const resolvedId = profile?.id || profile?.user_id;
      if (resolvedId && resolvedId !== stableUserId) {
        console.log(`[IDENTITY_SYNC:LOCK] Identity Verified: ${resolvedId}`);
        setStableUserId(resolvedId);
      }
    } catch (err: any) {
      console.error(`[IDENTITY_SYNC:ERROR] ${err.message}`);
    }
  }, [profile, stableUserId]);

  const { globalWalletAddress, isHydrating, syncWalletToSupabase } = useSovereignWallet(stableUserId);

  // New useWallet API — returns balances.eth, balances.idia, balances.usdc
  const {
    wallet,
    balances,
    votingPower,
    delegatee,
    loading: walletLoading,
    balancesLoading,
    activeNetworkKey,
    availableNetworks,
    switchNetwork,
    createWallet,
    importWallet,
    getSeedPhrase,
    refreshBalances,
    delegateVotes,
    provisioningStage,
  } = useWallet();

  const hasWallet = wallet !== null;
  const localAddress = wallet?.address;

  // ── Wallet handlers ──

  const handleCreateWallet = async () => {
    try {
      const newWallet = await createWallet();
      if (newWallet?.address && stableUserId) await syncWalletToSupabase(newWallet.address);
      const seed = await getSeedPhrase();
      if (newWallet?.address) {
        const short = `${newWallet.address.slice(0, 6)}…${newWallet.address.slice(-4)}`;
        toast({
          title: "Sovereign Vault created",
          description: `${short} is now linked. Back up your recovery phrase.`,
        });
        window.dispatchEvent(new CustomEvent("vault-linked", { detail: { address: newWallet.address } }));
      }
      return newWallet ? { address: newWallet.address, mnemonic: seed || newWallet.mnemonic || "" } : null;
    } catch (error) {
      console.error("Wallet creation error:", error);
      return null;
    }
  };

  const handleImportWallet = async (seedPhrase: string) => {
    try {
      const result = await importWallet(seedPhrase);
      if (result?.address && stableUserId) await syncWalletToSupabase(result.address);
      if (result?.address) {
        const short = `${result.address.slice(0, 6)}…${result.address.slice(-4)}`;
        toast({
          title: "Wallet linked",
          description: `${short} connected to this device.`,
        });
        window.dispatchEvent(new CustomEvent("vault-linked", { detail: { address: result.address } }));
      }
      return !!result;
    } catch (error) {
      console.error("Wallet import error:", error);
      return false;
    }
  };

  const handleSyncIdiaWallet = async () => {
    if (!wallet?.address || !stableUserId) return;
    await syncWalletToSupabase(wallet.address);
  };

  const handleGetSeedPhrase = async (): Promise<string | null> => {
    try {
      return await getSeedPhrase();
    } catch (error) {
      console.error("Seed phrase error:", error);
      return null;
    }
  };

  const handleDelegateVotes = async () => {
    // If the device doesn't hold the signing keys, prompt for recovery-phrase import.
    if (!wallet?.address) {
      toast({
        title: "Recovery phrase needed",
        description: "This device doesn't hold the keys for this wallet. Import your recovery phrase to delegate.",
      });
      setSetupMode("import");
      setIsSetupModalOpen(true);
      return;
    }
    try {
      await delegateVotes(); // Self-delegate by default
      toast({ title: "Voting power activated", description: "Self-delegation submitted on-chain." });
    } catch (e: any) {
      console.error("Delegation failed:", e);
      const code = e?.code || e?.info?.error?.code;
      const msg = (e?.message || "").toLowerCase();
      const isNoGas = code === "INSUFFICIENT_FUNDS" || code === -32003 || msg.includes("insufficient funds");
      if (isNoGas) {
        toast({
          title: "Not enough ETH for gas",
          description:
            "Self-delegation is an on-chain transaction on Base and needs a small amount of ETH to pay gas. Add ETH on Base to this wallet, then try again.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Delegation failed",
          description: e?.shortMessage || e?.message || "Try again.",
          variant: "destructive",
        });
      }
    }
  };

  // ── Refs and state ──

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [creditSimulation, setCreditSimulation] = useState<CreditSimulation | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [showNFCModal, setShowNFCModal] = useState(false);
  const [showSendRequestModal, setShowSendRequestModal] = useState(false);
  const [showAddFundsModal, setShowAddFundsModal] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const displayAddress = globalWalletAddress || localAddress;
  const isProvisioned = !!displayAddress;

  // ── Auto-link wallet to Supabase ──
  const linkedPairsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!stableUserId || !hasWallet || !localAddress) return;
    const pairKey = `${stableUserId}:${localAddress.toLowerCase()}`;
    if (linkedPairsRef.current.has(pairKey)) return;
    linkedPairsRef.current.add(pairKey);
    syncWalletToSupabase(localAddress);
  }, [hasWallet, localAddress, stableUserId, globalWalletAddress]);

  // ── Native bridge ──
  useEffect(() => {
    const handleNativeAuthMessage = (event: MessageEvent) => {
      const type = event.data?.type;
      if (type === "IDIA_AUTH_COMPLETE") {
        console.log("📱 [NATIVE_BRIDGE] Handshake Confirmed. Transitioning to Active Dashboard.");
        window.location.href = "/dashboard";
      } else if (type === "IDIA_AUTH_CANCELLED") {
        console.log("📱 [NATIVE_BRIDGE] Auth cancelled by user or failed.");
      }
    };
    window.addEventListener("message", handleNativeAuthMessage);
    return () => window.removeEventListener("message", handleNativeAuthMessage);
  }, []);

  // ── Cross-component: open Security sub-tab + setup modal on request ──
  useEffect(() => {
    const handler = (event: any) => {
      const mode = event?.detail?.mode === "import" ? "import" : "create";
      setActiveTab("security");
      setSetupMode(mode);
      setIsSetupModalOpen(true);
    };
    window.addEventListener("wallet:open-security", handler as EventListener);
    return () => window.removeEventListener("wallet:open-security", handler as EventListener);
  }, []);

  // ── On-chain receive watcher → auto-open Sovereign Receipt + add History row ──
  useChainReceiveWatcher(displayAddress, (receipt: ChainReceipt) => {
    const synthetic: Transaction = {
      id: `chain-${receipt.asset}-${receipt.observed_at}`,
      transaction_type: "chain_receive",
      amount: receipt.amount,
      description: `Received ${receipt.asset}`,
      source: receipt.asset,
      created_at: receipt.observed_at,
      metadata: { onchain: true, address: receipt.address, asset: receipt.asset, delta: receipt.amount },
    };
    setTransactions((prev) => [synthetic, ...prev]);
    setSelectedTransaction(synthetic);
    toast({
      title: `Received ${receipt.asset}`,
      description: formatAmount(receipt.amount, receipt.asset),
    });
    try {
      refreshBalances();
    } catch {}
  });

  // ── Transactions ──
  useEffect(() => {
    if (stableUserId) fetchTransactions();
  }, [stableUserId]);

  const fetchTransactions = async () => {
    if (!stableUserId) return;
    try {
      const [txResult, synapseResult] = await Promise.all([
        supabase
          .from("transactions")
          .select("*")
          .eq("user_id", stableUserId)
          .order("created_at", { ascending: false })
          .limit(30),
        supabase
          .from("synapse_credit_ledger")
          .select("*")
          .eq("user_id", stableUserId)
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      const mappedTx = (txResult.data || [])
        .map((tx: any) => {
          try {
            if (tx.amount === null || tx.amount === undefined) return null;
            const strictCurrency = tx.currency || tx.metadata?.currency;
            return {
              id: tx.id,
              transaction_type: tx.transaction_type,
              amount: Number(tx.amount),
              description: tx.description || "UNLABELED_TRANSACTION",
              source: strictCurrency || "USD",
              created_at: tx.created_at,
              metadata: tx.metadata || {},
            };
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean) as Transaction[];

      const mappedSynapse = (synapseResult.data || [])
        .map((syn: any) => {
          try {
            let sourceAsset = "CREDS";
            let atomicAmount = syn.amount_usdc ?? syn.amount_idia_usd ?? syn.amount ?? 0;

            if (syn.amount_usdc !== null) sourceAsset = "USDC";
            else if (syn.amount_idia_usd !== null) sourceAsset = "IDIA";

            return {
              id: syn.id,
              transaction_type: "synapse_ledger_event",
              amount: atomicAmount > 0 ? -Math.abs(atomicAmount) : atomicAmount,
              description: syn.description || "SYNAPSE_CREDIT_EVENT",
              source: sourceAsset,
              created_at: syn.created_at,
              metadata: { type: "synapse_ledger_event", original_data: syn },
            };
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean) as Transaction[];

      setTransactions(
        [...mappedTx, ...mappedSynapse].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
      );
    } catch (error: any) {
      console.error(`[FETCH_LEDGERS:FAILURE] ${error.message}`);
    }
  };

  const handleCopyMetadata = () => {
    if (!selectedTransaction?.metadata) return;
    setIsCopying(true);
    const json = JSON.stringify(selectedTransaction.metadata, null, 2);
    navigator.clipboard.writeText(json);
    toast({
      title: "Ledger Copied",
      description: "Cryptographic artifacts stored to clipboard.",
    });
    setTimeout(() => setIsCopying(false), 2000);
  };

  const handleCalculateScore = async (moduleScores: Record<string, number>) => {
    setIsCalculating(true);
    try {
      const { tut, ...actualTelemetry } = moduleScores;
      const { data, error } = await supabase.functions.invoke("calculate-trust-score", {
        body: { user_id: stableUserId, telemetry: actualTelemetry },
      });
      if (error) throw error;
      if (updateProfile) {
        await updateProfile({
          trust_score: data.trust_score,
          available_credit_line: data.credit_line,
        });
      }
      setCreditSimulation({
        current_score: profile?.trust_score ?? "NO SCORE",
        simulated_score: data.trust_score,
        actions: ["Psychometric telemetry verified via IDIA Protocol", "Capital limit recalculated"],
      });
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setIsCalculating(false);
      setShowTestModal(false);
      setTimeout(() => fireFinaleConfetti(), 400);
    }
  };

  // ── Transaction display helpers ──
  const getTransactionIcon = (type: string, currency: string) => {
    if (type === "synapse_ledger_event") return BrainCircuit;
    if (type === "chain_receive") return ArrowDownLeft;
    if (currency === "USDC") return Shield;
    switch (type) {
      case "DATA_SALE_PAYOUT":
      case "data_sale":
        return TrendingUp;
      case "payment_sent":
        return ArrowUpRight;
      case "payment_received":
        return ArrowDownLeft;
      case "nfc_payroll":
        return Smartphone;
      default:
        return CreditCard;
    }
  };

  const getTransactionColor = (amount: number) => (amount > 0 ? "text-green-600" : "text-red-600");

  const formatAmount = (amount: number, currency: string) => {
    const prefix = amount > 0 ? "+" : "";
    if (currency === "ETH") return `${prefix}${Math.abs(amount).toFixed(6)} ETH`;
    if (currency === "IDIA")
      return `${prefix}${Math.abs(amount).toLocaleString(undefined, { maximumFractionDigits: 4 })} IDIA`;
    const value = Math.abs(amount).toFixed(2);
    if (currency === "USDC") return `${prefix}${value} USDC`;
    if (currency === "IDIA Token") return `${prefix}${value} IDIA`;
    return `${prefix}$${value}`;
  };

  if (loading || balanceLoading || isHydrating || walletLoading) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-8 bg-muted rounded w-1/3"></div>
        <div className="h-32 bg-muted rounded"></div>
        <div className="h-64 bg-muted rounded"></div>
      </div>
    );
  }

  const TestModal = () => (
    <Dialog open={showTestModal} onOpenChange={setShowTestModal}>
      <DialogTrigger asChild>
        <Button className="w-full font-bold shadow-lg shadow-orange-500/30 bg-gradient-to-r from-teal-500 to-orange-500 hover:from-teal-600 hover:to-orange-600 text-white">
          {isCalculating ? "Calculating..." : "Need an advance? Take our Tests"} <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-background p-0 border-none">
        <DialogHeader className="sr-only">
          <DialogTitle>Psychometric Validation</DialogTitle>
          <DialogDescription>Establish Trust Score via telemetry modules.</DialogDescription>
        </DialogHeader>
        <PsychometricTestingCenter onCompleteAll={handleCalculateScore} onCancel={() => setShowTestModal(false)} />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid grid-cols-3 w-full bg-muted/20 shrink-0">
          <TabsTrigger value="overview" className="text-[11px] px-1">
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-[11px] px-1">
            History
          </TabsTrigger>
          <TabsTrigger value="security" className="text-[11px] px-1">
            Security
          </TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="flex-1 min-h-0 overflow-hidden mt-2">
          <div
            className="h-full overflow-y-auto no-scrollbar pr-1 space-y-4 pb-24"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <Card className="bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardContent className="p-7">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-100/60">Total Balance</p>
                    <h2 className="text-4xl font-black">
                      ${walletBalance?.usdc_balance?.toFixed(2) || "0.00"}{" "}
                      <span className="text-sm font-medium text-teal-100/40">USDC</span>
                    </h2>
                  </div>
                  <Wallet className="w-10 h-10 text-orange-400 drop-shadow-lg" />
                </div>
                <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${isProvisioned ? "bg-emerald-400 animate-pulse" : "bg-orange-400"}`}
                  />
                  <span className="text-[9px] font-black uppercase tracking-widest text-teal-50">
                    IDIA ·{" "}
                    {(walletBalance?.idia_token_balance ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    {!isProvisioned && " · Link vault to liquidate"}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Elevated Sovereign Treasury Details */}
            {displayAddress && (
              <div className="space-y-4">
                {/* Banner when global wallet exists but device has no signing keys */}
                {!wallet && globalWalletAddress && (
                  <div className="p-3 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-300 mt-0.5 shrink-0" />
                    <div className="flex-1 text-xs text-amber-900 dark:text-amber-100">
                      <p className="font-semibold mb-1">Wallet not on this device</p>
                      <p className="mb-2">
                        Balances are live and read-only. To sign transactions (delegate, send), import your recovery
                        phrase.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          setSetupMode("import");
                          setIsSetupModalOpen(true);
                        }}
                      >
                        <Download className="w-3 h-3 mr-1" /> Import Recovery Phrase
                      </Button>
                    </div>
                  </div>
                )}

                {/* ── Tap-to-Pay / NFC Trigger ── */}
                <PaymentTrigger />

                {/* Balances — ETH, IDIA, USDC */}
                <div className="space-y-3">
                  {/* ETH */}
                  <div className="p-3 bg-secondary/30 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">ETH (Gas)</p>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={refreshBalances}>
                        <RefreshCw className={`w-3 h-3 ${balancesLoading ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                    <p className="text-lg font-bold mt-1">
                      {balances?.eth
                        ? Number(balances.eth.balanceFormatted).toFixed(6)
                        : (walletBalance?.eth_balance ?? 0).toFixed(6)}
                      <span className="text-sm text-muted-foreground font-normal ml-1">ETH</span>
                    </p>
                  </div>

                  {/* IDIA Token */}
                  <div className="p-3 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-950 dark:to-blue-950 rounded-lg border">
                    <p className="text-xs text-muted-foreground">IDIA Token</p>
                    <p className="text-2xl font-bold mt-1">
                      {(balances?.idia
                        ? Number(balances.idia.balanceFormatted)
                        : (walletBalance?.idia_token_balance ?? 0)
                      ).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                      <span className="text-sm text-muted-foreground font-normal ml-1">IDIA</span>
                    </p>
                  </div>

                  {/* USDC */}
                  <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border">
                    <p className="text-xs text-muted-foreground">USDC</p>
                    <p className="text-2xl font-bold mt-1">
                      $
                      {balances?.usdc
                        ? parseFloat(balances.usdc.balanceFormatted).toFixed(2)
                        : (walletBalance?.usdc_balance ?? 0).toFixed(2)}
                      <span className="text-sm text-muted-foreground font-normal ml-1">USDC</span>
                    </p>
                  </div>
                </div>

                {/* Voting Power */}
                <div className="p-3 bg-secondary/30 rounded-lg border">
                  <p className="text-xs text-muted-foreground">Voting Power</p>
                  <p className="text-lg font-bold mt-1">
                    {(() => {
                      const vp = votingPower ?? walletBalance?.voting_power ?? 0;
                      return Number(vp).toFixed(0);
                    })()}{" "}
                    <span className="text-sm text-muted-foreground font-normal">votes</span>
                  </p>
                  {(() => {
                    const d = delegatee ?? walletBalance?.delegatee ?? null;
                    if (d && d !== "0x0000000000000000000000000000000000000000") {
                      return (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Delegated to: {d.slice(0, 8)}...{d.slice(-6)}
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Self-delegate — readiness-aware; opens import modal if no local keys */}
                {(() => {
                  const idiaAmount = balances?.idia
                    ? Number(balances.idia.balanceFormatted)
                    : Number(walletBalance?.idia_token_balance ?? 0);
                  const ethAmount = balances?.eth
                    ? Number(balances.eth.balanceFormatted)
                    : Number(walletBalance?.eth_balance ?? 0);
                  const hasIdia = idiaAmount >= 1;
                  const hasGas = ethAmount >= 0.0001;
                  const d = (delegatee ?? walletBalance?.delegatee ?? "").toLowerCase();
                  const me = (wallet?.address ?? displayAddress ?? "").toLowerCase();
                  const isSelfDelegated = !!d && !!me && d === me;
                  const isReady = hasIdia && hasGas && !isSelfDelegated;

                  const missing: string[] = [];
                  if (!hasIdia) missing.push(`${(1 - idiaAmount).toFixed(2)} IDIA`);
                  if (!hasGas) missing.push(`${(0.0001 - ethAmount).toFixed(6)} ETH`);

                  let label = "Self-Delegate (need ≥1 IDIA & ~0.0001 ETH)";
                  if (isSelfDelegated) label = "Re-Delegate to Self";
                  else if (isReady) label = "Self-Delegate — Claim Your Voice";

                  return (
                    <div className="space-y-1.5">
                      <Button
                        onClick={handleDelegateVotes}
                        variant={isReady ? "default" : "outline"}
                        className={
                          isReady
                            ? "w-full bg-gradient-to-r from-teal-600 to-amber-500 hover:from-teal-700 hover:to-amber-600 text-white font-black shadow-lg shadow-amber-500/30 ring-2 ring-amber-300/40 animate-pulse"
                            : "w-full"
                        }
                      >
                        <Vote className="w-4 h-4 mr-2" />
                        {label}
                      </Button>
                      {!isSelfDelegated && !isReady && missing.length > 0 && (
                        <p className="text-[10px] text-muted-foreground text-center">Missing: {missing.join(", ")}</p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ TRANSACTIONS TAB ═══ */}
        <TabsContent value="transactions" className="flex-1 min-h-0 overflow-hidden mt-2">
          <div className="h-full overflow-y-auto no-scrollbar pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic">No verified ledger records found.</div>
            ) : (
              <div className="space-y-3 pb-24">
                {transactions.map((tx) => {
                  const Icon = getTransactionIcon(tx.transaction_type, tx.source);
                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        console.log(`[LEDGER_AUDIT] Opening receipt for: ${tx.id}`);
                        setSelectedTransaction(tx);
                      }}
                      className="flex items-center space-x-3 p-3 border rounded-xl bg-card transition-all active:scale-[0.98] hover:bg-slate-50 border-slate-100 cursor-pointer shadow-sm"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon size={18} className="text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate text-slate-800">{tx.description}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] font-medium text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString()}
                          </p>
                          <Badge
                            variant="outline"
                            className="text-[8px] h-3.5 px-1 uppercase font-black tracking-tighter opacity-60"
                          >
                            {tx.source}
                          </Badge>
                        </div>
                      </div>
                      <div className={`font-semibold ${getTransactionColor(tx.amount)}`}>
                        {formatAmount(tx.amount, tx.source)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══ CREDIT TAB ═══ */}
        <TabsContent value="credit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Capital Advancement</CardTitle>
            </CardHeader>
            <CardContent>
              {creditSimulation ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Current</p>
                      <p className="text-xl font-bold">{creditSimulation.current_score}</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg bg-green-50/30">
                      <p className="text-xs text-muted-foreground">Updated</p>
                      <p className="text-xl font-bold text-green-600">{creditSimulation.simulated_score}</p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <TestModal />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 flex flex-col items-center">
                  <BrainCircuit className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground max-w-xs mb-6">
                    Limits are calculated via verifiable behavioral telemetry.
                  </p>
                  <TestModal />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ WALLET TAB (was "Security") ═══ */}
        <TabsContent value="security" className="flex-1 min-h-0 overflow-hidden">
          <div
            className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1 space-y-4 pb-24"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {hasWallet && wallet ? (
              <>
                {/* ── Wallet Card ── */}
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Wallet className="w-4 h-4 text-teal-600" />
                        IDIA Wallet
                      </CardTitle>
                      {IS_TESTNET && (
                        <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                          Testnet
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Sync mismatch warning */}
                    {globalWalletAddress && globalWalletAddress.toLowerCase() !== wallet.address.toLowerCase() && (
                      <div className="p-3 rounded-lg border border-yellow-300 bg-yellow-50 dark:bg-yellow-950 space-y-2">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-700 dark:text-yellow-300 mt-0.5 shrink-0" />
                          <div className="flex-1 text-xs text-yellow-900 dark:text-yellow-100">
                            <p className="font-semibold mb-1">Account linked to a different wallet</p>
                            <p>Tap below to use this IDIA wallet instead.</p>
                            <p className="font-mono text-[10px] mt-2 break-all">Linked: {globalWalletAddress}</p>
                            <p className="font-mono text-[10px] break-all">IDIA: {wallet.address}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
                          onClick={handleSyncIdiaWallet}
                        >
                          <Link2 className="w-3 h-3 mr-2" />
                          Use IDIA Wallet for My Account
                        </Button>
                      </div>
                    )}

                    {/* Address */}
                    <div className="p-3 bg-secondary/50 rounded-lg border">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-muted-foreground">Wallet Address</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0"
                          onClick={() => navigator.clipboard.writeText(wallet.address)}
                        >
                          <Copy className="w-3 h-3" />
                        </Button>
                      </div>
                      <p className="font-mono text-xs break-all text-muted-foreground mb-2">{wallet.address}</p>
                    </div>

                    {/* Network selector — only visible in test builds */}
                    {IS_TESTNET && (
                      <div>
                        <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                          <Network className="w-3 h-3" /> Network
                        </label>
                        <select
                          className="w-full p-2 border rounded-md text-sm bg-background"
                          value={activeNetworkKey}
                          onChange={(e) => switchNetwork(e.target.value)}
                        >
                          {availableNetworks.map(({ key, config }) => (
                            <option key={key} value={key}>
                              {config.name}
                              {config.isTestnet ? " (Testnet)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* ── MetaMask Deep Link ── */}
                <Button
                  onClick={() => {
                    console.log("[EnhancedWalletDashboard][DeepLink][START] Launching native MetaMask application");
                    window.location.href = "metamask://";
                  }}
                  className="w-full bg-[#F6851B] hover:bg-[#E2761B] text-white shadow-md shadow-orange-500/20"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Send / Receive via MetaMask
                </Button>

                {/* ── Wallet Management ── */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Shield className="w-4 h-4" />
                      Wallet Management
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSetupMode("view-seed");
                        setIsSetupModalOpen(true);
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" />
                      Reveal Recovery Phrase
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSetupMode("import");
                        setIsSetupModalOpen(true);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Import Different Wallet
                    </Button>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    {globalWalletAddress ? "Upgrade Your Wallet" : "Set Up Your IDIA Wallet"}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {globalWalletAddress ? (
                      <>
                        Your account is linked to a previous wallet:
                        <br />
                        <code className="text-[10px]">
                          {globalWalletAddress.slice(0, 8)}...{globalWalletAddress.slice(-6)}
                        </code>
                        <br />
                        <br />
                        Create or import an IDIA wallet to enable full features.
                      </>
                    ) : (
                      "Create a new EVM wallet or restore from a 12-word seed phrase."
                    )}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() => {
                        setSetupMode("create");
                        setIsSetupModalOpen(true);
                      }}
                      className="bg-teal-500 hover:bg-teal-600"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create New
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSetupMode("import");
                        setIsSetupModalOpen(true);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Import
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* --- AUDIT RECEIPT POP-UP (ACCESSIBILITY FIXED) --- */}
      <Dialog open={!!selectedTransaction} onOpenChange={(open) => !open && setSelectedTransaction(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden border-none rounded-3xl shadow-2xl bg-white">
          <DialogHeader className="p-0">
            <div className="bg-teal-700 p-8 text-white relative">
              <div className="flex justify-between items-start mb-6">
                <div className="space-y-1">
                  <DialogTitle className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 m-0">
                    Sovereign Receipt
                  </DialogTitle>
                  <DialogDescription className="font-mono text-[9px] opacity-40 text-white">
                    ID: {selectedTransaction?.id}
                  </DialogDescription>
                </div>
                <Activity className="w-8 h-8 opacity-20" />
              </div>
              <div className="text-center py-4">
                <p className="text-[11px] font-bold uppercase tracking-widest opacity-60 mb-1">Verified Amount</p>
                <h2 className="text-4xl font-black tracking-tight">
                  {selectedTransaction && formatAmount(selectedTransaction.amount, selectedTransaction.source)}
                </h2>
                <Badge className="mt-4 bg-white/10 hover:bg-white/20 border-white/20 text-[10px] font-black uppercase tracking-widest px-3 py-1">
                  {selectedTransaction?.transaction_type?.replace(/_/g, " ")}
                </Badge>
              </div>
            </div>
          </DialogHeader>

          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <Clock size={12} /> Verification Time
                </div>
                <p className="text-sm font-bold text-slate-800">
                  {selectedTransaction && new Date(selectedTransaction.created_at).toLocaleString()}
                </p>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <Hash size={12} /> Asset Rail
                </div>
                <p className="text-sm font-bold text-slate-800">{selectedTransaction?.source}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ MODALS ═══ */}
      <NFCPayrollModal isOpen={showNFCModal} onClose={() => setShowNFCModal(false)} />
      <SendRequestModal isOpen={showSendRequestModal} onClose={() => setShowSendRequestModal(false)} />
      <AddFundsModal
        isOpen={showAddFundsModal}
        onClose={() => setShowAddFundsModal(false)}
        fiatEnabled={fiatProvisioned}
        usdcEnabled={usdcProvisioned}
        usdcAddress={usdcAddress || displayAddress}
      />
      <WalletSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        mode={setupMode}
        onCreateWallet={handleCreateWallet}
        onImportWallet={handleImportWallet}
        getSeedPhrase={handleGetSeedPhrase}
        walletAddress={displayAddress}
        provisioningStage={provisioningStage}
      />
    </div>
  );
};

export default EnhancedWalletDashboard;
