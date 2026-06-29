import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Loader2, Activity } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { stage } from "@/lib/stageLogger";
import { ethers } from "ethers";
import { PROTOCOL, ACTIVE_DEPLOYMENT, GOVERNOR_ABI } from "@/config/contracts";
import { NETWORKS } from "@/services/walletService";
import { readChainState } from "./ActiveProposalsList";

interface ProposalLite {
  id: string;
  title: string;
  description: string | null;
  // Added "pending" for pre-snapshot on-chain proposals
  lifecycle_phase: "draft" | "pending" | "active" | "succeeded" | "queued" | "executed";
  status: string | null;
  created_at: string;
  end_date: string | null;
  quorum_threshold: number | null;
  on_chain_block?: number | null;
  on_chain_id?: string | null;
}

export const PHASE_META = {
  draft: {
    icon: "📝",
    label: "In Deliberation",
    color: "text-slate-600 dark:text-slate-200 bg-slate-50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800",
  },
  pending: {
    icon: "⏱",
    label: "Voting Delay",
    color: "text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/30 border-indigo-100 dark:border-indigo-900/50",
  },
  active: {
    icon: "⚡",
    label: "Live Vote",
    color:
      "text-orange-600 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/50",
  },
  queued: {
    icon: "⏳",
    label: "In Timelock",
    color:
      "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/50",
  },
  succeeded: {
    icon: "✅",
    label: "Consensus Reached",
    color: "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/30 border-teal-100 dark:border-teal-900/50",
  },
  executed: {
    icon: "🚀",
    label: "Settled",
    color: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-100 dark:border-emerald-900/50",
  },
} as const;

// Direct-RPC quorum read — no service-layer cache, retry, or fallback chain.
async function directQuorum(onChainId?: string | null): Promise<bigint> {
  const networkKey = ACTIVE_DEPLOYMENT === "mainnet" ? "base" : "baseSepolia";
  const network = NETWORKS[networkKey];
  const rpcUrl = (import.meta.env.VITE_ALCHEMY_RPC_URL as string | undefined) || network.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl, network.chainId);
  const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, provider);

  if (onChainId && onChainId.trim() !== "") {
    const snap = await gov.proposalSnapshot(onChainId);
    if (snap && Number(snap) > 0) {
      const q = await gov.quorum(snap);
      return BigInt(q);
    }
  }
  const block = await provider.getBlockNumber();
  const q = await gov.quorum(block - 1);
  return BigInt(q);
}

const DetailDialog: React.FC<{ proposal: ProposalLite | null; onClose: () => void }> = ({ proposal, onClose }) => {
  const [forVotes, setForVotes] = useState<number>(0);
  const [againstVotes, setAgainstVotes] = useState<number>(0);
  const [liveQuorum, setLiveQuorum] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [deadlineState, setDeadlineState] = useState({
    label: "Syncing...",
    tone: "none" as "live" | "ended" | "none",
  });

  const blockNumber = proposal?.on_chain_block || null;

  useEffect(() => {
    if (!proposal) return;
    let alive = true;
    setLoading(true);

    const sChain = stage("LIFECYCLE_DETAIL", "ON_CHAIN_SYNC");
    sChain.start({ id: proposal.id, message: "[START] Direct RPC poll for quorum + tally." });

    const pollQuorum = async () => {
      try {
        const q = await directQuorum(proposal.on_chain_id);
        const formatted = Number(ethers.formatEther(q));
        if (alive) {
          setLiveQuorum(formatted);
        }
      } catch (qErr) {
        console.error("[QUORUM_DEBUG] Direct quorum poll failed:", qErr);
      }
    };

    (async () => {
      try {
        const voteKey = proposal.on_chain_id ?? proposal.id;
        const { data } = await supabase
          .from("dao_votes")
          .select("vote_type, vote_weight, snapshot_voting_power")
          .eq("proposal_id", voteKey);
        const rows = (data || []) as { vote_type: string; vote_weight?: number; snapshot_voting_power?: number | null }[];
        if (alive) {
          const weightOf = (r: { vote_weight?: number; snapshot_voting_power?: number | null }) =>
            Number(r.snapshot_voting_power ?? r.vote_weight ?? 1);
          const f = rows.filter((r) => r.vote_type === "for").reduce((acc, r) => acc + weightOf(r), 0);
          const a = rows.filter((r) => r.vote_type === "against").reduce((acc, r) => acc + weightOf(r), 0);
          setForVotes(f);
          setAgainstVotes(a);
        }
      } catch (tallyErr) {
        console.error("[LIFECYCLE] Tally sync failed:", tallyErr);
      }

      await pollQuorum();

      try {
        const SECONDS_PER_BLOCK = 2;
        const VOTING_DELAY_BLOCKS = 43200;
        const VOTING_PERIOD_BLOCKS = 302400;
        const totalDurationSec = (VOTING_DELAY_BLOCKS + VOTING_PERIOD_BLOCKS) * SECONDS_PER_BLOCK;
        const endMs = new Date(proposal.created_at).getTime() + totalDurationSec * 1000;
        const diff = endMs - Date.now();

        if (alive) {
          if (diff <= 0) {
            setDeadlineState({ label: "Voting Closed · Deadline Passed", tone: "ended" });
          } else {
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setDeadlineState({ label: `Auto-fails in ${d}d ${h}h ${m}m`, tone: "live" });
          }
        }
      } catch (timelineErr) {
        console.error("[LIFECYCLE] Timeline calculation failed:", timelineErr);
        if (alive) setDeadlineState({ label: "Timeline Unavailable", tone: "none" });
      }

      sChain.ok({ message: "[END:OK] Initial sync complete." });
      if (alive) setLoading(false);
    })();

    const iv = setInterval(pollQuorum, 15000);

    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [proposal]);

  const activeQuorum = liveQuorum;
  const totalVotes = forVotes + againstVotes;

  const pct = useMemo(() => {
    if (activeQuorum === 0) return totalVotes > 0 ? 100 : 0;
    return Math.min(100, (totalVotes / activeQuorum) * 100);
  }, [totalVotes, activeQuorum]);

  const meta = proposal ? PHASE_META[proposal.lifecycle_phase] || PHASE_META.draft : null;

  return (
    <Dialog open={!!proposal} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        {proposal && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2 mb-1">
                {meta && (
                  <Badge className={cn("text-[9px] font-black uppercase tracking-widest border", meta.color)}>
                    {meta.icon} {meta.label}
                  </Badge>
                )}
                {proposal.status && (
                  <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">
                    {proposal.status}
                  </Badge>
                )}
              </div>
              <DialogTitle className="font-black text-lg leading-tight text-foreground">{proposal.title}</DialogTitle>
              <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-400">
                <Activity className="w-3 h-3" />
                {blockNumber ? <span>Block: #{blockNumber}</span> : <span>Block: Pending Chain Sync</span>}
              </div>
              <DialogDescription className="text-xs whitespace-pre-wrap text-muted-foreground">
                {proposal.description || "No description provided."}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              <div className="p-4 rounded-2xl border border-teal-100 dark:border-teal-900/40 bg-teal-50/40 dark:bg-teal-950/20 space-y-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-200">
                    Quorum Progress
                  </span>
                  <span className="text-[10px] font-black tracking-widest text-teal-700 dark:text-teal-200">
                    {loading && activeQuorum === 0
                      ? "…"
                      : `${totalVotes.toLocaleString()} / ${activeQuorum.toLocaleString()} (${pct.toFixed(1)}%)`}
                  </span>
                </div>
                <Progress value={pct} className="h-2" />
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground pt-1">
                  <span>✔ For: {forVotes}</span>
                  <span>✘ Against: {againstVotes}</span>
                </div>
              </div>

              <div
                className={cn(
                  "p-3 rounded-2xl border text-[10px] font-black uppercase tracking-widest",
                  deadlineState.tone === "live" &&
                    "border-orange-100 dark:border-orange-900/40 bg-orange-50/50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-200",
                  deadlineState.tone === "ended" &&
                    "border-rose-100 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-200",
                  deadlineState.tone === "none" &&
                    "border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 text-slate-600 dark:text-slate-300",
                )}
              >
                ⏱ {deadlineState.label}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const LifecycleTelemetry: React.FC = () => {
  const [items, setItems] = useState<ProposalLite[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<ProposalLite | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchItems = async () => {
      console.log("[LIFECYCLE_TELEMETRY][FETCH][START] Executing aggregate state poll.");
      const s = stage("LIFECYCLE_TELEMETRY", "FETCH");
      s.start();
      try {
        const { data, error } = await supabase
          .from("dao_proposals")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(10);
          
        if (error) {
          console.error(`[LIFECYCLE_TELEMETRY][FETCH][ERROR] Supabase fetch rejected: ${error.message}`);
          throw error;
        }
        
        if (isMounted) {
          const rows = ((data as any[]) || []).map((item) => ({
            ...item,
            lifecycle_phase: item.lifecycle_phase,
          })) as ProposalLite[];

          console.log(`[LIFECYCLE_TELEMETRY][FETCH][PROCESS] Iterating ${rows.length} rows for chain validation.`);
          
          // REPLACED THE STRICT BUCKET FILTER
          // Maps all OpenZeppelin EVM states and preserves off-chain drafts
          const stateChecks = await Promise.all(
            rows.map(async (r) => {
              if (!r.on_chain_id) {
                // Return off-chain motions/drafts directly
                return { ...r, lifecycle_phase: "draft" as const, status: "In Deliberation" };
              }
              
              try {
                const cs = await readChainState(r.on_chain_id);
                const st = cs.state;
                console.log(`[TELEMETRY_BUCKET] ref=${r.on_chain_id} resolved state=${st}`);
                
                if (st === 0) return { ...r, lifecycle_phase: "pending" as const, status: "Voting Delay" };
                if (st === 1) return { ...r, lifecycle_phase: "active" as const, status: "Live Vote" };
                if (st === 4) return { ...r, lifecycle_phase: "succeeded" as const, status: "Consensus Reached" };
                if (st === 5) return { ...r, lifecycle_phase: "queued" as const, status: "Timelocked" };
                if (st === 7) return { ...r, lifecycle_phase: "executed" as const, status: "Executed" };
                
                // Fallback for canceled/defeated EVM states
                return { ...r, lifecycle_phase: "draft" as const, status: "Archived" };
              } catch (chainErr: any) {
                console.error(`[TELEMETRY_BUCKET][ERROR] Failed to read chain state for ${r.on_chain_id}: ${chainErr.message}`);
                return null;
              }
            }),
          );
          
          const order = { active: 0, pending: 1, succeeded: 2, queued: 3, executed: 4, draft: 5 } as const;
          
          if (isMounted) {
            setItems(
              stateChecks
                .filter((x): x is ProposalLite => x !== null)
                .sort((a, b) => order[a.lifecycle_phase] - order[b.lifecycle_phase]),
            );
          }
        }
        console.log("[LIFECYCLE_TELEMETRY][FETCH][END:OK] Telemetry feed hydrated successfully.");
        s.ok({ count: data?.length });
      } catch (error: any) {
        console.error(`[LIFECYCLE_TELEMETRY][FETCH][FATAL_FAIL] Feed generation collapsed: ${error.message}`);
        s.fail(error);
        toast({ title: "Telemetry Stalled", description: error.message, variant: "destructive" });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchItems();
    const ch = supabase
      .channel("dao_proposals_telemetry")
      .on(
        "postgres_changes" as any,
        { event: "*", schema: "public", table: "dao_proposals" },
        () => fetchItems(),
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(ch);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest">Syncing Live Telemetry...</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <Activity className="w-5 h-5" />
        <p className="text-[10px] font-black uppercase tracking-widest">No Telemetry Detected</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((it) => {
          const meta = PHASE_META[it.lifecycle_phase] || PHASE_META.draft;
          return (
            <button
              key={it.id}
              onClick={() => setSelected(it)}
              className="w-full text-left flex items-center gap-4 p-3.5 bg-white dark:bg-card border border-teal-50 dark:border-teal-900/40 shadow-sm rounded-2xl transition-all hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700/60 active:scale-[0.99]"
            >
              <div
                className={cn(
                  "w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center text-lg",
                  meta.color,
                )}
              >
                {meta.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-black text-slate-800 dark:text-foreground truncate">{it.title}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={cn(
                      "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                      meta.color,
                    )}
                  >
                    {meta.label}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    · {new Date(it.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <DetailDialog proposal={selected} onClose={() => setSelected(null)} />
    </>
  );
};

export default LifecycleTelemetry;