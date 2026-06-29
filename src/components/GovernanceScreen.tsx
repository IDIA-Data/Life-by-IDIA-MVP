import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Zap, Gavel, Activity, ExternalLink, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useWalletBalance } from "@/hooks/useWalletBalance";
import SegmentedJurisdiction, { Jurisdiction } from "./governance/SegmentedJurisdiction";
import HatsWardrobe from "./governance/HatsWardrobe";
import PendingActionsCarousel from "./governance/PendingActionsCarousel";
import ActiveProposalsList from "./governance/ActiveProposalsList";
import LifecycleTelemetry from "./governance/LifecycleTelemetry";
import LockedProposalsList from "./governance/LockedProposalsList";
import ArchiveProposalsList from "./governance/ArchiveProposalsList";

import MSAComplianceCard from "./governance/MSAComplianceCard";
import TreasuryFlows from "./governance/TreasuryFlows";
import CommitteesList from "./governance/CommitteesList";
import CommitteeWorkspace from "./governance/CommitteeWorkspace";
import ApplicationReviewQueue from "./governance/ApplicationReviewQueue";
import AuditFeed from "./governance/AuditFeed";
import WelcomeManualGate from "./governance/WelcomeManualGate";
import CreateDaoProposalModal from "./governance/CreateDaoProposalModal";
import { PROTOCOL, ACTIVE_DEPLOYMENT } from "@/config/contracts";
import { ACTION_REQUIRED_LEVEL, getAscensionLevel, type AscensionLevel } from "@/utils/governanceGate";

const IDIA_CONTRACT = PROTOCOL.idiaToken;
const IS_MAINNET = ACTIVE_DEPLOYMENT === "mainnet";

// ==========================================
// 1. ERROR BOUNDARY
// ==========================================
class CommitteeWorkspaceBoundary extends React.Component<{}, { hasError: boolean; error: Error | null }> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false, error: null };
    console.log("[COMMITTEE_WORKSPACE][MOUNT][START] Mounting boundary.");
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error) {
    console.error(`[COMMITTEE_WORKSPACE][MOUNT][FATAL_FAIL] Failed to mount: ${error.message}`);
  }
  componentDidMount() {
    console.log("[COMMITTEE_WORKSPACE][MOUNT][END:OK] Mounted successfully.");
  }
  componentWillUnmount() {
    console.log("[COMMITTEE_WORKSPACE][UNMOUNT][END:OK] Process concluded.");
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50 text-xs text-red-700">
          Deliberation workspace failed to mount. Check console for trace.
        </div>
      );
    }
    return <CommitteeWorkspace />;
  }
}

// ==========================================
// 2. MODULAR PORTALS
// ==========================================

const IdiaGovernanceCard: React.FC<{ idiaBalance: number; chainVerified: boolean }> = ({ idiaBalance, chainVerified }) => (
  <Card className="bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden shrink-0">
    <CardContent className="p-7">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-100/60">
            IDIA Governance Token
          </p>
          <h1 className="text-4xl font-black truncate">
            {idiaBalance.toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
            <span className="text-sm font-medium text-teal-100/40">IDIA</span>
          </h1>
        </div>
        <ShieldCheck className="w-10 h-10 text-orange-400 drop-shadow-lg shrink-0" />
      </div>
      <a
        href={`https://basescan.org/token/${IDIA_CONTRACT}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4 hover:opacity-80 transition-opacity"
      >
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${chainVerified ? "bg-emerald-400 animate-pulse" : "bg-orange-400"}`} />
        <span className="text-[9px] font-black uppercase tracking-widest text-teal-50 truncate">
          {IS_MAINNET ? "Live · Base Mainnet" : "Mainnet"} · {IDIA_CONTRACT.slice(0, 6)}…{IDIA_CONTRACT.slice(-4)}
        </span>
        <ExternalLink size={10} className="text-teal-100/60 ml-auto shrink-0" />
      </a>
    </CardContent>
  </Card>
);

const WyomingPortal: React.FC<{
  idiaBalance: number;
  votingPower: number;
  isSelfDelegated: boolean;
  canSubmitProposal: boolean;
  refreshBalance: () => void;
  refreshKey: number;
  onOpenCreateModal: () => void;
}> = ({ idiaBalance, votingPower, isSelfDelegated, canSubmitProposal, refreshBalance, refreshKey, onOpenCreateModal }) => (
  <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
        <Zap size={14} className="text-orange-500" /> Pending Actions · Negative Consent
      </h2>
      <PendingActionsCarousel escrowTargets={PROTOCOL.escrow} />
    </section>

    <section className="space-y-3">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Gavel size={14} className="text-teal-600" /> Active Proposals · 1:1 Vote
        </h2>
        {canSubmitProposal && (
          <Button
            size="sm"
            onClick={onOpenCreateModal}
            className="h-8 bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase text-[9px] tracking-widest rounded-full px-3 shrink-0"
          >
            <Plus size={12} className="mr-1" /> Submit Proposal
          </Button>
        )}
      </div>
      <ActiveProposalsList
        balance={idiaBalance}
        votingPower={votingPower}
        isSelfDelegated={isSelfDelegated}
        onDelegationChanged={refreshBalance}
        refreshTrigger={refreshKey}
      />
    </section>

    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
        <Activity size={14} className="text-teal-600" /> Lifecycle Telemetry
      </h2>
      <LifecycleTelemetry />
    </section>

    <section className="space-y-3">
      <ArchiveProposalsList
        balance={idiaBalance}
        votingPower={votingPower}
        refreshTrigger={refreshKey}
      />
    </section>

    <section className="space-y-3">
      <LockedProposalsList
        balance={idiaBalance}
        votingPower={votingPower}
        refreshTrigger={refreshKey}
      />
    </section>
  </div>
);

const DelawarePortal: React.FC = () => (
  <div className="space-y-5 animate-in slide-in-from-left-4 duration-300">
    <MSAComplianceCard />
    <TreasuryFlows />
    <ApplicationReviewQueue />
    <CommitteesList />
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
        <Gavel size={14} className="text-teal-600" /> Committee Deliberations · Motion Threads
      </h2>
      <CommitteeWorkspaceBoundary />
    </section>
    <AuditFeed />
  </div>
);

// ==========================================
// 3. MAIN ORCHESTRATOR
// ==========================================

const GovernanceScreen: React.FC = () => {
  const { balance, usdcProvisioned, usdcAddress, refreshBalance } = useWalletBalance();
  const idiaBalance = balance.idia_token_balance;
  const chainVerified = usdcProvisioned; 
  const isSelfDelegated = !!(
    usdcAddress &&
    balance.delegatee &&
    balance.delegatee.toLowerCase() === usdcAddress.toLowerCase()
  );

  const [jurisdiction, setJurisdiction] = useState<Jurisdiction>("wyoming");
  const [userId, setUserId] = useState<string | null>(null);
  const [needsWelcomeAck, setNeedsWelcomeAck] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [ascensionLevel, setAscensionLevel] = useState<AscensionLevel>(0);
  const canSubmitProposal = ascensionLevel >= ACTION_REQUIRED_LEVEL.SUBMIT_PROPOSAL;

  useEffect(() => {
    let isMounted = true;

    const initializeGovernanceState = async () => {
      console.log("[GOVERNANCE_SCREEN][INIT][START] Authenticating session and evaluating ascension limits.");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        
        if (!user) {
          console.log("[GOVERNANCE_SCREEN][INIT][SKIP] No authenticated user detected.");
          return;
        }

        if (isMounted) setUserId(user.id);
        
        const ackAt = (user.user_metadata as any)?.duna_welcome_ack_at;
        if (!ackAt && isMounted) {
          console.log("[GOVERNANCE_SCREEN][INIT][GATE_TRIGGER] First visit detected. Locking view behind Welcome Manual.");
          setNeedsWelcomeAck(true);
        }

        console.log("[GOVERNANCE_SCREEN][HATS_FETCH][START] Retrieving cryptographic hat assignments.");
        const { data: hats, error: hatsError } = await (supabase as any)
          .from("dao_hats")
          .select("hat_type")
          .eq("user_id", user.id)
          .eq("eligibility_status", "active")
          .is("revoked_at", null);

        if (hatsError) throw hatsError;

        const hatSet = new Set<string>((hats || []).map((h: any) => h.hat_type));
        if (isMounted) setAscensionLevel(getAscensionLevel(hatSet));

        console.log("[GOVERNANCE_SCREEN][INIT][END:OK] Governance state successfully hydrated.");
      } catch (error: any) {
        console.error(`[GOVERNANCE_SCREEN][INIT][FATAL_FAIL] Boot sequence collapsed. Reason: ${error.message}`);
      }
    };

    initializeGovernanceState();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col space-y-5 bg-white dark:bg-background min-h-screen p-4 pb-24 overflow-x-hidden animate-in fade-in duration-700">
      
      <IdiaGovernanceCard idiaBalance={idiaBalance} chainVerified={chainVerified} />

      <SegmentedJurisdiction value={jurisdiction} onChange={setJurisdiction} />

      <HatsWardrobe />

      {/* Lazy-evaluated portals to preserve mobile memory */}
      {jurisdiction === "wyoming" ? (
        <WyomingPortal 
          idiaBalance={idiaBalance}
          votingPower={balance.voting_power ?? 0}
          isSelfDelegated={isSelfDelegated}
          canSubmitProposal={canSubmitProposal}
          refreshBalance={refreshBalance}
          refreshKey={refreshKey}
          onOpenCreateModal={() => setIsCreateModalOpen(true)}
        />
      ) : (
        <DelawarePortal />
      )}

      {needsWelcomeAck && userId && (
        <WelcomeManualGate
          userId={userId}
          onAcknowledged={() => setNeedsWelcomeAck(false)}
        />
      )}

      <CreateDaoProposalModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => setRefreshKey((p) => p + 1)}
      />
    </div>
  );
};

export default GovernanceScreen;