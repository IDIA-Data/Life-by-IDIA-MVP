import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, XCircle, CalendarClock, ShieldCheck } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import {
  authorizeGovernanceAction,
  canPerformAction,
  getAscensionLevel,
  IndemnityViolation,
  LEVEL_LABEL,
  LEVEL_BADGE_CLASS,
  type AscensionLevel,
} from "@/utils/governanceGate";

const ComplianceQueue: React.FC = () => {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);
  const [level, setLevel] = useState<AscensionLevel>(0);

  // Modal States
  const [vetoTarget, setVetoTarget] = useState<any | null>(null);
  const [extendTarget, setExtendTarget] = useState<any | null>(null);
  const [reason, setReason] = useState("");

  const fetchQueue = async () => {
    console.log("[COMPLIANCE_QUEUE] BEGIN: Fetching pending_veto telemetry.");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // Hydrate viewer's ascension level from active hats
      if (user) {
        const { data: hats } = await (supabase as any)
          .from("dao_hats")
          .select("hat_type")
          .eq("user_id", user.id)
          .eq("eligibility_status", "active")
          .is("revoked_at", null);
        const set = new Set<string>((hats || []).map((h: any) => h.hat_type));
        setLevel(getAscensionLevel(set));
      }

      const { data, error } = await supabase
        .from("dao_hats")
        .select("*")
        .eq("eligibility_status", "pending_veto")
        .is("revoked_at", null);

      if (error) throw error;
      setItems(data || []);
      console.log("[COMPLIANCE_QUEUE] SUCCESS: Fetched", data?.length, "items.");
    } catch (e) {
      console.error("[COMPLIANCE_QUEUE] CRITICAL_STALL: Fetch failed", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleVeto = async () => {
    if (!vetoTarget) return;
    try {
      authorizeGovernanceAction(level, 3, `VETO_COMMITTEE_APPLICATION:${vetoTarget.id}`);
    } catch (e) {
      const userMsg = e instanceof IndemnityViolation ? e.userMessage : "Insufficient clearance.";
      toast({ title: "Insufficient Authority", description: userMsg, variant: "destructive" });
      return;
    }
    setActionBusyId(vetoTarget.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { hash, payload } = await generateACAHash(user!.id, `veto_${vetoTarget.id}`, [
        "VETO_ACTION",
        "LEDGER_WRITE",
      ]);

      const { error } = await supabase.functions.invoke("ascension-veto", {
        body: {
          hat_id: vetoTarget.id,
          veto_reason: reason,
          aca_hash: hash,
          aca_payload: payload,
        },
      });

      if (error) throw error;
      toast({ title: "Veto Executed Successfully" });
      setVetoTarget(null);
      setReason("");
      fetchQueue();
    } catch (e: any) {
      console.error("[COMPLIANCE_QUEUE] CRITICAL_STALL: Veto execution failed", e);
      toast({ title: "Veto Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleExtend = async (target: any) => {
    try {
      authorizeGovernanceAction(level, 2, `EXTEND_VETO_WINDOW:${target.id}`);
    } catch (e) {
      const userMsg = e instanceof IndemnityViolation ? e.userMessage : "Insufficient clearance.";
      toast({ title: "Insufficient Authority", description: userMsg, variant: "destructive" });
      return;
    }
    setActionBusyId(target.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { hash, payload } = await generateACAHash(user!.id, `extend_${target.id}`, ["VETO_EXTENSION"]);

      const newEnd = new Date(new Date(target.veto_window_end).getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { error } = await (supabase as any)
        .from("dao_hats")
        .update({
          veto_window_end: newEnd,
          veto_extended: true,
          veto_extended_at: new Date().toISOString(),
          veto_aca_hash: hash,
          veto_aca_payload: payload,
        })
        .eq("id", target.id);

      if (error) throw error;
      toast({ title: "Veto Window Extended" });
      setExtendTarget(null);
      fetchQueue();
    } catch (e: any) {
      console.error("[COMPLIANCE_QUEUE] CRITICAL_STALL: Extension failed", e);
      toast({ title: "Extension Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handlePromote = async (hat: any) => {
    try {
      authorizeGovernanceAction(level, 3, `TOPHAT_OVERRIDE:${hat.id}`);
    } catch (e) {
      const userMsg = e instanceof IndemnityViolation ? e.userMessage : "Insufficient clearance.";
      toast({ title: "Insufficient Authority", description: userMsg, variant: "destructive" });
      return;
    }
    setActionBusyId(hat.id);
    console.log("[COMPLIANCE_QUEUE] BEGIN: Stewardship promotion for:", hat.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { hash, payload } = await generateACAHash(user!.id, `promote_${hat.id}`, ["TOPHAT_PROMOTE"]);

      const { error } = await supabase.functions.invoke("ascension-promote", {
        body: { hat_id: hat.id, aca_hash: hash, aca_payload: payload },
      });

      if (error) throw error;
      toast({ title: "Stewardship Override Successful" });
      fetchQueue();
    } catch (e: any) {
      console.error("[COMPLIANCE_QUEUE] STALL: Promotion failed", e);
      toast({ title: "Promotion Failed", description: e.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  if (isLoading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin text-teal-600" />
      </div>
    );

  // Top-level visibility gate — VIEW_COMPLIANCE_QUEUE requires Level 2+
  if (!canPerformAction(level, 2)) {
    console.warn(`[COMPLIANCE_QUEUE] Access denied · Level ${level} (${LEVEL_LABEL[level]}) below required L2.`);
    return (
      <Card className="border-red-100 bg-red-50/50">
        <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-2">
          <ShieldCheck className="w-8 h-8 text-red-500 mb-2" />
          <h3 className="font-bold text-red-900">Restricted · Oversight Chair Required</h3>
          <p className="text-xs text-red-700 max-w-md">
            The Compliance Queue is gated to Level 2+ (Oversight Chair). Your current clearance: {LEVEL_LABEL[level]}.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground">Compliance Queue</h2>
        <div
          className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${LEVEL_BADGE_CLASS[level]}`}
        >
          <ShieldCheck className="w-3 h-3" /> {LEVEL_LABEL[level]}
        </div>
      </div>
      {items.length === 0 && (
        <p className="text-xs text-muted-foreground p-4 bg-muted/20 rounded">No pending actions detected.</p>
      )}

      {items.map((item) => (
        <Card key={item.id} className="border-amber-200 bg-amber-50/30">
          <CardContent className="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs font-mono text-muted-foreground">ID: {item.id}</p>
              <p className="text-sm font-bold capitalize">{item.hat_type}</p>
              <p className="text-[10px] text-amber-700 font-medium">
                Expires: {new Date(item.veto_window_end).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-2 flex-wrap">
              {canPerformAction(level, 2) && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExtendTarget(item)}
                  disabled={actionBusyId === item.id}
                >
                  <CalendarClock className="w-3 h-3 mr-1" /> Extend
                </Button>
              )}
              {canPerformAction(level, 3) && (
                <>
                  <Button
                    size="sm"
                    onClick={() => handlePromote(item)}
                    disabled={actionBusyId === item.id}
                    className="bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200"
                  >
                    <ShieldCheck className="w-3 h-3 mr-1" /> Promote
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setVetoTarget(item)}
                    disabled={actionBusyId === item.id}
                  >
                    <XCircle className="w-3 h-3 mr-1" /> Veto
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Veto Dialog */}
      <Dialog open={!!vetoTarget} onOpenChange={(o) => !o && setVetoTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Execute Veto</DialogTitle>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Justification for veto..."
          />
          <DialogFooter>
            <Button variant="destructive" onClick={handleVeto} disabled={actionBusyId === vetoTarget?.id}>
              Confirm Veto
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Extend Dialog */}
      <Dialog open={!!extendTarget} onOpenChange={(o) => !o && setExtendTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Extend Veto Window (+24h)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Confirm extension for hat <span className="font-mono">{extendTarget?.id?.slice(0, 8)}…</span>. This is
            recorded immutably to the audit trail.
          </p>
          <DialogFooter>
            <Button onClick={() => extendTarget && handleExtend(extendTarget)} disabled={actionBusyId === extendTarget?.id}>
              Confirm Extension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ComplianceQueue;
