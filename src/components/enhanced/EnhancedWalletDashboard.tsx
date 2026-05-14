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
  DialogFooter,
} from "@/components/ui/dialog";
import { useEnhancedProfile } from "@/hooks/useEnhancedProfile";
import PsychometricTestingCenter from "../psychometric/PsychometricTestingCenter";
import type { TestId } from "../psychometric/testBank";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import { useSovereignWallet } from "@/hooks/useSovereignWallet";
import { useWallet } from "@/hooks/useWallet";
import { IS_TESTNET } from "@/config/contracts";
import { USDC_PAYMENTS_ENABLED } from "@/config/usdc";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import NFCPayrollModal from "../NFCPayrollModal";
import SendRequestModal from "../SendRequestModal";
import PaymentTrigger from "../PaymentTrigger";
import RequestPaymentQR from "../RequestPaymentQR";
import { fireFinaleConfetti } from "../psychometric/confetti";
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
  AlertOctagon,
  Activity,
  Hash,
  Clock,
  Fingerprint,
  Info,
  Copy,
  Check,
  AlertTriangle,
  Link2,
  RefreshCw,
  Loader2,
  Vote,
  Network,
  QrCode
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
  const [showRequestPayment, setShowRequestPayment] = useState(false);

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
    wallet, balances, votingPower, delegatee, loading: walletLoading, balancesLoading,
    activeNetwork, activeNetworkKey, availableNetworks, switchNetwork,
    createWallet, importWallet, deleteWallet, getSeedPhrase,
    refreshBalances, sendNative, sendIDIA, delegateVotes,
    error: walletError,
  } = useWallet();

  const hasWallet = wallet !== null;
  const localAddress = wallet?.address;

  // ── Wallet handlers ──

  const handleCreateWallet = async () => {
    try {
      const newWallet = await createWallet();
      if (newWallet?.address && stableUserId) await syncWalletToSupabase(newWallet.address);
      const seed = getSeedPhrase();
      return newWallet ? { address: newWallet.address, mnemonic: seed || newWallet.mnemonic || "" } : null;
    } catch (error) { console.error("Wallet creation error:", error); return null; }
  };

  const handleImportWallet = async (seedPhrase: string) => {
    try {
      const result = await importWallet(seedPhrase);
      if (result?.address && stableUserId) await syncWalletToSupabase(result.address);
      return !!result;
    } catch (error) { console.error("Wallet import error:", error); return false; }
  };

  const handleSyncIdiaWallet = async () => {
    if (!wallet?.address || !stableUserId) return;
    await syncWalletToSupabase(wallet.address);
  };

  const handleGetSeedPhrase = async (): Promise<string | null> => {
    try { return getSeedPhrase(); }
    catch (error) { console.error("Seed phrase error:", error); return null; }
  };

  const handleDelegateVotes = async () => {
    if (!wallet?.address) return;
    try {
      await delegateVotes(); // Self-delegate by default
    } catch (e) { console.error("Delegation failed:", e); }
  };

  // ── Refs and state ──

  const syncLock = useRef(false);
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
  const hasFBO = !!profile?.fbo_account_id;

  // ── Auto-link wallet to Supabase ──
  const linkedPairsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!stableUserId || !hasWallet || !localAddress) return;
    if (localAddress === globalWalletAddress) return;
    const pairKey = `${stableUserId}:${localAddress.toLowerCase()}`;
    if (linkedPairsRef.current.has(pairKey)) return;
    linkedPairsRef.current.add(pairKey);
    syncWalletToSupabase(localAddress);
  }, [hasWallet, localAddress, stableUserId, globalWalletAddress]);

  // ── Native bridge ──
  useEffect(() => {
    const h = (event: MessageEvent) => {
      if (event.data?.type === "IDIA AUTH COMPLETE") window.location.href = "/dashboard";
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, []);

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
    const value = Math.abs(amount).toFixed(2);
    if (currency === "USDC") return `${prefix}${value} USDC`;
    if (currency === "IDIA Token") return `${prefix}${value} IDIA`;
    return `${prefix}$${value}`;
  };

  if (loading || balanceLoading || isHydrating || walletLoading) {
    return (<div className="p-4 space-y-4 animate-pulse"><div className="h-8 bg-muted rounded w-1/3"></div><div className="h-32 bg-muted rounded"></div><div className="h-64 bg-muted rounded"></div></div>);
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
        <TabsList className="grid grid-cols-4 w-full bg-muted/20 shrink-0">
          <TabsTrigger value="overview" className="text-[11px] px-1">
            Overview
          </TabsTrigger>
          <TabsTrigger value="transactions" className="text-[11px] px-1">
            History
          </TabsTrigger>
          <TabsTrigger value="credit" className="text-[11px] px-1">
            Credit
          </TabsTrigger>
          <TabsTrigger value="security" className="text-[11px] px-1">
            Security
          </TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold">Total Balance</h2>
                <Wallet className="w-6 h-6 opacity-50" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-teal-100 text-[10px] font-medium uppercase font-bold">Fiat (USD)</p>
                  <p className="text-xl font-black">${walletBalance?.cash_balance?.toFixed(2) || "0.00"}</p>
                </div>
                <div className="text-center border-x border-white/20">
                  <p className="text-teal-100 text-[10px] font-medium uppercase font-bold">Stable USDC</p>
                  <p className="text-xl font-black">${walletBalance?.usdc_balance?.toFixed(2) || "0.00"}</p>
                </div>
                <div className="text-center">
                  <p className="text-teal-100 text-[10px] font-medium uppercase font-bold">IDIA Token</p>
                  <p className="text-xl font-black">{walletBalance?.idia_token_balance?.toFixed(2) || "0.00"}</p>
                </div>
              </div>
              {!isProvisioned && (<div className="mt-4 pt-2 border-t border-white/20 text-center"><p className="text-[10px] text-teal-50 italic">Link a Sovereign Vault to enable liquidation</p></div>)}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-4">
            <Button
              className="h-14 flex-col bg-teal-600 hover:bg-teal-700 text-xs"
              onClick={() => setShowSendRequestModal(true)}
            >
              <div className="flex space-x-1 mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <ArrowDownLeft className="w-4 h-4" />
              </div>{" "}
              Send/Req
            </Button>
            <Button variant="outline" className="h-14 flex-col text-xs" onClick={() => setShowNFCModal(true)}>
              <Smartphone size={18} className="mb-1" /> NFC Pay
            </Button>
            <Button
              variant="outline"
              className="h-14 flex-col text-xs"
              onClick={() => setShowAddFundsModal(true)}
              disabled={!fiatProvisioned && !usdcProvisioned}
            >
              <Plus size={18} className="mb-1" /> Add Funds
            </Button>
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
                      <div className={`font-black text-xs shrink-0 ${getTransactionColor(tx.amount)}`}>
                        {formatAmount(tx.amount, tx.source)}
                      </div>
                      <div className={`font-semibold ${getTransactionColor(tx.amount)}`}>{formatAmount(tx.amount, tx.source)}</div>
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
          <div className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1 space-y-4" style={{ WebkitOverflowScrolling: "touch" }}>

          {hasWallet && wallet ? (
            <>
              {/* ── Wallet Card ── */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base"><Wallet className="w-4 h-4 text-teal-600" />IDIA Wallet</CardTitle>
                    {IS_TESTNET && (<Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">Testnet</Badge>)}
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
                      <Button size="sm" className="w-full bg-yellow-600 hover:bg-yellow-700 text-white" onClick={handleSyncIdiaWallet}>
                        <Link2 className="w-3 h-3 mr-2" />Use IDIA Wallet for My Account
                      </Button>
                    </div>
                  )}

                  {/* Address */}
                  <div className="p-3 bg-secondary/50 rounded-lg border">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-xs text-muted-foreground">Wallet Address</p>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => navigator.clipboard.writeText(wallet.address)}><Copy className="w-3 h-3" /></Button>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setSetupMode("view-seed");
                        setIsSetupModalOpen(true);
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" /> Reveal Recovery Phrase
                    </Button>
                  </div>
                     ) : (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Button
                      onClick={() => {
                        setSetupMode("create");
                        setIsSetupModalOpen(true);
                      }}
                    >
                      <Shield className="w-4 h-4 mr-2" /> Create
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSetupMode("import");
                        setIsSetupModalOpen(true);
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" /> Import
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
                      {balancesLoading && !balances ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />
                      ) : (
                        <p className="text-lg font-bold mt-1">
                          {balances?.eth ? Number(balances.eth.balanceFormatted).toFixed(6) : "0.000000"}
                          <span className="text-sm text-muted-foreground font-normal ml-1">ETH</span>
                        </p>
                      )}
                    </div>

                    {/* IDIA Token */}
                    <div className="p-3 bg-gradient-to-br from-teal-50 to-blue-50 dark:from-teal-950 dark:to-blue-950 rounded-lg border">
                      <p className="text-xs text-muted-foreground">IDIA Token</p>
                      {balancesLoading && !balances ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />
                      ) : (
                        <p className="text-2xl font-bold mt-1">
                          {balances?.idia ? Number(balances.idia.balanceFormatted).toFixed(2) : "0.00"}
                          <span className="text-sm text-muted-foreground font-normal ml-1">IDIA</span>
                        </p>
                      )}
                    </div>

                    {/* USDC */}
                    <div className="p-3 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 rounded-lg border">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          USDC {IS_TESTNET && <span className="text-purple-600">(Testnet)</span>}
                        </p>
                      </div>
                      {balancesLoading && !balances ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mt-1" />
                      ) : (
                        <p className="text-2xl font-bold mt-1">
                          ${balances?.usdc ? parseFloat(balances.usdc.balanceFormatted).toFixed(2) : "0.00"}
                          <span className="text-sm text-muted-foreground font-normal ml-1">USDC</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Voting Power */}
                  {votingPower && parseFloat(votingPower) > 0 && (
                    <div className="p-3 bg-secondary/30 rounded-lg border">
                      <p className="text-xs text-muted-foreground">Voting Power</p>
                      <p className="text-lg font-bold mt-1">{Number(votingPower).toFixed(0)} <span className="text-sm text-muted-foreground font-normal">votes</span></p>
                      {delegatee && delegatee !== "0x0000000000000000000000000000000000000000" && (
                        <p className="text-[10px] text-muted-foreground mt-1">Delegated to: {delegatee.slice(0, 8)}...{delegatee.slice(-6)}</p>
                      )}
                    </div>
                  )}

                  {/* Self-delegate button — only if has IDIA but no voting power */}
                  {balances?.idia && parseFloat(balances.idia.balanceFormatted) > 0 && (!votingPower || parseFloat(votingPower) === 0) && (
                    <Button variant="outline" onClick={handleDelegateVotes} className="w-full">
                      <Vote className="w-4 h-4 mr-2" />Activate Voting Power
                    </Button>
                  )}

                 {/* Network selector — only visible in test builds */}
                  {IS_TESTNET && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Network className="w-3 h-3" /> Network</label>
                      <select className="w-full p-2 border rounded-md text-sm bg-background" value={activeNetworkKey} onChange={(e) => switchNetwork(e.target.value)}>
                        {availableNetworks.map(({ key, config }) => (
                          <option key={key} value={key}>{config.name}{config.isTestnet ? " (Testnet)" : ""}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  
                </CardContent>
              </Card>

              {/* ── USDC Payments (NFC + QR) ── */}
              <PaymentTrigger />

              {/* ── Request USDC Payment (only when payments enabled) ── */}
              {USDC_PAYMENTS_ENABLED && (
                <Button variant="outline" onClick={() => setShowRequestPayment(true)} className="w-full">
                  <QrCode className="w-4 h-4 mr-2" />Request USDC Payment
                </Button>
              )}

              {/* ── Wallet Management ── */}
              <Card>
                <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Shield className="w-4 h-4" />Wallet Management</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  <Button variant="outline" className="w-full" onClick={() => { setSetupMode("view-seed"); setIsSetupModalOpen(true); }}>
                    <Shield className="w-4 h-4 mr-2" />Reveal Recovery Phrase
                  </Button>
                  <Button variant="outline" className="w-full" onClick={() => { setSetupMode("import"); setIsSetupModalOpen(true); }}>
                    <Download className="w-4 h-4 mr-2" />Import Different Wallet
                  </Button>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" />{globalWalletAddress ? "Upgrade Your Wallet" : "Set Up Your IDIA Wallet"}</CardTitle>
                <CardDescription className="text-xs">
                  {globalWalletAddress ? (<>Your account is linked to a previous wallet:<br /><code className="text-[10px]">{globalWalletAddress.slice(0, 8)}...{globalWalletAddress.slice(-6)}</code><br /><br />Create or import an IDIA wallet to enable full features.</>) : ("Create a new EVM wallet or restore from a 12-word seed phrase.")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  <Button onClick={() => { setSetupMode("create"); setIsSetupModalOpen(true); }} className="bg-teal-500 hover:bg-teal-600"><Plus className="w-4 h-4 mr-2" />Create New</Button>
                  <Button variant="outline" onClick={() => { setSetupMode("import"); setIsSetupModalOpen(true); }}><Download className="w-4 h-4 mr-2" />Import</Button>
                </div>
              </CardContent>
            </Card>
          )}
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
      />
    </div>
  );
};

export default EnhancedWalletDashboard;