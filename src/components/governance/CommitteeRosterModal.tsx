import React, { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, ArrowUpCircle, ArrowDownCircle, Wallet } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { LEVEL_BADGE_CLASS, LEVEL_LABEL, getAscensionLevel, type AscensionLevel } from "@/utils/governanceGate";

export type CommitteeMeta = {
  id: string;
  name: string;
  hatName: string;
};

type Member = {
  userId: string;
  walletAddress: string | null;
  level: AscensionLevel; // 1 or 2 here (or 0 for pending)
  status: "active" | "pending_veto";
  vetoWindowEnd?: string | null;
};

interface Props {
  committee: CommitteeMeta | null;
  callerId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const shortWallet = (w?: string | null) =>
  w && w.length > 12 ? `${w.slice(0, 6)}…${w.slice(-4)}` : (w || "—");

const CommitteeRosterModal: React.FC<Props> = ({
  committee,
  callerId,
  open,
  onOpenChange,
  onChanged,
}) => {
  const [loading, setLoading] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!committee) return;
    setLoading(true);
    try {
      // 1. Officers with this committee's hat
      const { data: hats, error: hatsErr } = await (supabase as any)
        .from("dao_hats")
        .select("user_id, eligibility_status, veto_window_end")
        .eq("hat_type", committee.id)
        .is("revoked_at", null);
      if (hatsErr) throw hatsErr;
      const userIds = Array.from(new Set((hats || []).map((h: any) => h.user_id)));

      // 2. Active oversight_chair + tophat holders among these users (drives true level)
      let chairs = new Set<string>();
      let tophats = new Set<string>();
      if (userIds.length > 0) {
        const [chairRes, tophatRes] = await Promise.all([
          (supabase as any)
            .from("dao_hats")
            .select("user_id")
            .eq("hat_type", "oversight_chair")
            .eq("eligibility_status", "active")
            .is("revoked_at", null)
            .in("user_id", userIds),
          (supabase as any)
            .from("dao_hats")
            .select("user_id")
            .eq("hat_type", "tophat")
            .eq("eligibility_status", "active")
            .is("revoked_at", null)
            .in("user_id", userIds),
        ]);
        chairs = new Set((chairRes.data || []).map((r: any) => r.user_id));
        tophats = new Set((tophatRes.data || []).map((r: any) => r.user_id));
      }

      // 3. Wallet addresses (zero-PII safe identifier)
      let wallets: Record<string, string | null> = {};
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any)
          .from("member_wallet_directory")
          .select("user_id, wallet_address")
          .in("user_id", userIds);
        (profs || []).forEach((p: any) => (wallets[p.user_id] = p.wallet_address ?? null));
      }

      const list: Member[] = (hats || []).map((h: any) => {
        const isActive = h.eligibility_status === "active";
        // Build the user's active-hat set and derive the canonical Ascension
        // Level via the single source of truth (handles tophat → L3).
        const hatSet = new Set<string>();
        if (isActive) {
          hatSet.add(committee.id);
          if (chairs.has(h.user_id)) hatSet.add("oversight_chair");
          if (tophats.has(h.user_id)) hatSet.add("tophat");
        }
        const level: AscensionLevel = isActive ? getAscensionLevel(hatSet) : (0 as AscensionLevel);
        return {
          userId: h.user_id,
          walletAddress: wallets[h.user_id] ?? null,
          level,
          status: isActive ? "active" : "pending_veto",
          vetoWindowEnd: h.veto_window_end,
        };
      });

      // sort: L2 first, then L1, pending last
      list.sort((a, b) => (b.level - a.level));
      setMembers(list);
    } catch (e: any) {
      console.error("[COMMITTEE_ROSTER] load failed", e);
      toast({ title: "Roster failed to load", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [committee]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const toggle = async (member: Member, action: "promote" | "demote") => {
    if (!callerId || !committee) return;
    setBusyId(member.userId);
    try {
      const { hash, payload } = await generateACAHash(
        callerId,
        `oversight_chair_${action}_${member.userId}`,
        ["OVERSIGHT_CHAIR_TOGGLE"],
      );
      const { error } = await supabase.functions.invoke("oversight-chair-toggle", {
        body: {
          target_user_id: member.userId,
          action,
          aca_hash: hash,
          aca_payload: payload,
        },
      });
      if (error) throw error;
      toast({
        title: action === "promote" ? "Promoted to L2" : "Demoted to L1",
        description: `Wallet ${shortWallet(member.walletAddress)} updated.`,
      });
      await load();
      onChanged?.();
    } catch (e: any) {
      console.error("[COMMITTEE_ROSTER] toggle failed", e);
      toast({ title: "Action failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="w-4 h-4 text-purple-600" />
            {committee?.name} · Roster
          </DialogTitle>
          <DialogDescription className="text-xs">
            Protocol Steward control surface. Promote Level 1 officers to Oversight Chair (L2) or
            demote L2 chairs back to L1. Members are identified by their on-chain wallet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-purple-600" />
            </div>
          ) : members.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-8">
              No officers found for this committee.
            </div>
          ) : (
            members.map((m) => {
              const isSelf = m.userId === callerId;
              const isBusy = busyId === m.userId;
              const isPending = m.status === "pending_veto";
              const lvl = isPending ? 0 : m.level;
              return (
                <div
                  key={m.userId}
                  className="rounded-lg border border-border bg-card/60 backdrop-blur p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="font-mono text-xs truncate" title={m.walletAddress || m.userId}>
                        {shortWallet(m.walletAddress)}
                      </span>
                      {isSelf && (
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">you</span>
                      )}
                    </div>
                    <span
                      className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${LEVEL_BADGE_CLASS[lvl]}`}
                    >
                      {isPending ? "L1 · pending" : LEVEL_LABEL[lvl]}
                    </span>
                  </div>

                  {isPending ? (
                    <p className="text-[10px] text-muted-foreground">
                      Veto window ends{" "}
                      {m.vetoWindowEnd
                        ? new Date(m.vetoWindowEnd).toLocaleString()
                        : "—"}
                    </p>
                  ) : m.level === 1 ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => toggle(m, "promote")}
                      className="self-end border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-900/50 dark:text-blue-300 dark:hover:bg-blue-950/30"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <ArrowUpCircle className="w-3 h-3 mr-1.5" />
                      )}
                      Promote → L2
                    </Button>
                  ) : m.level === 2 && !isSelf ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isBusy}
                      onClick={() => toggle(m, "demote")}
                      className="self-end border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-950/30"
                    >
                      {isBusy ? (
                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                      ) : (
                        <ArrowDownCircle className="w-3 h-3 mr-1.5" />
                      )}
                      Demote → L1
                    </Button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CommitteeRosterModal;
