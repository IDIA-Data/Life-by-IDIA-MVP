import React, { useEffect, useRef, useState } from "react";
import { Timer, ChevronDown, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { notify } from "@/lib/notify";
import { stage } from "@/lib/stageLogger";
import { governanceService, type ProposalOnChain } from "@/services/governanceService";
import {
  ProposalCard,
  readChainState,
  sortByGovernanceOrder,
  type Proposal,
  type ChainState,
} from "./ActiveProposalsList";
import { getAscensionLevel, type AscensionLevel } from "@/utils/governanceGate";

interface Props {
  balance: number;
  votingPower: number | string;
  refreshTrigger?: number;
}

// Governor state 5 = Queued (in timelock / awaiting execution).
// Succeeded (4) and Executed (7) are NOT execution-phase — they live in Successful Quorum Reached.
const EXECUTION_STATES = new Set([5]);
const EXECUTION_PHASES = new Set([
  "queued",
  "timelock",
  "in_timelock",
  "awaiting_execution",
  "pending_execution",
]);

const SEEN_KEY = "execution_phase_seen_ids_v1";

const normalize = (v?: string | null) =>
  (v || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const readSeen = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
};

const writeSeen = (ids: Set<string>) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* noop */
  }
};

const ExecutionPhaseList: React.FC<Props> = ({ balance, votingPower, refreshTrigger = 0 }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [chainStates, setChainStates] = useState<Map<string, ChainState>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [ascensionLevel, setAscensionLevel] = useState<AscensionLevel>(0);
  const [glow, setGlow] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let alive = true;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const s = stage("EXECUTION_PHASE", "FETCH_HYBRID");
      s.start();
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (alive) setUserId(user?.id ?? null);

        if (user && alive) {
          const { data: hats } = await (supabase as any)
            .from("dao_hats")
            .select("hat_type")
            .eq("user_id", user.id)
            .eq("eligibility_status", "active")
            .is("revoked_at", null);
          const hatSet = new Set<string>((hats || []).map((h: any) => h.hat_type));
          if (alive) setAscensionLevel(getAscensionLevel(hatSet));
        }

        const dbProposals = await (supabase as any)
          .from("dao_proposals")
          .select("id, title, description, status, proposer_id, on_chain_id, lifecycle_phase, created_at, end_date, committee_id")
          .order("created_at", { ascending: false });
        if (dbProposals.error) throw dbProposals.error;

        await delay(400);
        const onChainProposals = await governanceService
          .getRecentProposals(user?.id || "")
          .catch(() => []);
        const indexedById = new Map<string, ProposalOnChain>(
          onChainProposals.map((p): [string, ProposalOnChain] => [p.proposalId, p]),
        );

        const anchoredIds = new Set<string>(
          (dbProposals.data || [])
            .map((r: any) => r.on_chain_id)
            .filter((x: unknown): x is string => typeof x === "string" && x.length > 0),
        );

        const dbRows: Proposal[] = (dbProposals.data || []).map((r: any) => {
          const indexed = r.on_chain_id ? indexedById.get(r.on_chain_id) : undefined;
          return {
            id: r.id,
            proposal_ref: r.on_chain_id ?? r.id,
            title: r.title,
            description: r.description,
            status: indexed?.stateName ?? r.status,
            proposer_id: r.proposer_id,
            on_chain_id: r.on_chain_id ?? null,
            lifecycle_phase: indexed?.stateName ?? r.lifecycle_phase ?? null,
            created_at: r.created_at ?? null,
            end_date: r.end_date ?? null,
            committee_id: r.committee_id ?? null,
            indexed_state: indexed?.state ?? null,
          };
        });

        const chainRows: Proposal[] = onChainProposals
          .filter((p) => !anchoredIds.has(p.proposalId))
          .map((p) => ({
            id: p.proposalId,
            proposal_ref: p.proposalId,
            title: p.description.split("\n")[0],
            description: p.description,
            status: p.stateName,
            proposer_id: p.proposer,
            on_chain_id: p.proposalId,
            lifecycle_phase: p.stateName,
            created_at: null,
            indexed_state: p.state,
          }));

        const combined = [...dbRows, ...chainRows];

        const entries = await Promise.all(
          combined.map(async (p) => {
            if (!p.on_chain_id) return [p.proposal_ref, null] as const;
            try {
              const cs = await readChainState(p.on_chain_id);
              return [p.proposal_ref, cs] as const;
            } catch {
              return [p.proposal_ref, p.indexed_state != null ? {
                snapshotBlock: null, deadlineBlock: null, currentBlock: null,
                quorum: 0, forVotes: 0, againstVotes: 0, abstainVotes: 0,
                state: p.indexed_state,
              } : null] as const;
            }
          }),
        );

        const map = new Map<string, ChainState>();
        for (const [ref, cs] of entries) if (cs) map.set(ref, cs);

        const inExecution = combined.filter((p) => {
          const cs = map.get(p.proposal_ref);
          if (cs?.state != null) return EXECUTION_STATES.has(cs.state);
          return EXECUTION_PHASES.has(normalize(p.lifecycle_phase))
            || EXECUTION_PHASES.has(normalize(p.status));
        }).sort((a, b) => sortByGovernanceOrder(a, b, map));

        // Diff against seen set for glow + notifications.
        const currentIds = new Set(inExecution.map((p) => p.proposal_ref));
        const seen = readSeen();
        const firstLoad = !initializedRef.current && seen.size === 0;

        if (firstLoad) {
          // Silent baseline — no glow, no notification for pre-existing items.
          writeSeen(currentIds);
        } else {
          const newlyEntered = inExecution.filter((p) => !seen.has(p.proposal_ref));
          if (newlyEntered.length > 0 && alive) {
            setGlow(true);
            setTimeout(() => { if (alive) setGlow(false); }, 8000);
            for (const p of newlyEntered) {
              notify.success("Proposal entered execution phase", {
                description: p.title || "Untitled proposal",
              });
            }
            const merged = new Set(seen);
            currentIds.forEach((id) => merged.add(id));
            // Prune ids no longer in execution to keep the set small.
            const pruned = new Set(Array.from(merged).filter((id) => currentIds.has(id)));
            writeSeen(pruned);
          } else if (currentIds.size !== seen.size) {
            // Prune ids that have left the execution phase.
            const pruned = new Set(Array.from(seen).filter((id) => currentIds.has(id)));
            writeSeen(pruned);
          }
        }
        initializedRef.current = true;

        if (alive) {
          setChainStates(map);
          setProposals(inExecution);
        }
        s.ok({ count: inExecution.length });
      } catch (err: any) {
        s.fail(err);
        toast({ title: "Execution phase sync failed", description: err.message, variant: "destructive" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Syncing Execution Phase…</span>
      </div>
    );
  }

  // Always render — the section stays visible so users see the archive scaffold
  // even when no proposal is currently in the timelock/queued phase.


  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className={`w-full flex items-center justify-between gap-3 px-5 py-3.5 bg-amber-50/70 dark:bg-amber-950/20 border border-amber-300/70 dark:border-amber-900/40 rounded-2xl shadow-sm hover:shadow-md hover:border-amber-400 dark:hover:border-amber-800 transition-all ${
            glow ? "ring-2 ring-amber-400 animate-pulse shadow-[0_0_24px_rgba(245,158,11,0.55)]" : ""
          }`}
        >
          <div className="flex items-center gap-2">
            <Timer className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
              Archive · Execution Phase
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-800 bg-amber-100 dark:text-amber-200 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
              {proposals.length}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-amber-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        {proposals.length === 0 ? (
          <div className="px-4 py-6 text-center rounded-2xl border border-dashed border-amber-300/60 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300">
              No proposals currently awaiting execution
            </p>
            <p className="text-[10px] text-amber-800/70 dark:text-amber-200/60 mt-1">
              Successful proposals appear here after the timelock queues them.
            </p>
          </div>
        ) : (
          proposals.map((prop) => (
            <ProposalCard
              key={prop.id}
              proposal={prop}
              balance={balance}
              votingPower={votingPower}
              currentUserId={userId}
              ascensionLevel={ascensionLevel}
              initialChainState={chainStates.get(prop.proposal_ref)}
              onChanged={() => { /* terminal — awaiting timelock execution */ }}
            />
          ))
        )}
      </CollapsibleContent>

    </Collapsible>
  );
};

export default ExecutionPhaseList;
