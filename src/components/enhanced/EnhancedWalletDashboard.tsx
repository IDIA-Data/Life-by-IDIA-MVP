import React, { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AddFundsModal from "../AddFundsModal";
import WalletSetupModal from "../WalletSetupModal";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription,
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
import NFCPayrollModal from "../NFCPayrollModal";
import SendRequestModal from "../SendRequestModal";
import PaymentTrigger from "../PaymentTrigger";
import RequestPaymentQR from "../RequestPaymentQR";
import { fireFinaleConfetti } from "../psychometric/confetti";
import {
  Wallet, CreditCard, TrendingUp, ArrowUpRight, ArrowDownLeft, Shield,
  Download, Smartphone, Plus, BrainCircuit, ArrowRight, Network, RefreshCw,
  Send, Copy, Loader2, Link2, AlertTriangle, QrCode, Vote,
} from "lucide-react";

interface Transaction {
  id: string; transaction_type: string; amount: number; description: string;
  source: string; created_at: string; metadata?: any;
}
interface CreditSimulation {
  current_score: number | string; simulated_score: number; actions: string[];
}

const EnhancedWalletDashboard: React.FC = () => {
  const { profile, loading, updateProfile } = useEnhancedProfile();
  const { balance: walletBalance, loading: balanceLoading, fiatProvisioned, usdcProvisioned, usdcAddress } = useWalletBalance();
  const [stableUserId, setStableUserId] = useState<string | null>(null);
  const [setupMode, setSetupMode] = useState<'create' | 'import' | 'view-seed'>('create');
  const [showRequestPayment, setShowRequestPayment] = useState(false);

  useEffect(() => {
    const resolvedId = profile?.id || profile?.user_id;
    if (resolvedId && resolvedId !== stableUserId) setStableUserId(resolvedId);
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
      if (event.data?.type === "IDIA_AUTH_COMPLETE") window.location.href = "/dashboard";
    };
    window.addEventListener("message", h);
    return () => window.removeEventListener("message", h);
  }, []);

  // ── Transactions ──
  useEffect(() => { fetchTransactions(); }, []);
  const fetchTransactions = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30);
      if (data) setTransactions(data.map((tx) => {
        const meta = tx.metadata as Record<string, any> | null;
        return { id: tx.id, transaction_type: tx.transaction_type, amount: tx.amount,
          description: tx.description, source: (tx as any).currency || meta?.currency || "USD",
          created_at: tx.created_at, metadata: tx.metadata };
      }));
    } catch (e) { console.error("Transaction fetch error:", e); }
  };

  const handleCalculateScore = async (moduleScores: Record<string, number>) => {
    setIsCalculating(true);
    try {
      const { tut, ...actualTelemetry } = moduleScores;
      const { data, error } = await supabase.functions.invoke("calculate-trust-score", {
        body: { user_id: stableUserId, telemetry: actualTelemetry },
      });
      if (error) throw error;
      if (updateProfile) await updateProfile({ trust_score: data.trust_score, available_credit_line: data.credit_line });
      setCreditSimulation({ current_score: profile?.trust_score ?? "NO SCORE", simulated_score: data.trust_score, actions: ["Telemetry verified", "Capital limit recalculated"] });
    } catch (err) { console.error("Score calculation failed:", err); }
    finally { setIsCalculating(false); setShowTestModal(false); setTimeout(() => fireFinaleConfetti(), 400); }
  };

  // ── Transaction display helpers ──
  const getTransactionIcon = (type: string, currency: string) => {
    if (currency === "USDC") return Shield;
    if (currency === "IDIA Token") return BrainCircuit;
    switch (type) {
      case "DATA_SALE_PAYOUT": case "data_reward": case "data_earnings": return TrendingUp;
      case "payment_sent": return ArrowUpRight;
      case "payment_received": case "payroll": return ArrowDownLeft;
      case "nfc_payroll": return Smartphone;
      default: return CreditCard;
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
        <DialogHeader className="sr-only"><DialogTitle>Psychometric Validation</DialogTitle><DialogDescription>Establish your IDIA Trust Score.</DialogDescription></DialogHeader>
        <PsychometricTestingCenter onCompleteAll={handleCalculateScore} onCancel={() => setShowTestModal(false)} />
      </DialogContent>
    </Dialog>
  );

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
        <TabsList className="grid grid-cols-4 w-full bg-muted/20 shrink-0">
          <TabsTrigger value="overview" className="text-[11px] px-1">Overview</TabsTrigger>
          <TabsTrigger value="transactions" className="text-[11px] px-1">History</TabsTrigger>
          <TabsTrigger value="credit" className="text-[11px] px-1">Credit</TabsTrigger>
          <TabsTrigger value="security" className="text-[11px] px-1">Wallet</TabsTrigger>
        </TabsList>

        {/* ═══ OVERVIEW TAB ═══ */}
        <TabsContent value="overview" className="space-y-4">
          <Card className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white relative overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4"><h2 className="text-lg font-bold">Total Balance</h2><Wallet className="w-6 h-6 opacity-50" /></div>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center"><p className="text-teal-100 text-[10px] font-medium uppercase">Fiat (USD)</p><p className="text-xl font-bold">${walletBalance?.cash_balance?.toFixed(2) || "0.00"}</p></div>
                <div className="text-center border-x border-white/20"><p className="text-teal-100 text-[10px] font-medium uppercase">Stable USDC</p><p className="text-xl font-bold">${walletBalance?.usdc_balance?.toFixed(2) || "0.00"}</p></div>
                <div className="text-center"><p className="text-teal-100 text-[10px] font-medium uppercase">IDIA Token</p><p className="text-xl font-bold">{walletBalance?.idia_token_balance?.toFixed(2) || "0.00"}</p></div>
              </div>
              {!isProvisioned && (<div className="mt-4 pt-2 border-t border-white/20 text-center"><p className="text-[10px] text-teal-50 italic">Link a Sovereign Vault to enable liquidation</p></div>)}
            </CardContent>
          </Card>
          <div className="grid grid-cols-3 gap-4">
            <Button className="h-14 flex-col bg-teal-600 hover:bg-teal-700 text-xs" onClick={() => setShowSendRequestModal(true)}><div className="flex space-x-1 mb-1"><ArrowUpRight className="w-4 h-4" /><ArrowDownLeft className="w-4 h-4" /></div>Send/Req</Button>
            <Button variant="outline" className="h-14 flex-col text-xs" onClick={() => setShowNFCModal(true)}><Smartphone className="w-5 h-5 mb-1" /> Tap Pay</Button>
            <Button variant="outline" className="h-14 flex-col text-xs" onClick={() => setShowAddFundsModal(true)} disabled={!fiatProvisioned && !usdcProvisioned}><Plus className="w-5 h-5 mb-1" /> Add Funds</Button>
          </div>
        </TabsContent>

        {/* ═══ TRANSACTIONS TAB ═══ */}
        <TabsContent value="transactions" className="flex-1 min-h-0 overflow-hidden mt-2">
          <div className="h-full overflow-y-auto touch-pan-y no-scrollbar pr-1" style={{ WebkitOverflowScrolling: "touch" }}>
            {transactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground italic">No records found</div>
            ) : (
              <div className="space-y-3 pb-4">
                {transactions.map((tx) => {
                  const Icon = getTransactionIcon(tx.transaction_type, tx.source);
                  return (
                    <div key={tx.id} className="flex items-center space-x-3 p-3 border rounded-lg bg-card">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center"><Icon className="w-5 h-5 text-muted-foreground" /></div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{tx.description}</p>
                        <div className="flex items-center gap-2"><p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleDateString()}</p><Badge variant="outline" className="text-[9px] h-4 py-0 px-1 uppercase opacity-70">{tx.source}</Badge></div>
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
          <Card><CardHeader><CardTitle>Capital Advancement</CardTitle></CardHeader><CardContent>
            {creditSimulation ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 border rounded-lg"><p className="text-xs text-muted-foreground">Current</p><p className="text-xl font-bold">{creditSimulation.current_score}</p></div>
                  <div className="text-center p-4 border rounded-lg bg-green-50/30"><p className="text-xs text-muted-foreground">Updated</p><p className="text-xl font-bold text-green-600">{creditSimulation.simulated_score}</p></div>
                </div>
                <div className="pt-4"><TestModal /></div>
              </div>
            ) : (
              <div className="text-center py-8 flex flex-col items-center">
                <BrainCircuit className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-sm text-muted-foreground max-w-xs mb-6">Limits are calculated via verifiable behavioral telemetry.</p>
                <TestModal />
              </div>
            )}
          </CardContent></Card>
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
                    <p className="font-mono text-xs break-all">{wallet.address}</p>
                  </div>

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
        </TabsContent>
      </Tabs>

      {/* ═══ MODALS ═══ */}
      <NFCPayrollModal isOpen={showNFCModal} onClose={() => setShowNFCModal(false)} />
      <SendRequestModal isOpen={showSendRequestModal} onClose={() => setShowSendRequestModal(false)} />
      <AddFundsModal isOpen={showAddFundsModal} onClose={() => setShowAddFundsModal(false)} fiatEnabled={fiatProvisioned} usdcEnabled={usdcProvisioned} usdcAddress={usdcAddress || globalWalletAddress || wallet?.address || null} />
      <WalletSetupModal isOpen={isSetupModalOpen} onClose={() => setIsSetupModalOpen(false)} mode={setupMode} onCreateWallet={handleCreateWallet} onImportWallet={handleImportWallet} getSeedPhrase={handleGetSeedPhrase} walletAddress={wallet?.address || displayAddress} />
      {wallet && (<RequestPaymentQR isOpen={showRequestPayment} onClose={() => setShowRequestPayment(false)} walletAddress={wallet.address} />)}
    </div>
  );
};

export default EnhancedWalletDashboard;