import React, { useEffect, useState } from "react";
// Card primitives no longer used — cards are rendered as compact lifecycle-style rows.
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gavel, Loader2, CheckCircle2, ThumbsUp, ThumbsDown, Trash2, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateACAHash } from "@/utils/acaGenerator";
import { recordACA } from "@/utils/acaLedger";
import { stage } from "@/lib/stageLogger";
import { governanceService, type ProposalOnChain } from "@/services/governanceService";
import { relayCastVoteBySig } from "@/services/governanceRelay";
import ActivateVotingPowerCard from "./ActivateVotingPowerCard";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ethers } from "ethers";
import { PROTOCOL, ACTIVE_DEPLOYMENT, GOVERNOR_ABI } from "@/config/contracts";
import { NETWORKS, walletService } from "@/services/walletService";

// Direct-RPC chain state read — snapshot block, dynamic quorum, and live tally.
// Quorum is fetched dynamically per snapshot block so the UI auto-adapts if
// the protocol upgrades to a floating relative quorum in the future.
export interface ChainState {
  snapshotBlock: number | null;
  deadlineBlock: number | null;
  currentBlock: number | null;
  quorum: number;
  forVotes: number;
  againstVotes: number;
  abstainVotes: number;
  state: number | null;
}

export async function readChainState(onChainId?: string | null): Promise<ChainState> {
  const networkKey = ACTIVE_DEPLOYMENT === "mainnet" ? "base" : "baseSepolia";
  const network = NETWORKS[networkKey];
  const rpcUrl = (import.meta.env.VITE_ALCHEMY_RPC_URL as string | undefined) || network.rpcUrl;
  const provider = new ethers.JsonRpcProvider(rpcUrl, network.chainId);
  const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, provider);

  const empty: ChainState = {
    snapshotBlock: null,
    deadlineBlock: null,
    currentBlock: null,
    quorum: 0,
    forVotes: 0,
    againstVotes: 0,
    abstainVotes: 0,
    state: null,
  };

  if (!onChainId || onChainId.trim() === "") {
    try {
      const block = await provider.getBlockNumber();
      const rawQ = await gov.quorum(block - 1);
      return { ...empty, currentBlock: block, quorum: Number(ethers.formatUnits(rawQ, 18)) };
    } catch {
      return empty;
    }
  }

  // Time-travel guard: state(id) + currentBlock are always safe. proposalVotes
  // and quorum(snapshotBlock) revert with ERC5805FutureLookup while Pending
  // because the snapshot block is in the future. Defer those reads until
  // state > 0 (Active or beyond), and fetch a "live" quorum off currentBlock
  // for Pending cards so the threshold UI still renders.
  const [rawState, currentBlockRaw, rawSnapshot, rawDeadline] = await Promise.all([
    gov.state(onChainId).catch(() => null),
    provider.getBlockNumber().catch(() => 0),
    gov.proposalSnapshot(onChainId).catch(() => 0n),
    gov.proposalDeadline(onChainId).catch(() => 0n),
  ]);

  const state = rawState != null ? Number(rawState) : null;
  const currentBlock = currentBlockRaw || null;
  const snapshotBlock = rawSnapshot && Number(rawSnapshot) > 0 ? Number(rawSnapshot) : null;
  const deadlineBlock = rawDeadline && Number(rawDeadline) > 0 ? Number(rawDeadline) : null;

  let rawQuorum: bigint = 0n;
  let rawVotes: [bigint, bigint, bigint] = [0n, 0n, 0n];

  if (state !== null && state > 0) {
    const [q, v] = await Promise.all([
      snapshotBlock
        ? gov.quorum(snapshotBlock).catch(() => 0n)
        : Promise.resolve(0n),
      gov.proposalVotes(onChainId).catch(() => [0n, 0n, 0n] as any),
    ]);
    rawQuorum = q;
    rawVotes = v as [bigint, bigint, bigint];
  } else if (state === 0 && currentBlock) {
    // Pending: query quorum against the latest finalized block so the UI shows
    // the live threshold without poking a future snapshot block.
    rawQuorum = await gov.quorum(currentBlock - 1).catch(() => 0n);
  }

  return {
    snapshotBlock,
    deadlineBlock,
    currentBlock,
    quorum: Number(ethers.formatUnits(rawQuorum, 18)),
    againstVotes: Number(ethers.formatUnits(rawVotes[0], 18)),
    forVotes: Number(ethers.formatUnits(rawVotes[1], 18)),
    abstainVotes: Number(ethers.formatUnits(rawVotes[2], 18)),
    state,
  };
}

export type ProposalBucket = "ACTIVE_FEED" | "TELEMETRY" | "DEFEATED" | "LOCKED" | "UNRESOLVED";

/**
 * Strict mutual-exclusion bucket classifier keyed on OpenZeppelin Governor state.
 * Switch on the integer — no ranges, no Set membership, no overlap possible.
 */
export function classifyBucket(state: number | null, hasOnChainId: boolean): ProposalBucket {
  if (state === null) return hasOnChainId ? "UNRESOLVED" : "ACTIVE_FEED";
  switch (state) {
    case 0:
    case 1:
      return "ACTIVE_FEED";
    case 2:
    case 3:
      return "DEFEATED";
    case 4:
    case 5:
      return "TELEMETRY";
    case 6:
    case 7:
      return "LOCKED";
    default:
      return "UNRESOLVED";
  }
}

// OpenZeppelin Governor state enum:
// 0 Pending · 1 Active · 2 Canceled · 3 Defeated · 4 Succeeded · 5 Queued · 6 Expired · 7 Executed
const STATE_NAME = ["Pending", "Active", "Canceled", "Defeated", "Succeeded", "Queued", "Expired", "Executed"];
const FINAL_DEFEATED = new Set([2, 3, 6]);
const FINAL_PASSED = new Set([4, 5, 7]);
import {
  authorizeGovernanceAction,
  getAscensionLevel,
  IndemnityViolation,
  LEVEL_LABEL,
  type AscensionLevel,
} from "@/utils/governanceGate";

export interface Proposal {
  id: string; // DB uuid when present, else on-chain id (used as React key only)
  proposal_ref: string; // canonical id for dao_votes: on-chain id when anchored, else uuid string
  title: string;
  description: string;
  status: string;
  proposer_id: string | null;
  proposer_address?: string | null;
  on_chain_id?: string | null;
  lifecycle_phase?: string | null;
  created_at?: string | null;
  indexed_state?: number | null;
  proposal_targets?: string[] | null;
  proposal_values?: string[] | null;
  proposal_calldatas?: string[] | null;
  chain_description?: string | null;
}

const sameEvmAddress = (a?: string | null, b?: string | null) =>
  !!a && !!b && /^0x[0-9a-f]{40}$/i.test(a) && /^0x[0-9a-f]{40}$/i.test(b) && a.toLowerCase() === b.toLowerCase();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const normalizeStateText = (value?: string | null) => (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");

const stateOnly = (state: number): ChainState => ({
  snapshotBlock: null,
  deadlineBlock: null,
  currentBlock: null,
  quorum: 0,
  forVotes: 0,
  againstVotes: 0,
  abstainVotes: 0,
  state,
});

const deriveDbState = (proposal: Pick<Proposal, "status" | "lifecycle_phase">): number | null => {
  const markers = [normalizeStateText(proposal.status), normalizeStateText(proposal.lifecycle_phase)];
  if (markers.some((m) => ["executed", "settled", "complete", "completed"].includes(m))) return 7;
  if (markers.includes("expired")) return 6;
  if (markers.some((m) => ["queued", "timelock", "in_timelock"].includes(m))) return 5;
  if (markers.some((m) => ["succeeded", "passed"].includes(m))) return 4;
  if (markers.some((m) => ["defeated", "failed", "rejected"].includes(m))) return 3;
  if (markers.some((m) => ["canceled", "cancelled"].includes(m))) return 2;
  if (markers.some((m) => ["pending", "draft", "proposed"].includes(m))) return 0;
  if (markers.some((m) => ["active", "active_vote", "live", "open"].includes(m))) return 1;
  return null;
};

export function classifyProposalBucket(proposal: Proposal, chainState?: ChainState): ProposalBucket {
  // Drift sweep: admin-flagged stuck/archived rows are evicted from Active so
  // the card unmounts and stops hammering gov.state()/gov.quorum().
  const phase = (proposal.lifecycle_phase || "").toLowerCase();
  if (phase === "archived" || phase === "drift") return "DEFEATED";
  const hasOnChainId = !!proposal.on_chain_id?.trim();
  if (chainState?.state != null) return classifyBucket(chainState.state, hasOnChainId);
  if (hasOnChainId) return "UNRESOLVED";
  const dbState = deriveDbState(proposal);
  if (dbState != null) return classifyBucket(dbState, false);
  return "ACTIVE_FEED";
}

export function sortByGovernanceOrder(a: Proposal, b: Proposal, chainStates: Map<string, ChainState>) {
  const aState = chainStates.get(a.proposal_ref)?.state ?? (!a.on_chain_id ? deriveDbState(a) : null);
  const bState = chainStates.get(b.proposal_ref)?.state ?? (!b.on_chain_id ? deriveDbState(b) : null);
  const stateRank = (state: number | null) => {
    switch (state) {
      case 1: return 0;
      case 0: return 1;
      case 5: return 2;
      case 4: return 3;
      case 7: return 4;
      case 6: return 5;
      default: return 9;
    }
  };
  const rankDiff = stateRank(aState) - stateRank(bState);
  if (rankDiff !== 0) return rankDiff;
  return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
}


// ── Per-proposal voter ledger ──
// Pulls every dao_votes row for this proposal, joins wallets via the
// member_wallet_directory view, and renders snapshot-locked weights. Sorted
// by snapshot_voting_power desc (NULLs last) — legacy rows fall back to
// vote_weight with a faint tag.
const VoterLedger: React.FC<{ proposalId: string; refreshKey: number }> = ({
  proposalId,
  refreshKey,
}) => {
  type Row = {
    user_id: string;
    vote_type: string;
    vote_weight: number | null;
    snapshot_voting_power: number | null;
    snapshot_block: number | null;
    created_at: string | null;
    wallet?: string | null;
  };
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: votes, error } = await (supabase as any)
          .from("dao_votes")
          .select("user_id, vote_type, vote_weight, snapshot_voting_power, snapshot_block, created_at")
          .eq("proposal_id", proposalId)
          .order("snapshot_voting_power", { ascending: false, nullsFirst: false });
        if (error) throw error;
        const userIds = Array.from(new Set((votes || []).map((v: any) => v.user_id).filter(Boolean)));
        let walletMap = new Map<string, string>();
        if (userIds.length > 0) {
          const { data: wallets } = await (supabase as any)
            .from("member_wallet_directory")
            .select("user_id, wallet_address")
            .in("user_id", userIds);
          (wallets || []).forEach((w: any) => {
            if (w?.user_id && w?.wallet_address) walletMap.set(w.user_id, w.wallet_address);
          });
        }
        if (!alive) return;
        setRows(
          (votes || []).map((v: any) => ({
            ...v,
            wallet: walletMap.get(v.user_id) ?? null,
          })),
        );
      } catch (e) {
        console.warn("[VOTER_LEDGER] load failed", e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [proposalId, refreshKey]);

  const fmtWeight = (n: number) =>
    n >= 1 ? Math.round(n).toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });
  const shortAddr = (a?: string | null, uid?: string) =>
    a && /^0x[0-9a-f]{40}$/i.test(a)
      ? `${a.slice(0, 6)}…${a.slice(-4)}`
      : `sov:${(uid || "").slice(0, 8)}`;

  return (
    <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300"
      >
        <span>Voter Ledger · {rows.length} cast</span>
        <span className="text-slate-400">{expanded ? "▾" : "▸"}</span>
      </button>
      {expanded && (
        <div className="px-3 pb-2 space-y-1.5 max-h-60 overflow-y-auto">
          {loading && <p className="text-[10px] text-muted-foreground">Loading ledger…</p>}
          {!loading && rows.length === 0 && (
            <p className="text-[10px] text-muted-foreground">No votes cast yet.</p>
          )}
          {!loading &&
            rows.map((r, i) => {
              const isFor = r.vote_type === "for";
              const weight = r.snapshot_voting_power ?? r.vote_weight ?? 0;
              const isLegacy = r.snapshot_voting_power == null;
              return (
                <div
                  key={`${r.user_id}-${i}`}
                  className="flex items-center justify-between gap-2 text-[10px] font-mono"
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={isFor ? "text-emerald-600" : "text-rose-600"}>
                      {isFor ? "✔" : "✘"}
                    </span>
                    <span className="truncate text-slate-700 dark:text-slate-200">
                      {shortAddr(r.wallet, r.user_id)}
                    </span>
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-[9px] font-black uppercase tracking-widest ${
                        isFor ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {isFor ? "FOR" : "AGAINST"}
                    </span>
                    <span className="text-slate-800 dark:text-slate-100 font-bold">
                      {fmtWeight(Number(weight))} IDIA
                    </span>
                    {r.snapshot_block != null && (
                      <span className="text-slate-400 text-[9px]">
                        @#{r.snapshot_block.toLocaleString()}
                      </span>
                    )}
                    {isLegacy && (
                      <span className="text-[8px] text-slate-400 uppercase">legacy</span>
                    )}
                  </span>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
};

export const ProposalCard: React.FC<{
  proposal: Proposal;
  balance: number;
  votingPower: number | string;
  currentUserId: string | null;
  currentWalletAddress?: string | null;
  ascensionLevel: AscensionLevel;
  initialChainState?: ChainState;
  onChanged: () => void;
}> = ({ proposal, balance, votingPower, currentUserId, currentWalletAddress, ascensionLevel, initialChainState, onChanged }) => {
  const fallbackState = initialChainState
    ?? (proposal.indexed_state != null ? stateOnly(proposal.indexed_state) : undefined)
    ?? (!proposal.on_chain_id ? (() => {
      const dbState = deriveDbState(proposal);
      return dbState != null ? stateOnly(dbState) : undefined;
    })() : undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [hasVoted, setHasVoted] = useState<null | "for" | "against">(null);
  const [votedWeight, setVotedWeight] = useState<number | null>(null);
  const [voteCount, setVoteCount] = useState<number>(0);
  const [loadingMeta, setLoadingMeta] = useState(true);

  const [chain, setChain] = useState<ChainState>(fallbackState ?? {
    snapshotBlock: null,
    deadlineBlock: null,
    currentBlock: null,
    quorum: 0,
    forVotes: 0,
    againstVotes: 0,
    abstainVotes: 0,
    state: null,
  });

  // Vote dialog state — Governor uses 100% of snapshot balance; no slider needed.
  const numericVotingPower = parseFloat(votingPower?.toString() || "0");
  const isL3User = ascensionLevel === 3;
  const [voteDialogOpen, setVoteDialogOpen] = useState(false);
  const [pendingSupport, setPendingSupport] = useState<"for" | "against" | null>(null);
  const [voteBlast, setVoteBlast] = useState<
    | { support: "for" | "against"; weightLabel: string; tophat: boolean }
    | null
  >(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  // Bumped every time a vote is mirrored — forces VoterLedger to re-pull.
  const [ledgerNonce, setLedgerNonce] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  const openVoteDialog = (support: "for" | "against") => {
    setPendingSupport(support);
    setVoteDialogOpen(true);
  };

  const isProposer =
    (!!currentUserId && proposal.proposer_id === currentUserId) ||
    sameEvmAddress(proposal.proposer_address ?? proposal.proposer_id, currentWalletAddress);
  const canWithdraw = isProposer && voteCount === 0 && hasVoted === null;
  // Pending detection that survives RPC hydration lag. Server still enforces
  // on-chain state=0 in the cancel relay, so a permissive client gate is safe.
  const isPendingForViewer =
    chain.state === 0 ||
    (chain.state == null && (
      proposal.indexed_state === 0 ||
      deriveDbState(proposal) === 0 ||
      /pending/i.test(proposal.status ?? "") ||
      /pending/i.test(proposal.lifecycle_phase ?? "")
    ));

  useEffect(() => {
    let alive = true;
    (async () => {
      const s = stage("PROPOSAL_CARD", "META_FETCH");
      s.start({ id: proposal.id });
      try {
        const [{ data: votes }, mine] = await Promise.all([
          (supabase as any).from("dao_votes").select("vote_type, vote_weight").eq("proposal_id", proposal.proposal_ref),
          currentUserId
            ? (supabase as any)
                .from("dao_votes")
                .select("vote_type, snapshot_voting_power, vote_weight")
                .eq("proposal_id", proposal.proposal_ref)
                .eq("user_id", currentUserId)
                .maybeSingle()
            : Promise.resolve({ data: null }),
        ]);
        if (!alive) return;
        const rows = (votes || []) as { vote_type: string; vote_weight?: number }[];
        setVoteCount(rows.length);
        const mineRow = (mine as any)?.data as { vote_type?: string; snapshot_voting_power?: number | null; vote_weight?: number | null } | null;
        setHasVoted((mineRow?.vote_type as "for" | "against") ?? null);
        if (mineRow) {
          const w = mineRow.snapshot_voting_power ?? mineRow.vote_weight ?? null;
          setVotedWeight(w != null ? Number(w) : null);
        }
        s.ok();

      } catch (e) {
        s.fail(e);
      } finally {
        if (alive) setLoadingMeta(false);
      }
    })();

    // Direct-RPC chain poll: snapshot + dynamic quorum + tally + state.
    // Repolls every 15s so a stalled hydrate self-heals on the next tick.
    const pollChain = async () => {
      if (!proposal.on_chain_id) {
        const dbState = deriveDbState(proposal);
        if (alive && dbState != null) setChain(stateOnly(dbState));
        return;
      }
      try {
        const cs = await readChainState(proposal.on_chain_id);
        if (alive) {
          console.log(
            `[QUORUM_DEBUG] proposal=${proposal.on_chain_id || "(off-chain)"} snap=${cs.snapshotBlock} quorum=${cs.quorum} for=${cs.forVotes} against=${cs.againstVotes} state=${cs.state}`,
          );
          setChain(cs);
        }
      } catch (qErr) {
        console.warn("[PROPOSAL_CARD] direct chain fetch failed", qErr);
      }
    };
    pollChain();
    const iv = setInterval(pollChain, 15000);

    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [proposal.proposal_ref, proposal.on_chain_id, proposal.status, proposal.lifecycle_phase, currentUserId]);

  const handleCastVote = async (
    support: "for" | "against",
    chosenWeight: number,
    tophatOverride: boolean,
  ) => {
    console.log(
      `[GOV_VOTE][START] proposal_id=${proposal.on_chain_id ?? proposal.proposal_ref} intent=${support} weight=${chosenWeight} override=${tophatOverride}`,
    );
    const s = stage("VOTE_CAST", `${support.toUpperCase()}${tophatOverride ? "_OVERRIDE" : ""}`);
    s.start({ proposalId: proposal.id, level: ascensionLevel, weight: chosenWeight, tophatOverride });

    // 0. Indemnity gate — Level 1 (Fiduciary Officer) required for any vote
    try {
      authorizeGovernanceAction(ascensionLevel, 1, `GOVERNANCE_VOTE:${proposal.id}`);
    } catch (e) {
      const userMsg = e instanceof IndemnityViolation ? e.userMessage : "Insufficient clearance.";
      toast({ title: "Clearance Required", description: userMsg, variant: "destructive" });
      s.fail(e);
      return;
    }

    // Voting-window gate is now performed against a FRESH on-chain read inside
    // the pre-flight block (post-signBallot). React state may be stale across
    // the Pending → Active boundary, so we never trust `chain.state` here.




    // Tophat override requires L3 clearance (server-validated again in edge fn)
    if (tophatOverride && ascensionLevel !== 3) {
      toast({
        title: "Override Denied",
        description: "Tophat clearance (L3) required to carry the vote.",
        variant: "destructive",
      });
      s.fail("not_l3");
      return;
    }

    // Standard votes still require activated voting power + IDIA balance.
    // Override bypasses both — the Treasury wallet supplies the weight.
    if (!tophatOverride) {
      if (!votingPower || numericVotingPower < 1) {
        toast({
          title: "Action Required",
          description: "You must Activate Voting Power before casting a vote.",
          variant: "destructive",
        });
        s.fail("insufficient_voting_power");
        return;
      }
      if (balance < 1) {
        toast({
          title: "Insufficient IDIA",
          description: "1 IDIA is required to cast a sovereign vote.",
          variant: "destructive",
        });
        s.fail("insufficient_balance");
        return;
      }
      // Governor uses 100% of snapshot balance automatically — no client-side weight validation.
    }

    setIsSubmitting(true);
    console.log(
      `[GOV_VOTE][PRE_FLIGHT][START] proposal_id=${proposal.on_chain_id} support=${support} snapshot_block=${chain.snapshotBlock} override=${tophatOverride}`,
    );
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sovereign authentication failed.");

      const { hash, payload } = await generateACAHash(user.id, `proposal_vote_${proposal.id}`, [
        "GOVERNANCE_VOTE",
        "LEDGER_WRITE",
        ...(tophatOverride ? ["TOPHAT_OVERRIDE"] : []),
      ]);
      console.log(`[PROCESS] ACA Hash: ${hash.substring(0, 8)}…`);

      // ── CHAIN-FIRST: relay must confirm the on-chain vote BEFORE we write
      // dao_votes or flip any UI state. No optimistic writes. The ACA hash
      // is already permanently logged in user_aca_records as the immutable
      // audit trail of the biometric intent, so a failed chain call leaves
      // a forensic record without polluting the vote ledger.
      if (!proposal.on_chain_id) {
        toast({
          title: "Off-chain proposal",
          description: "This proposal has no on-chain anchor; voting is disabled.",
          variant: "destructive",
        });
        s.fail("no_on_chain_id");
        return;
      }

      const chainSupport = support === "for" ? 1 : 0;

      // Gasless EIP-712 Ballot signature for standard voters. Tophat override
      // skips this entirely — the Treasury wallet carries its own weight via castVote().
      let ballotSig: Awaited<ReturnType<typeof governanceService.signBallot>> | null = null;
      if (!tophatOverride) {
        const sigStage = stage("GOV_UI", "SIGN_BALLOT");
        sigStage.start({ proposalId: proposal.on_chain_id, support: chainSupport });
        try {
          ballotSig = await governanceService.signBallot(proposal.on_chain_id, chainSupport as 0 | 1);
          sigStage.ok({ signerAddress: ballotSig.signerAddress, v: ballotSig.v });
        } catch (sigErr: any) {
          sigStage.fail(sigErr);
          const msg = String(sigErr?.message || "");
          toast({
            title: "Signature cancelled",
            description: /reject|denied|user/i.test(msg)
              ? "You declined the wallet signature."
              : "Could not sign the ballot. Please retry.",
            variant: "destructive",
          });
          s.fail(sigErr);
          return;
        }
      }

      // ── PRE-FLIGHT GATES (Cryptographic Fidelity) ──
      // Trap the three deterministic castVoteWithReason reverts BEFORE invoking
      // the relayer — Pending proposal, zero snapshot weight, already voted.
      // RPC failures here are non-fatal: we log [END:WARN] and proceed, letting
      // the relay's own simulation be the final word.
      const networkKey = ACTIVE_DEPLOYMENT === "mainnet" ? "base" : "baseSepolia";
      const network = NETWORKS[networkKey];
      const rpcUrl = (import.meta.env.VITE_ALCHEMY_RPC_URL as string | undefined) || network.rpcUrl;
      const provider = new ethers.JsonRpcProvider(rpcUrl, network.chainId);
      const govRead = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, provider);

      let liveChain: ChainState | null = null;
      let snapshotPower: number | null = null;
      try {
        liveChain = await readChainState(proposal.on_chain_id);
        if (liveChain.state !== 1) {
          toast({
            title: "Voting not open",
            description:
              liveChain.state === 0
                ? "Voting has not started yet. This proposal is pending its snapshot block."
                : "Voting is closed for this proposal.",
            variant: "destructive",
          });
          console.error(`[GOV_VOTE][PRE_FLIGHT][END:FAIL] state=${liveChain.state}`);
          s.fail(`state_${liveChain.state}`);
          return;
        }

        // Zero-snapshot-weight guard (skipped for Tophat override — Treasury supplies weight)
        if (!tophatOverride && ballotSig?.signerAddress && liveChain.snapshotBlock != null) {
          const rawSnap = await govRead.getVotes(ballotSig.signerAddress, liveChain.snapshotBlock);
          if (BigInt(rawSnap) === 0n) {
            console.error(
              `[GOV_VOTE][PRE_FLIGHT][END:FAIL] zero_snapshot_power voter=${ballotSig.signerAddress} @block=${liveChain.snapshotBlock}`,
            );
            toast({
              title: "No voting power at snapshot",
              description: "Your account held 0 IDIA voting power at this proposal's snapshot checkpoint.",
              variant: "destructive",
            });
            s.fail("zero_snapshot_power");
            return;
          }
          snapshotPower = Number(ethers.formatUnits(rawSnap, 18));
          console.log(`[GOV_VOTE][PRE_FLIGHT] snapshot_power=${snapshotPower} IDIA`);
        }

        // Already-voted guard (both paths)
        const voterForCheck = tophatOverride ? PROTOCOL.treasury : ballotSig!.signerAddress;
        const already = await govRead.hasVoted(proposal.on_chain_id, voterForCheck);
        if (already) {
          console.error(`[GOV_VOTE][PRE_FLIGHT][END:FAIL] already_voted voter=${voterForCheck}`);
          toast({
            title: "Vote already recorded",
            description: "This wallet has already cast a vote on-chain for this proposal.",
            variant: "destructive",
          });
          setHasVoted(support);
          s.fail("already_voted");
          return;
        }

        console.log(`[GOV_VOTE][PRE_FLIGHT][END:OK] all gates passed`);
      } catch (preflightErr) {
        // Network/RPC failure — log warning and proceed. Relay simulation is the final word.
        console.warn(`[GOV_VOTE][PRE_FLIGHT][END:WARN] proceeding despite RPC error`, preflightErr);
      }

      // Authoritative baseline tally for the post-relay chain-truth poll.
      // If pre-flight RPC failed, fall back to last-known React state.
      const initialTally: ChainState = liveChain ?? chain;

      const normalizedSupport = Number(chainSupport);
      if (normalizedSupport !== 0 && normalizedSupport !== 1 && normalizedSupport !== 2) {
        throw new Error(`Invalid vote support before relay dispatch: ${normalizedSupport}`);
      }
      if (ballotSig && normalizedSupport === Number(ballotSig.v)) {
        throw new Error(`Vote payload alignment failure: support=${normalizedSupport} v=${ballotSig.v}`);
      }

      let relayData: any;
      let relayErr: any;
      if (ballotSig) {
        const relayResponse = await relayCastVoteBySig({
          proposalId: proposal.on_chain_id,
          support: normalizedSupport as 0 | 1 | 2,
          voteWeight: chosenWeight,
          rawSignatureString: ballotSig.signature,
          signerAddress: ballotSig.signerAddress,
          acaHash: hash,
          chainId: 8453,
        });
        relayData = relayResponse.data;
        relayErr = relayResponse.error;
      } else {
        // Tophat override path — Treasury wallet carries weight, no v/r/s.
        const relayPayload = {
          actionType: "CAST_VOTE",
          proposalId: proposal.on_chain_id.toString(),
          support: normalizedSupport,
          voteWeight: chosenWeight.toString(),
          tophatOverride: true,
          acaHash: hash,
          chainId: 8453,
        };
        console.log(`[PROCESS] Invoking relay-governance-action`, relayPayload);
        console.log("[GOV_VOTE][RELAY_DISPATCH][START] Shipping tophat override vote payload to Deno runtime handler...");
        const relayResponse = await supabase.functions.invoke(
          "relay-governance-action",
          { body: relayPayload },
        );
        relayData = relayResponse.data;
        relayErr = relayResponse.error;
      }
      if (relayErr || !relayData?.success) {
        // 🚨 SUPABASE HTTP ERROR UNPACKING
        // Supabase FunctionsHttpError traps the raw Response on relayErr.context.
        // We must await .json() to surface the rich JSON payload (decoded_error,
        // error_selector, args) produced by relay-governance-action.
        let customPayload: any = null;
        const ctx: any = (relayErr as any)?.context;
        if (ctx && typeof ctx.json === "function") {
          customPayload = await ctx.json().catch(() => null);
        } else if (ctx?.error || ctx?.decoded_error || ctx?.error_selector) {
          customPayload = ctx; // already parsed
        }

        const raw = customPayload?.decoded_error
          || customPayload?.error
          || (relayErr as any)?.message
          || (relayData as any)?.error
          || "Governor rejected the vote.";

        let friendly = raw;
        const stateConflict = customPayload?.state_conflict;
        if (stateConflict === "zero_snapshot_power") {
          friendly = `No voting power at the snapshot block (${customPayload?.snapshot_block ?? "?"}). Delegate IDIA to yourself BEFORE the next proposal is created, then vote on a freshly minted proposal.`;
        } else if (stateConflict === "already_voted") {
          friendly = "This wallet has already voted on-chain for this proposal.";
        } else if (stateConflict === "inactive_proposal") {
          friendly = `Voting is not open. Proposal state: ${customPayload?.proposal_state_name ?? "unknown"}.`;
        } else if (stateConflict === "onchain_revert") {
          friendly = `Vote mined but reverted on-chain (tx ${String(customPayload?.tx_hash || "").slice(0, 10)}…). Open BaseScan for the trace.`;
        } else if (
          customPayload?.error_selector === "0x94ab6c07" ||
          customPayload?.decoded_error === "GovernorInvalidSignature" ||
          /GovernorInvalidSignature/.test(raw)
        ) {
          friendly = "Signature mismatch (GovernorInvalidSignature / 0x94ab6c07). The relayer normalized v to 27/28 — if this still appears, the EIP-712 domain or proposalId encoding is drifting from the on-chain Governor.";
        } else if (/UnexpectedProposalState|Pending|not.*open/i.test(raw)) {
          friendly = "Voting is not open yet. Try again once the snapshot block is reached.";
        } else if (/already.*voted|hasVoted/i.test(raw)) {
          friendly = "This wallet has already voted on-chain for this proposal.";
        } else if (/gas/i.test(raw)) {
          friendly = "Relayer is out of gas. Notify an operator.";
        }

        console.error(`[VOTE_CAST] RELAY_FAILED Payload:`, customPayload || relayErr);
        console.error("[GOV_VOTE][RELAY_BROADCAST][FATAL_FAIL]", raw);
        console.error("[GOV_VOTE][RELAY_DISPATCH][FATAL_FAIL] Gasless vote propagation collapsed. Reason: ", raw);
        toast({
          title: tophatOverride ? "Override failed" : "Transaction Failed",
          description: friendly,
          variant: "destructive",
        });
        s.fail(relayErr || "relay_no_success");
        return; // NO dao_votes insert, NO state flip
      }
      console.log(`[PROCESS] Relay claimed success`, relayData);
      console.log("[GOV_VOTE][RELAY_DISPATCH][SUCCESS] On-chain gasless signature vote verified and indexed.");
      console.log("[GOV_VOTE][RELAY_BROADCAST][SUCCESS]", { tx_hash: (relayData as any)?.tx_hash });

      // ── AUTHORITATIVE CHAIN-TRUTH GATE (must pass BEFORE any mirror) ──
      // Hard gate: refuse to mirror, burn, or flip UI state until Base RPC
      // reports a tally transition vs. the pre-vote snapshot. No off-chain
      // fallback exists. If the chain doesn't move, the vote did not happen.
      console.log(`[GOV_VOTE][CHAIN_REFRESH][START] polling for on-chain settlement`);
      const pollDelays = [500, 750, 1000, 1500, 2000, 2500, 1750]; // ~10s total
      let confirmed: ChainState | null = null;
      for (let i = 0; i < pollDelays.length; i++) {
        await new Promise((r) => setTimeout(r, pollDelays[i]));
        console.log(`[GOV_VOTE][POLL][TICK] attempt=${i + 1}/${pollDelays.length}`);
        try {
          const live = await readChainState(proposal.on_chain_id);
          if (
            live.forVotes !== initialTally.forVotes ||
            live.againstVotes !== initialTally.againstVotes
          ) {
            confirmed = live;
            break;
          }
        } catch (tickErr) {
          console.warn(`[GOV_VOTE][POLL][TICK_ERR]`, tickErr);
        }
      }
      if (!confirmed) {
        console.error(`[GOV_VOTE][CHAIN_REFRESH][END:FAIL] poll exhausted — vote REJECTED, no mirror written`);
        toast({
          title: "Vote Rejected — Not Confirmed On-Chain",
          description:
            "Base RPC did not report a tally change within 10s. No off-chain mirror was written. Try again.",
          variant: "destructive",
        });
        s.fail("chain_no_transition");
        return; // NO dao_votes insert, NO burn, NO state flip
      }
      setChain(confirmed);
      console.log(
        `[GOV_VOTE][CHAIN_REFRESH][END:OK] for=${confirmed.forVotes} against=${confirmed.againstVotes}`,
      );

      // ── Chain confirmed → mirror the vote into dao_votes ──
      // snapshot_voting_power was captured during pre-flight directly from Base RPC.
      console.log(`[GOV_VOTE][DB_INSERT][START] dao_votes proposal_id=${proposal.proposal_ref}`);
      const voteRow: Record<string, unknown> = {
        proposal_id: proposal.proposal_ref,
        user_id: user.id,
        vote_type: support,
        vote_weight: chosenWeight,
        snapshot_voting_power: snapshotPower,
        snapshot_block: initialTally.snapshotBlock ?? null,
        credits_spent: tophatOverride ? 0 : 1,
        aca_hash_key: hash,
        aca_payload: payload,
      };
      const { error: voteError } = await (supabase as any).from("dao_votes").insert(voteRow);
      if (voteError) {
        if (voteError.code === "23505") {
          console.log(`[GOV_VOTE][DB_INSERT][END:DUPLICATE] mirror already present`);
        } else {
          console.error(`[GOV_VOTE][DB_INSERT][END:FAIL]`, voteError);
          toast({
            title: "Mirror Write Failed",
            description: "On-chain vote landed but the ledger mirror failed. Contact an operator.",
            variant: "destructive",
          });
        }
      } else {
        console.log(`[GOV_VOTE][DB_INSERT][END:OK] vote ledger row synchronized`);
      }
      setLedgerNonce((n) => n + 1);

      // Burn 1 IDIA from wallet for standard votes only
      if (!tophatOverride) {
        const { error: burnError } = await (supabase as any).rpc("increment_wallet_balance", {
          target_user_id: user.id,
          amount: -1,
        });
        if (burnError) console.warn("[VOTE_CAST] BURN_WARNING", burnError.message);
      }

      const appliedWeight = tophatOverride
        ? numericVotingPower
        : (snapshotPower ?? numericVotingPower);
      setVotedWeight(appliedWeight);
      setHasVoted(support);
      setVoteCount((c) => c + 1);
      setVoteDialogOpen(false);


      // Center-screen vote blast — auto-dismisses after 2.6s
      const weightLabel = tophatOverride
        ? "TREASURY WEIGHT"
        : `${Math.floor(numericVotingPower).toLocaleString()} IDIA`;
      setVoteBlast({ support, weightLabel, tophat: !!tophatOverride });
      setTimeout(() => setVoteBlast(null), 2600);

      toast({
        title: tophatOverride ? "Tophat Override Executed" : "Vote Anchored",
        description: tophatOverride
          ? `Treasury weight applied to ${support.toUpperCase()} · ACA ${hash.substring(0, 8)}…`
          : `${support.toUpperCase()} · ${Math.floor(numericVotingPower)} IDIA · tx ${String(relayData?.tx_hash || "").substring(0, 10)}…`,
      });
      onChanged();
      s.ok();
    } catch (e: any) {
      console.error(`[GOV_VOTE][FATAL_FAIL] vote pipeline stalled or rejected:`, e?.message || e);
      s.fail(e);
      toast({ title: "Submission Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };



  const handleWithdraw = async () => {
    const s = stage("PROPOSAL_WITHDRAW", "DELETE");
    s.start({ id: proposal.id });
    setIsWithdrawing(true);
    try {
      // Re-check votes immediately to avoid race
      const { data: latest } = await (supabase as any)
        .from("dao_votes")
        .select("id")
        .eq("proposal_id", proposal.proposal_ref)
        .limit(1);
      if ((latest || []).length > 0) {
        toast({
          title: "Cannot withdraw",
          description: "Votes have already been cast on this proposal.",
          variant: "destructive",
        });
        onChanged();
        s.fail("votes_present");
        return;
      }
      const { error } = await (supabase as any).from("dao_proposals").delete().eq("id", proposal.id);
      if (error) throw error;
      toast({ title: "Proposal withdrawn", description: "Removed from the active ledger." });
      onChanged();
      s.ok();
    } catch (e: any) {
      s.fail(e);
      toast({ title: "Withdraw failed", description: e.message, variant: "destructive" });
    } finally {
      setIsWithdrawing(false);
    }
  };

  const [isCancelling, setIsCancelling] = useState(false);
  const handleCancelPending = async () => {
    if (!proposal.on_chain_id) return;
    const s = stage("PROPOSAL_CANCEL", "WALLET_CANCEL");
    s.start({ id: proposal.id, onChainId: proposal.on_chain_id });
    setIsCancelling(true);
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Sovereign authentication failed.");

      const { hash, payload } = await generateACAHash(
        user.id,
        `proposal_cancel_${proposal.on_chain_id}`,
        ["GOV_PROPOSAL_CANCEL", "LEDGER_WRITE"],
      );

      // Lazy-load wallet from Secure Enclave if not in memory (cold reload, tab switch).
      if (!walletService.getAddress()) {
        try {
          const loaded = await walletService.loadWallet();
          if (!loaded) {
            toast({ title: "Wallet locked", description: "Open the Wallet tab to unlock, then retry cancel.", variant: "destructive" });
            s.fail("wallet_locked");
            setIsCancelling(false);
            return;
          }
        } catch (loadErr: any) {
          toast({ title: "Wallet unavailable", description: "Open the Wallet tab to unlock, then retry cancel.", variant: "destructive" });
          s.fail(loadErr?.message || "wallet_load_failed");
          setIsCancelling(false);
          return;
        }
      }

      let signer: ethers.Wallet;
      try {
        signer = walletService.getConnectedSigner();
      } catch {
        toast({ title: "Wallet locked", description: "Open the Wallet tab to unlock, then retry cancel.", variant: "destructive" });
        s.fail("no_signer");
        setIsCancelling(false);
        return;
      }
      const signerAddress = await signer.getAddress();
      if (!sameEvmAddress(signerAddress, proposal.proposer_address ?? currentWalletAddress)) {
        throw new Error("Original proposer wallet required to cancel this proposal.");
      }

      const targets = proposal.proposal_targets?.length ? proposal.proposal_targets : [PROTOCOL.idiaToken];
      const values = proposal.proposal_values?.length ? proposal.proposal_values : ["0"];
      const calldatas = proposal.proposal_calldatas?.length ? proposal.proposal_calldatas : ["0x"];
      const sourceDescription = proposal.chain_description || proposal.description;
      const chainDescription = proposal.chain_description
        ? proposal.chain_description
        : UUID_RE.test(proposal.id)
          ? `# ${proposal.title}\n\n${proposal.description}\n\n---\n*System Ref: ${proposal.id}*`
          : sourceDescription.startsWith("# ")
            ? sourceDescription
            : `# ${proposal.title}\n\n${sourceDescription}`;
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(chainDescription));
      const gov = new ethers.Contract(PROTOCOL.governor, GOVERNOR_ABI, signer);
      const tx = await gov.cancel(
        targets,
        values.map((v) => BigInt(v)),
        calldatas,
        descriptionHash,
      );
      const receipt = await tx.wait();

      await recordACA({
        userId: user.id,
        sourceId: "GOV_PROPOSAL_CANCEL",
        consentType: "governance_cancel",
        hash,
        payload,
        txHash: tx.hash,
      }).catch((acaErr) => console.warn("[PROPOSAL_CANCEL] ACA mirror warning", acaErr));

      await (supabase as any)
        .from("governance_proposals")
        .update({ state: 2, state_name: "Canceled" })
        .eq("proposal_id", proposal.on_chain_id)
        .then(({ error }: any) => {
          if (error) console.warn("[PROPOSAL_CANCEL] governance_proposals reconcile warning", error.message);
        });

      if (UUID_RE.test(proposal.id)) {
        await (supabase as any)
          .from("dao_proposals")
          .update({ status: "cancelled", lifecycle_phase: "cancelled" })
          .eq("id", proposal.id)
          .then(({ error }: any) => {
            if (error) console.warn("[PROPOSAL_CANCEL] dao_proposals reconcile warning", error.message);
          });
      }

      toast({
        title: "Proposal cancelled",
        description: `Anchored on-chain · tx ${String(tx.hash || "").substring(0, 10)}…`,
      });
      setDetailOpen(false);
      onChanged();
      s.ok({ tx_hash: tx.hash, block_number: receipt?.blockNumber });
    } catch (e: any) {
      console.error("[PROPOSAL_CANCEL] EXCEPTION", e);
      const raw = e?.shortMessage || e?.message || "Unable to cancel proposal.";
      const friendly = /ACTION_REJECTED|user rejected|rejected/i.test(raw)
        ? "Signature declined — proposal was not cancelled."
        : /insufficient funds|gas/i.test(raw)
          ? "Not enough Base ETH to cancel this proposal from the proposer wallet."
          : /GovernorUnexpectedProposalState|Pending|state/i.test(raw)
            ? "Voting has already opened — this proposal can no longer be cancelled."
            : raw;
      toast({
        title: "Cancel failed",
        description: friendly,
        variant: "destructive",
      });
      s.fail(e);
    } finally {
      setIsCancelling(false);
    }
  };


  // ── Shared chain-derived display values ────────────────────────────
  const chainName = chain.state != null ? STATE_NAME[chain.state] : null;
  const isActive = chain.state === 1;
  const isFinalDefeated = chain.state != null && FINAL_DEFEATED.has(chain.state);
  const isFinalPassed = chain.state != null && FINAL_PASSED.has(chain.state);
  const isFinal = isFinalDefeated || isFinalPassed;

  // Progress numerator: on-chain For votes when available, else off-chain intents
  const forDisplay = chain.forVotes;
  const againstDisplay = chain.againstVotes;
  const quorumTarget = chain.quorum;
  const pct = quorumTarget > 0 ? Math.min(100, (forDisplay / quorumTarget) * 100) : 0;
  const fmt = (n: number) =>
    n >= 1 ? Math.round(n).toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 });

  const SnapshotBadge = chain.snapshotBlock ? (
    <Badge
      variant="outline"
      className="text-[9px] font-black uppercase tracking-widest border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300"
    >
      Block #{chain.snapshotBlock.toLocaleString()}
    </Badge>
  ) : null;

  // ── Timeframe row — visible on every proposal (active, archive, locked) ──
  const submittedLabel = proposal.created_at
    ? new Date(proposal.created_at).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const phaseLabel = isFinal
    ? "Final Window"
    : isActive
      ? "Voting Open"
      : chain.state === 0
        ? "Pending Window"
        : "Timeframe";
  const TimeframeRow = (
    <div className="flex items-center justify-between gap-2 flex-wrap text-[9px] font-black uppercase tracking-widest text-muted-foreground px-1">
      <span className="text-slate-600 dark:text-slate-300">
        {phaseLabel}
      </span>
      <span className="text-slate-500 dark:text-slate-400">
        {submittedLabel ? <>Submitted · {submittedLabel}</> : <>Submitted · on-chain only</>}
        {chain.snapshotBlock ? <> · Snap #{chain.snapshotBlock.toLocaleString()}</> : <> · Snap syncing</>}
      </span>
    </div>
  );

  // ── Amber deadline countdown — sits at the bottom of every card ──
  const SECONDS_PER_BLOCK = 2;
  const VOTING_DELAY_BLOCKS = 43200;
  const VOTING_PERIOD_BLOCKS = 302400;
  // Touch nowTick so this recomputes on the 30s tick
  void nowTick;
  let deadlineSecondsLeft: number | null = null;
  if (chain.deadlineBlock != null && chain.currentBlock != null) {
    deadlineSecondsLeft = (chain.deadlineBlock - chain.currentBlock) * SECONDS_PER_BLOCK;
  } else if (proposal.created_at) {
    const totalDurationSec = (VOTING_DELAY_BLOCKS + VOTING_PERIOD_BLOCKS) * SECONDS_PER_BLOCK;
    const endMs = new Date(proposal.created_at).getTime() + totalDurationSec * 1000;
    deadlineSecondsLeft = Math.floor((endMs - Date.now()) / 1000);
  }
  let deadlineLabel = "⏱ Deadline syncing…";
  let deadlineTone: "live" | "ended" | "none" = "none";
  if (isFinal) {
    deadlineLabel = "⏱ Voting Closed · Deadline Passed";
    deadlineTone = "ended";
  } else if (deadlineSecondsLeft != null) {
    if (deadlineSecondsLeft <= 0) {
      deadlineLabel = "⏱ Closing now";
      deadlineTone = "ended";
    } else {
      const d = Math.floor(deadlineSecondsLeft / 86400);
      const h = Math.floor((deadlineSecondsLeft % 86400) / 3600);
      const m = Math.floor((deadlineSecondsLeft % 3600) / 60);
      deadlineLabel = `⏱ Auto-fails in ${d}d ${h}h ${m}m`;
      deadlineTone = "live";
    }
  }
  const DeadlinePill = (
    <div
      className={`mt-1 px-3 py-2 rounded-2xl border text-[10px] font-black uppercase tracking-widest text-center ${
        deadlineTone === "live"
          ? "border-amber-200 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-900/50"
          : deadlineTone === "ended"
            ? "border-rose-200 bg-rose-50/60 text-rose-700 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-900/50"
            : "border-slate-200 bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800"
      }`}
    >
      {deadlineLabel}
    </div>
  );




  const QuorumBar = (
    <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
      <div className="flex justify-between items-baseline gap-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
          {isFinal ? "Final Tally" : "Quorum Progress"}
        </span>
        <span className="text-[9px] font-black tracking-widest text-slate-700 dark:text-slate-200 text-right">
          {quorumTarget > 0 ? (
            <>
              {fmt(forDisplay)} / {fmt(quorumTarget)} Votes Reached ({pct.toFixed(1)}%)
            </>
          ) : (
            <>{fmt(forDisplay)} cast · quorum hydrating…</>
          )}
        </span>
      </div>
      <Progress
        value={quorumTarget > 0 ? pct : forDisplay > 0 ? 8 : 0}
        className={`h-2 ${!isFinal && quorumTarget === 0 ? "animate-pulse" : ""}`}
        indicatorClassName={
          quorumTarget === 0
            ? "bg-slate-300 dark:bg-slate-700"
            : isFinalDefeated
              ? "bg-rose-500"
              : isFinalPassed || forDisplay >= quorumTarget
                ? "bg-emerald-500"
                : "bg-[hsl(178,42%,32%)]"
        }
      />
      <div className="flex justify-between text-[10px] font-bold text-muted-foreground pt-0.5">
        <span>✔ For: {fmt(forDisplay)}</span>
        <span>✘ Against: {fmt(againstDisplay)}</span>
      </div>
    </div>
  );

  // ── Compact lifecycle-telemetry-style row + popup detail dialog ──
  const statusColor = isFinalDefeated
    ? "border-rose-200 bg-rose-50/60 text-rose-700 dark:bg-rose-950/30 dark:text-rose-200 dark:border-rose-900/50"
    : isFinalPassed
      ? "border-emerald-200 bg-emerald-50/60 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200 dark:border-emerald-900/50"
      : isActive
        ? "border-orange-200 bg-orange-50/60 text-orange-700 dark:bg-orange-950/30 dark:text-orange-200 dark:border-orange-900/50"
        : chain.state === 0
          ? "border-amber-200 bg-amber-50/60 text-amber-700 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50"
          : "border-slate-200 bg-slate-50 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300 dark:border-slate-800";
  const statusIcon = isFinalDefeated ? "✘" : isFinalPassed ? "✅" : isActive ? "⚡" : chain.state === 0 ? "⏳" : "•";
  const statusLabel = chainName || (chain.state === null ? "Syncing" : proposal.status);

  return (
    <>
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        className="w-full text-left flex flex-col gap-2 p-3.5 bg-white dark:bg-card border border-teal-50 dark:border-teal-900/40 shadow-sm rounded-2xl transition-all hover:shadow-md hover:border-teal-200 dark:hover:border-teal-700/60 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 shrink-0 rounded-xl border flex items-center justify-center text-lg ${statusColor}`}>
            {statusIcon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-slate-800 dark:text-foreground truncate">{proposal.title}</p>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${statusColor}`}>
                {statusLabel}
              </span>
              {hasVoted && !isFinal && (
                <span className="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border border-teal-200 text-teal-700 bg-teal-50 dark:bg-teal-950/30 dark:text-teal-200 dark:border-teal-900/50">
                  Voted · {hasVoted.toUpperCase()}
                  {votedWeight != null && (
                    <> · {new Intl.NumberFormat().format(Math.floor(votedWeight))} IDIA</>
                  )}
                </span>
              )}

              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                · {voteCount} intent{voteCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        {DeadlinePill}
      </button>

      {isProposer && isPendingForViewer && proposal.on_chain_id && (
        <Button
          onClick={(e) => { e.stopPropagation(); handleCancelPending(); }}
          disabled={isCancelling}
          variant="ghost"
          size="sm"
          className="w-full mt-1.5 h-9 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full border border-rose-200 dark:border-rose-900/50"
        >
          {isCancelling ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Cancelling…</>
          ) : (
            <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Cancel Proposal (Pending)</>
          )}
        </Button>
      )}

      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge
                className={`text-white text-[9px] font-black uppercase tracking-wider ${
                  isFinalDefeated
                    ? "bg-rose-500 hover:bg-rose-600"
                    : isFinalPassed
                      ? "bg-emerald-500 hover:bg-emerald-600"
                      : isActive
                        ? "bg-orange-500 hover:bg-orange-600"
                        : chain.state === 0
                          ? "bg-amber-500 hover:bg-amber-600"
                          : "bg-slate-400 hover:bg-slate-500"
                }`}
              >
                {statusLabel}
              </Badge>
              {SnapshotBadge}
              <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                {voteCount} intent{voteCount === 1 ? "" : "s"}
              </span>
            </div>
            <DialogTitle className="font-black text-base leading-tight text-foreground">
              {proposal.title}
            </DialogTitle>
            <DialogDescription className="text-xs whitespace-pre-wrap text-muted-foreground">
              {proposal.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            {TimeframeRow}

            {chain.state === 0 && (() => {
              const SEC_PER_BLOCK = 2;
              let opensInLabel = "syncing…";
              if (chain.snapshotBlock != null && chain.currentBlock != null) {
                const remaining = (chain.snapshotBlock - chain.currentBlock) * SEC_PER_BLOCK;
                if (remaining <= 0) {
                  opensInLabel = "any moment now";
                } else {
                  const d = Math.floor(remaining / 86400);
                  const h = Math.floor((remaining % 86400) / 3600);
                  const m = Math.floor((remaining % 3600) / 60);
                  opensInLabel = `${d}d ${h}h ${m}m`;
                }
              }
              void nowTick;
              return (
                <div className="p-3 rounded-2xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/30 dark:border-amber-900/50 space-y-1.5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-200">
                    Why is this Pending?
                  </p>
                  <p className="text-[11px] leading-snug text-amber-800/90 dark:text-amber-100/90">
                    The Governor records a voting-power snapshot before votes open. Until that snapshot block is reached, the proposal sits in a Pending window — no one can vote yet.
                  </p>
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-200">
                    Voting opens in {opensInLabel}
                  </p>
                  <p className="text-[10px] text-amber-700/80 dark:text-amber-200/80">
                    Only the original proposer may cancel while Pending. Once voting opens, cancellation is no longer available.
                  </p>
                </div>
              );
            })()}

            {QuorumBar}
            {isSubmitting && (
              <p className="text-[11px] text-muted-foreground animate-pulse">
                Verifying on-chain settlement…
              </p>
            )}
            <VoterLedger proposalId={proposal.proposal_ref} refreshKey={ledgerNonce} />

            {DeadlinePill}

            {isProposer && isPendingForViewer && proposal.on_chain_id && (
              <Button
                onClick={handleCancelPending}
                disabled={isCancelling}
                variant="destructive"
                className="w-full h-10 text-[10px] font-black uppercase tracking-widest rounded-full"
              >
                {isCancelling ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Cancelling…</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Cancel Proposal</>
                )}
              </Button>
            )}


            {hasVoted && !isFinal && (
              <div className="flex items-center gap-3 p-3 bg-teal-50/60 dark:bg-teal-950/30 border border-teal-100 dark:border-teal-900/50 rounded-2xl">
                <CheckCircle2 className="w-5 h-5 text-teal-600 shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-200">
                    Vote Recorded · {hasVoted.toUpperCase()}
                    {votedWeight != null && (
                      <> · {new Intl.NumberFormat().format(Math.floor(votedWeight))} IDIA</>
                    )}
                  </p>
                </div>
              </div>
            )}


            {!hasVoted && !isFinal && chain.state === 1 && (
              <div className="p-4 bg-teal-50/50 dark:bg-teal-950/30 rounded-2xl border border-teal-100/50 dark:border-teal-900/50 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-teal-700 dark:text-teal-200">
                  Cast Sovereign Vote · {votingPower ? Number(votingPower).toLocaleString() : 0} IDIAX
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => openVoteDialog("for")}
                    disabled={isSubmitting || isWithdrawing || loadingMeta}
                    className="h-11 bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase text-[10px] rounded-full"
                  >
                    <ThumbsUp className="w-3.5 h-3.5 mr-1.5" />
                    Vote For
                  </Button>
                  <Button
                    onClick={() => openVoteDialog("against")}
                    disabled={isSubmitting || isWithdrawing || loadingMeta}
                    variant="outline"
                    className="h-11 font-black uppercase text-[10px] rounded-full border-slate-300 dark:border-slate-700"
                  >
                    <ThumbsDown className="w-3.5 h-3.5 mr-1.5" />
                    Vote Against
                  </Button>
                </div>

                {isL3User && (
                  <div className="pt-3 mt-1 border-t border-purple-200/60 dark:border-purple-900/40 space-y-2">
                    <p className="text-[9px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300 flex items-center gap-1.5">
                      <Crown className="w-3 h-3" /> Protocol Steward · Tophat Override
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleCastVote("for", 0, true)}
                        disabled={isSubmitting || isWithdrawing || loadingMeta}
                        className="h-10 bg-purple-700 hover:bg-purple-800 text-white font-black uppercase tracking-widest text-[9px] rounded-full shadow-lg shadow-purple-900/20"
                      >
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Crown className="w-3 h-3 mr-1.5" />Carry For</>}
                      </Button>
                      <Button
                        onClick={() => handleCastVote("against", 0, true)}
                        disabled={isSubmitting || isWithdrawing || loadingMeta}
                        variant="outline"
                        className="h-10 font-black uppercase tracking-widest text-[9px] rounded-full border-purple-300 dark:border-purple-800 text-purple-700 dark:text-purple-300 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                      >
                        {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Crown className="w-3 h-3 mr-1.5" />Carry Against</>}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {canWithdraw && !isFinal && (
              <Button
                onClick={handleWithdraw}
                disabled={isWithdrawing}
                variant="ghost"
                size="sm"
                className="w-full h-9 text-[10px] font-black uppercase tracking-widest text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-full"
              >
                {isWithdrawing ? (
                  <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Withdrawing…</>
                ) : (
                  <><Trash2 className="w-3.5 h-3.5 mr-1.5" />Withdraw Proposal</>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={voteDialogOpen} onOpenChange={setVoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-black uppercase tracking-wider text-sm">
              Confirm Your Vote
            </DialogTitle>
            <DialogDescription className="text-xs">
              Casting{" "}
              <span className={pendingSupport === "for" ? "text-emerald-600 font-black" : "text-rose-600 font-black"}>
                {pendingSupport?.toUpperCase()}
              </span>{" "}
              on "{proposal.title}". The Governor will automatically apply 100% of your snapshot voting power.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-2xl border border-border bg-muted/40 p-4 text-center">
              <div className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                Your Voting Power
              </div>
              <div className="mt-1 font-mono text-3xl font-black tracking-tight">
                {Math.floor(numericVotingPower).toLocaleString()}
              </div>
              <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                IDIA
              </div>
            </div>

            <Button
              onClick={() => pendingSupport && handleCastVote(pendingSupport, numericVotingPower, false)}
              disabled={isSubmitting || !pendingSupport}
              className="w-full h-11 bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase text-[10px] rounded-full"
            >
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <>Confirm Vote · {pendingSupport?.toUpperCase()}</>}
            </Button>

            {isL3User && (
              <>
                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-purple-200 dark:border-purple-900/50" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-background px-2 text-[9px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300">
                      Protocol Steward
                    </span>
                  </div>
                </div>
                <Button
                  onClick={() => pendingSupport && handleCastVote(pendingSupport, 0, true)}
                  disabled={isSubmitting || !pendingSupport}
                  className="w-full h-12 bg-purple-700 hover:bg-purple-800 text-white font-black uppercase tracking-widest text-[11px] rounded-full shadow-lg shadow-purple-900/30"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Crown className="w-4 h-4 mr-2" />Tophat Override: Carry Vote</>}
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {voteBlast && (
        <div
          className="fixed inset-0 z-[10001] flex items-center justify-center pointer-events-none"
          style={{ animation: "vote-blast-fade 2.6s ease-out forwards" }}
        >
          <div className="absolute inset-0 bg-background/70 backdrop-blur-md" />
          <div
            className="relative text-center px-8"
            style={{ animation: "vote-blast-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) both" }}
          >
            <div
              className={`text-[11px] font-black uppercase tracking-[0.4em] mb-3 ${
                voteBlast.support === "for" ? "text-emerald-600" : "text-rose-600"
              }`}
            >
              Vote Cast · {voteBlast.support.toUpperCase()}
            </div>
            <div
              className={`font-mono font-black leading-none tracking-tight ${
                voteBlast.support === "for" ? "text-emerald-600" : "text-rose-600"
              }`}
              style={{ fontSize: "clamp(4rem, 18vw, 11rem)" }}
            >
              {voteBlast.weightLabel}
            </div>
            <div className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">
              {voteBlast.tophat ? "Tophat Override · Carried by Treasury" : "Anchored On-Chain"}
            </div>
          </div>
          <style>{`
            @keyframes vote-blast-pop {
              0%   { opacity: 0; transform: scale(0.6); }
              60%  { opacity: 1; transform: scale(1.08); }
              100% { opacity: 1; transform: scale(1); }
            }
            @keyframes vote-blast-fade {
              0%   { opacity: 1; }
              75%  { opacity: 1; }
              100% { opacity: 0; }
            }
          `}</style>
        </div>
      )}
    </>
  );
};


const ActiveProposalsList: React.FC<{
  balance: number;
  votingPower: number | string;
  refreshTrigger?: number;
  isSelfDelegated?: boolean;
  onDelegationChanged?: () => void | Promise<void>;
}> = ({ balance, votingPower, refreshTrigger = 0, isSelfDelegated = true, onDelegationChanged }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [chainStates, setChainStates] = useState<Map<string, ChainState>>(new Map());
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [ascensionLevel, setAscensionLevel] = useState<AscensionLevel>(0);
  const [innerRefresh, setInnerRefresh] = useState(0);

  useEffect(() => {
    let isMounted = true;
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    (async () => {
      const s = stage("ACTIVE_PROPOSALS", "FETCH_HYBRID");
      s.start();
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (isMounted) setUserId(user?.id ?? null);
        if (user) {
          const { data: profile } = await (supabase as any)
            .from("profiles")
            .select("wallet_address")
            .eq("id", user.id)
            .maybeSingle();
          if (isMounted) setWalletAddress(profile?.wallet_address ?? null);
        } else if (isMounted) {
          setWalletAddress(null);
        }

        // Hydrate viewer's ascension level from active hats
        if (user && isMounted) {
          const { data: hats } = await (supabase as any)
            .from("dao_hats")
            .select("hat_type")
            .eq("user_id", user.id)
            .eq("eligibility_status", "active")
            .is("revoked_at", null);
          const hatSet = new Set<string>((hats || []).map((h: any) => h.hat_type));
          if (isMounted) setAscensionLevel(getAscensionLevel(hatSet));
        }

        // Sequential to avoid RPC 429s — Supabase first (cheap), then on-chain.
        const dbProposals = await (supabase as any)
          .from("dao_proposals")
          .select("id, title, description, status, proposer_id, on_chain_id, lifecycle_phase, created_at, proposal_targets, proposal_values, proposal_calldatas")
          .order("created_at", { ascending: false });
        if (dbProposals.error) throw dbProposals.error;

        await delay(400);

        const onChainProposals = await governanceService
          .getRecentProposals(user?.id || "")
          .catch((e) => {
            console.warn("[ACTIVE_PROPOSALS] on-chain fetch failed:", e?.message);
            return [];
          });
        const indexedById = new Map<string, ProposalOnChain>(
          onChainProposals.map((p): [string, ProposalOnChain] => [p.proposalId, p]),
        );

        // Index DB rows by on_chain_id to dedupe anchored entries
        const anchoredIds = new Set<string>(
          (dbProposals.data || [])
            .map((r: any) => r.on_chain_id)
            .filter((x: unknown): x is string => typeof x === "string" && x.length > 0),
        );

        // ON-CHAIN MANDATE: drop any DB row that never anchored on-chain.
        const dbRows: Proposal[] = (dbProposals.data || []).filter((r: any) => typeof r.on_chain_id === "string" && r.on_chain_id.length > 0).map((r: any) => {
          const indexed = r.on_chain_id ? indexedById.get(r.on_chain_id) : undefined;
          return {
            id: r.id,
            proposal_ref: r.on_chain_id ?? r.id, // on-chain id wins when anchored
            title: r.title,
            description: r.description,
            status: indexed?.stateName ?? r.status,
            proposer_id: r.proposer_id,
            proposer_address: indexed?.proposer ?? null,
            on_chain_id: r.on_chain_id ?? null,
            lifecycle_phase: indexed?.stateName ?? r.lifecycle_phase ?? null,
            created_at: r.created_at ?? null,
            indexed_state: indexed?.state ?? null,
            proposal_targets: r.proposal_targets ?? indexed?.targets ?? null,
            proposal_values: r.proposal_values ?? indexed?.values ?? null,
            proposal_calldatas: r.proposal_calldatas ?? indexed?.calldatas ?? null,
            chain_description: indexed?.description ?? null,
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
            proposer_address: p.proposer,
            on_chain_id: p.proposalId,
            lifecycle_phase: p.stateName,
            created_at: null,
            indexed_state: p.state,
            proposal_targets: p.targets,
            proposal_values: p.values,
            proposal_calldatas: p.calldatas,
            chain_description: p.description,
          }));

        const combined = [...dbRows, ...chainRows];

        // Parent-side chain-state hydration — single canonical source for bucket classification.
        const stateEntries = await Promise.all(
          combined.map(async (p) => {
            if (!p.on_chain_id) {
              const dbState = deriveDbState(p);
              return [p.proposal_ref, dbState != null ? stateOnly(dbState) : null] as const;
            }
            try {
              const cs = await readChainState(p.on_chain_id);
              return [p.proposal_ref, cs] as const;
            } catch (e) {
              console.warn(`[ACTIVE_PROPOSALS][CLASSIFY] state read failed for ${p.proposal_ref}`, e);
              return [p.proposal_ref, p.indexed_state != null ? stateOnly(p.indexed_state) : null] as const;
            }
          }),
        );
        if (isMounted) {
          const map = new Map<string, ChainState>();
          for (const [ref, cs] of stateEntries) if (cs) map.set(ref, cs);
          setChainStates(map);
          setProposals(combined.sort((a, b) => sortByGovernanceOrder(a, b, map)));
          for (const [ref, cs] of stateEntries) {
            const st = cs?.state ?? null;
            const bucket = classifyBucket(st, !!combined.find((p) => p.proposal_ref === ref)?.on_chain_id);
            console.log(`[BUCKET_CLASSIFY] ref=${ref} state=${st} → ${bucket}`);
          }
        }
        s.ok({ count: combined.length });
      } catch (err: any) {
        s.fail(err);
        toast({ title: "Telemetry Stalled", description: err.message, variant: "destructive" });
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [refreshTrigger, innerRefresh]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/50">
          Syncing Operational Gateway...
        </p>
      </div>
    );
  }

  const activeProposals = proposals.filter((prop) => {
    const cs = chainStates.get(prop.proposal_ref);
    return classifyProposalBucket(prop, cs) === "ACTIVE_FEED";
  });

  if (activeProposals.length === 0) {
    const showActivateEmpty = !isSelfDelegated && balance > 0;
    return (
      <div className="space-y-5">
        {showActivateEmpty && (
          <ActivateVotingPowerCard
            idiaBalance={balance}
            onActivated={() => {
              onDelegationChanged?.();
              setInnerRefresh((n) => n + 1);
            }}
          />
        )}
        <div className="py-16 text-center opacity-40 space-y-3 bg-slate-50 dark:bg-muted/30 rounded-3xl border border-slate-100 dark:border-border">
          <Gavel className="mx-auto w-10 h-10 text-slate-400" />
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">No Active Proposals Found</p>
        </div>
      </div>
    );
  }

  const showActivate = !isSelfDelegated && balance > 0;

  return (
    <div className="space-y-5">
      {showActivate && (
        <ActivateVotingPowerCard
          idiaBalance={balance}
          onActivated={() => {
            onDelegationChanged?.();
            setInnerRefresh((n) => n + 1);
          }}
        />
      )}
      <div className="px-2">
        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
          Clearance · {LEVEL_LABEL[ascensionLevel]}
        </span>
      </div>
      {activeProposals
        .map((prop) => (
          <ProposalCard
            key={prop.id}
            proposal={prop}
            balance={balance}
            votingPower={votingPower}
            currentUserId={userId}
            currentWalletAddress={walletAddress}
            ascensionLevel={ascensionLevel}
            initialChainState={chainStates.get(prop.proposal_ref)}
            onChanged={() => setInnerRefresh((n) => n + 1)}
          />
        ))}
    </div>
  );
};

export default ActiveProposalsList;
