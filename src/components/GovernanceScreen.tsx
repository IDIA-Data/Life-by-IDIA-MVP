import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Zap, Gavel, Activity, Plus, Vote, Users, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useGovernance } from "@/hooks/useGovernance";

// Existing governance components
import SegmentedJurisdiction, { Jurisdiction } from "./governance/SegmentedJurisdiction";
import HatsWardrobe from "./governance/HatsWardrobe";
import PendingActionsCarousel from "./governance/PendingActionsCarousel";
import ActiveProposalsList from "./governance/ActiveProposalsList";
import LifecycleTelemetry from "./governance/LifecycleTelemetry";
import MSAComplianceCard from "./governance/MSAComplianceCard";
import TreasuryFlows from "./governance/TreasuryFlows";
import CommitteesList from "./governance/CommitteesList";

// New on-chain governance components
import DelegationPanel from "./governance/DelegationPanel";
import OnChainProposals from "./governance/OnChainProposals";
import CreateProposal from "./governance/CreateProposal";

type GovernanceTab = 'overview' | 'proposals' | 'create' | 'community';

const GovernanceScreen: React.FC = () => {
  const [offChainBalance, setOffChainBalance] = useState<number>(0);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("wyoming");
  const [activeTab, setActiveTab] = useState<GovernanceTab>('overview');

  const { delegation, params, currentQuorum } = useGovernance();

  // Legacy off-chain balance (from wallets table)
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data, error } = await supabase
        .from("wallets")
        .select("governance_tokens")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) {
        console.error("[GOVERNANCE] Failed to load IDIA balance:", error.message);
        setOffChainBalance(0);
        return;
      }
      setOffChainBalance(Number((data as any)?.governance_tokens ?? 0));
    })();
  }, []);

  // Use on-chain balance if available, fall back to off-chain
  const displayBalance = delegation
    ? Number(delegation.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : offChainBalance.toLocaleString();

  const displayVotingPower = delegation
    ? Number(delegation.votingPower).toLocaleString(undefined, { maximumFractionDigits: 0 })
    : '0';

  const tabs: { key: GovernanceTab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 size={14} /> },
    { key: 'proposals', label: 'Proposals', icon: <Vote size={14} /> },
    { key: 'create', label: 'New', icon: <Plus size={14} /> },
    { key: 'community', label: 'Community', icon: <Users size={14} /> },
  ];

  return (
    <div className="space-y-5 bg-white min-h-screen p-4 pb-24 animate-in fade-in duration-700">

      {/* ── Token + Voting Power Card ────────────────────────── */}
      <Card className="bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-7">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-100/60">
                IDIA Governance Token
              </p>
              <h1 className="text-4xl font-black">
                {displayBalance} <span className="text-sm font-medium text-teal-100/40">IDIA</span>
              </h1>
            </div>
            <ShieldCheck className="w-10 h-10 text-orange-400 drop-shadow-lg" />
          </div>

          {/* Voting power + quorum row */}
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-teal-100/50">Voting Power</p>
              <p className="text-lg font-black">{displayVotingPower}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-[9px] font-black uppercase tracking-wider text-teal-100/50">
                Quorum ({params ? (params.quorumNumerator / 100).toFixed(0) : '4'}%)
              </p>
              <p className="text-lg font-black">
                {Number(currentQuorum).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-2 border-t border-white/10 pt-4">
            <Zap size={12} className="text-orange-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-teal-50">
              {delegation?.isDelegated
                ? (delegation.isSelfDelegated ? 'Self-delegated · Voting Active' : `Delegated to ${delegation.delegatee.slice(0, 8)}...`)
                : 'Not delegated · Activate below'
              }
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Tab Navigation ───────────────────────────────────── */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-2xl">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
              activeTab === tab.key
                ? 'bg-white text-teal-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab Content ──────────────────────────────────────── */}

      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Delegation panel — always show on overview */}
          <DelegationPanel />

          {/* Hats Wardrobe */}
          <HatsWardrobe />

          {/* Jurisdiction toggle */}
          <SegmentedJurisdiction value={jurisdiction} onChange={setJurisdiction} />

          {jurisdiction === "wyoming" ? (
            <div className="space-y-6">
              <section className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                  <Zap size={14} className="text-orange-500" /> Pending Actions · Negative Consent
                </h2>
                <PendingActionsCarousel />
              </section>

              <section className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
                  <Activity size={14} className="text-teal-600" /> Lifecycle Telemetry
                </h2>
                <LifecycleTelemetry />
              </section>
            </div>
          ) : (
            <div className="space-y-5">
              <MSAComplianceCard />
              <TreasuryFlows />
              <CommitteesList />
            </div>
          )}
        </div>
      )}

      {activeTab === 'proposals' && (
        <div className="space-y-5">
          {/* On-chain proposals from the Governor contract */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
              <Gavel size={14} className="text-teal-600" /> On-Chain Proposals
            </h2>
            <OnChainProposals />
          </section>

          {/* Legacy off-chain proposals (from dao_proposals table) */}
          <section className="space-y-3">
            <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
              <Gavel size={14} className="text-orange-500" /> Community Proposals · Quadratic
            </h2>
            <ActiveProposalsList balance={offChainBalance} />
          </section>
        </div>
      )}

      {activeTab === 'create' && (
        <CreateProposal onClose={() => setActiveTab('proposals')} />
      )}

      {activeTab === 'community' && (
        <div className="space-y-5">
          <CommitteesList />
          <TreasuryFlows />
        </div>
      )}
    </div>
  );
};

export default GovernanceScreen;
