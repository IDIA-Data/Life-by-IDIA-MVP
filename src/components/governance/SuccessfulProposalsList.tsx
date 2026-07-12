import React, { useEffect, useState } from "react";
import { CheckCircle2, ChevronDown, Loader2 } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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

// Governor states considered "successful quorum reached": Succeeded (4),
// Queued (5), Executed (7). Anything else is handled by other sections.
const SUCCESS_STATES = new Set([4, 5, 7]);
const SUCCESS_PHASES = new Set([
  "succeeded",
  "passed",
  "queued",
  "timelock",
  "in_timelock",
  "executed",
  "settled",
  "complete",
  "completed",
]);

const normalize = (v?: string | null) =>
  (v || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

const SuccessfulProposalsList: React.FC<Props> = ({ balance, votingPower, refreshTrigger = 0 }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [chainStates, setChainStates] = useState<Map<string, ChainState>>(new Map());
  const [userId, setUserId] = useState<string | null>(null);
  const [ascensionLevel, setAscensionLevel] = useState<AscensionLevel>(0);

  useEffect(() => {
    let alive = true;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const s = stage("SUCCESSFUL_PROPOSALS", "FETCH_HYBRID");
      s.start();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
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
          .select(
            "id, title, description, status, proposer_id, on_chain_id, lifecycle_phase, created_at, end_date, committee_id",
          )
          .order("created_at", { ascending: false });
        if (dbProposals.error) throw dbProposals.error;

        await delay(400);
        const onChainProposals = await governanceService.getRecentProposals(user?.id || "").catch(() => []);
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
              return [
                p.proposal_ref,
                p.indexed_state != null
                  ? {
                      snapshotBlock: null,
                      deadlineBlock: null,
                      currentBlock: null,
                      quorum: 0,
                      forVotes: 0,
                      againstVotes: 0,
                      abstainVotes: 0,
                      state: p.indexed_state,
                    }
                  : null,
              ] as const;
            }
          }),
        );

        const map = new Map<string, ChainState>();
        for (const [ref, cs] of entries) if (cs) map.set(ref, cs);

        const successful = combined
          .filter((p) => {
            const cs = map.get(p.proposal_ref);
            if (cs?.state != null && SUCCESS_STATES.has(cs.state)) return true;
            // DB-only or unresolved chain read — trust DB phase markers.
            const phaseMatch =
              SUCCESS_PHASES.has(normalize(p.lifecycle_phase)) || SUCCESS_PHASES.has(normalize(p.status));
            return phaseMatch;
          })
          .sort((a, b) => sortByGovernanceOrder(a, b, map));

        if (alive) {
          setChainStates(map);
          setProposals(successful);
        }
        s.ok({ count: successful.length });
      } catch (err: any) {
        s.fail(err);
        toast({ title: "Successful archive sync failed", description: err.message, variant: "destructive" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4 gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-[10px] font-black uppercase tracking-widest">Syncing Passed Archive…</span>
      </div>
    );
  }

  if (proposals.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between gap-3 px-5 py-3.5 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 rounded-2xl shadow-sm hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-800 transition-all">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-200">
              Archive · Quorum Reached
            </span>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 bg-emerald-100 dark:text-emerald-200 dark:bg-emerald-900/40 px-2 py-0.5 rounded-full">
              {proposals.length}
            </span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-emerald-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3">
        {proposals.map((prop) => (
          <ProposalCard
            key={prop.id}
            proposal={prop}
            balance={balance}
            votingPower={votingPower}
            currentUserId={userId}
            ascensionLevel={ascensionLevel}
            initialChainState={chainStates.get(prop.proposal_ref)}
            onChanged={() => {
              /* terminal — historical record */
            }}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default SuccessfulProposalsList;
