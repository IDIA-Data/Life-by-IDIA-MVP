import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldOff, Zap, Loader2, Fingerprint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateACAHash } from "@/utils/acaGenerator";
import { isNative } from "@/services/platform";

interface PendingAction {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  timelock_expires_at: string;
  veto_threshold: number;
  veto_count: number;
  status: "pending" | "vetoed" | "executed";
}

const formatRemaining = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Timelock expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
};

const PendingActionsCarousel: React.FC = () => {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [vetoing, setVetoing] = useState<string | null>(null);

  const fetchActions = async () => {
    console.log("[PENDING_ACTIONS] START: Syncing optimistic timelock actions from Wyoming Gateway.");
    try {
      const { data, error } = await (supabase as any)
        .from("dao_pending_actions")
        .select("*")
        .eq("status", "pending")
        .order("timelock_expires_at", { ascending: true });

      if (error) throw error;

      console.log(`[PENDING_ACTIONS] SUCCESS: Retrieved ${data?.length || 0} pending actions.`);
      setActions(data || []);
    } catch (err: any) {
      console.error(`[PENDING_ACTIONS] CRITICAL_FAILURE: Failed to query pending actions. Reason: ${err.message}`);
      toast({
        title: "Carousel Sync Failed",
        description: "Could not retrieve pending timelock telemetry.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      console.log("[PENDING_ACTIONS] END: Fetch execution thread terminated.");
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isMounted) {
      fetchActions();
    }

    console.log("[PENDING_ACTIONS] SOCKET_START: Establishing real-time connection for Timelock Events.");
    const ch = supabase
      .channel("dao_pending_actions_live")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dao_pending_actions" }, (payload) => {
        console.log(
          "[PENDING_ACTIONS] SOCKET_EVENT: Real-time mutation detected in timelock queue. Re-syncing...",
          payload,
        );
        fetchActions();
      })
      .subscribe((status) => {
        console.log(`[PENDING_ACTIONS] SOCKET_STATUS: Gateway socket state -> ${status}`);
      });

    // Update timers every 60 seconds
    const tick = setInterval(() => {
      if (isMounted) setActions((a) => [...a]);
    }, 60_000);

    return () => {
      isMounted = false;
      console.log("[PENDING_ACTIONS] SOCKET_CLOSE: Tearing down real-time connection.");
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  const castVeto = async (actionId: string) => {
    console.log(`[VETO_ACTION] START: Initializing Negative Consent sequence for action: ${actionId}`);
    if (!isNative()) {
      toast({
        title: "Native Device Required",
        description: "Veto actions require Secure Enclave attestation. Please use the iOS or Android app.",
        variant: "destructive",
      });
      return;
    }
    setVetoing(actionId);

    try {
      console.log(`[VETO_ACTION] AUTH: Retrieving local sovereign identity.`);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Sovereign authentication failed or identity not found.");
      }

      console.log(`[VETO_ACTION] ACA_ANCHOR_START: Requesting hardware-backed biological anchor for veto mapping...`);
      const { hash, payload } = await generateACAHash(user.id, `veto_action_${actionId}`, [
        "NEGATIVE_CONSENT",
        "LEDGER_WRITE",
      ]);
      console.log(`[VETO_ACTION] ACA_ANCHOR_END: Biological presence verified. SHA-256 Hash Generated: ${hash}`);

      console.log(`[VETO_ACTION] NETWORK_START: Transmitting secure veto payload to Wyoming Operational Gateway.`);
      
      // FIX: Cast supabase to any to prevent 'never' type inference errors
      const { error: ledgerError } = await (supabase as any).from("dao_vetoes").insert({
        action_id: actionId,
        user_id: user.id,
        aca_hash_key: hash,
        aca_payload: payload,
      });

      if (ledgerError) {
        if (ledgerError.code === "23505") {
          toast({
            title: "Already Vetoed",
            description: "Your sovereign veto on this action is already on the ledger.",
            variant: "destructive",
          });
          return;
        }
        throw ledgerError;
      }

      console.log(`[VETO_ACTION] NETWORK_END: Veto committed. Triggering tally oracle verification.`);
      toast({
        title: "Veto Cast Successfully",
        description: `Secured via ACA Hash ${hash.substring(0, 8)}...`,
      });

      // Invoke Edge Function to verify if threshold has been breached
      await supabase.functions.invoke("dao-veto-tally", { body: { actionId } });
      fetchActions();
    } catch (error: any) {
      console.error(`[VETO_ACTION] CRITICAL_FAILURE: Veto sequence halted. Reason: ${error.message}`);
      toast({
        title: "Veto Failed",
        description: "The sequence was interrupted. Check terminal logs.",
        variant: "destructive",
      });
    } finally {
      setVetoing(null);
      console.log(`[VETO_ACTION] END: Execution thread terminated.`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-8 space-y-3">
        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        <p className="text-[9px] font-black uppercase tracking-widest text-orange-700/50">Syncing Timelock Queue...</p>
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="py-10 text-center opacity-40 bg-orange-50/50 rounded-3xl border border-orange-100 space-y-2">
        <Zap className="mx-auto w-8 h-8 text-orange-400" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600/70">
          No Pending Actions in Timelock
        </p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 snap-x snap-mandatory scrollbar-hide">
      {actions.map((a) => {
        const expired = new Date(a.timelock_expires_at).getTime() <= Date.now();
        return (
          <Card
            key={a.id}
            className="min-w-[280px] max-w-[280px] snap-center rounded-[1.5rem] border-orange-100 shadow-sm flex-shrink-0 transition-all hover:shadow-md bg-white"
          >
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[8px] font-black uppercase tracking-wider">
                  Optimistic Update
                </Badge>
                {a.category && (
                  <span className="text-[9px] font-black uppercase tracking-widest text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md">
                    {a.category}
                  </span>
                )}
              </div>

              <div className="space-y-1">
                <h4 className="font-black text-sm leading-tight text-slate-800">{a.title}</h4>
                <p className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{a.description}</p>
              </div>

              <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600 bg-orange-50/80 p-2 rounded-lg border border-orange-100/50">
                <Clock size={12} className="animate-pulse" />
                {formatRemaining(a.timelock_expires_at)}
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-orange-50/50">
                <div className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                  Vetoes <span className="text-slate-700">{a.veto_count}</span>/{a.veto_threshold}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={vetoing === a.id || expired}
                  onClick={() => castVeto(a.id)}
                  className="h-8 text-[9px] font-black uppercase tracking-widest border-orange-200 text-orange-700 hover:bg-orange-50 rounded-full transition-all hover:border-orange-300 shadow-sm"
                >
                  {vetoing === a.id ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin mr-1.5" />
                      AWAITING ACA
                    </>
                  ) : (
                    <>
                      <Fingerprint size={12} className="mr-1.5 opacity-70" />
                      VETO ACTION
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PendingActionsCarousel;