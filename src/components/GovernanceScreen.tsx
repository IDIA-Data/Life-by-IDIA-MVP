import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Zap, Gavel, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import SegmentedJurisdiction, { Jurisdiction } from "./governance/SegmentedJurisdiction";
import HatsWardrobe from "./governance/HatsWardrobe";
import PendingActionsCarousel from "./governance/PendingActionsCarousel";
import ActiveProposalsList from "./governance/ActiveProposalsList";
import LifecycleTelemetry from "./governance/LifecycleTelemetry";
import MSAComplianceCard from "./governance/MSAComplianceCard";
import TreasuryFlows from "./governance/TreasuryFlows";
import CommitteesList from "./governance/CommitteesList";

const GovernanceScreen: React.FC = () => {
  const [balance, setBalance] = useState<number>(0);
  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("wyoming");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // Anchored to Zero Floor — wallets has no governance_tokens column yet.
      setBalance(0);
    })();
  }, []);

  return (
    <div className="space-y-5 bg-white min-h-screen p-4 pb-24 animate-in fade-in duration-700">
      {/* Sovereign Governance Credit Card */}
      <Card className="bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden">
        <CardContent className="p-7">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-100/60">
                Sovereign Governance Credit
              </p>
              <h1 className="text-4xl font-black">
                {balance.toLocaleString()} <span className="text-sm font-medium text-teal-100/40">IDIA</span>
              </h1>
            </div>
            <ShieldCheck className="w-10 h-10 text-orange-400 drop-shadow-lg" />
          </div>
          <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
            <Zap size={12} className="text-orange-400" />
            <span className="text-[9px] font-black uppercase tracking-widest text-teal-50">
              Dual-Jurisdiction Mainnet · WY DUNA × DE MSA
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Jurisdiction Toggle */}
      <SegmentedJurisdiction value={jurisdiction} onChange={setJurisdiction} />

      {/* Hats Wardrobe — always visible */}
      <HatsWardrobe />

      {/* Active Portal */}
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
              <Gavel size={14} className="text-teal-600" /> Active Proposals · Quadratic
            </h2>
            <ActiveProposalsList balance={balance} />
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
  );
};

export default GovernanceScreen;
