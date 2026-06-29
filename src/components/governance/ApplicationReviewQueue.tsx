import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ShieldCheck, CheckCircle2, XCircle, Loader2, Inbox, Handshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateACAHash } from "@/utils/acaGenerator";
import { recordACA } from "@/utils/acaLedger";
import { stage } from "@/lib/stageLogger";
import { getAscensionLevel, type AscensionLevel } from "@/utils/governanceGate";

interface PendingApplication {
  id: string;
  user_id: string;
  committee_id: string;
  statement_of_competence: string | null;
  created_at: string;
  sponsor_count?: number | null;
  risk_score?: number | null;
}

const ApplicationReviewQueue: React.FC = () => {
  const [apps, setApps] = useState<PendingApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState<AscensionLevel>(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState<Record<string, string>>({});

  const fetchState = async () => {
    const s = stage("APP_REVIEW", "FETCH");
    s.start();
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data: hats } = await (supabase as any)
        .from("dao_hats")
        .select("hat_type")
        .eq("user_id", user.id)
        .eq("eligibility_status", "active")
        .is("revoked_at", null);
      const hatSet = new Set<string>((hats || []).map((h: any) => h.hat_type));
      const lvl = getAscensionLevel(hatSet);
      setLevel(lvl);

      if (lvl < 2) {
        setApps([]);
        setLoading(false);
        s.ok({ skipped: "insufficient_level" });
        return;
      }

      const { data, error } = await (supabase as any)
        .from("committee_applications")
        .select("id, user_id, committee_id, statement_of_competence, created_at, sponsor_count, risk_score")
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (error) throw error;
      setApps(data || []);
      s.ok({ count: data?.length || 0 });
    } catch (e: any) {
      s.fail(e);
      console.error("[APP_REVIEW] fetch failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchState();
    const t = setInterval(fetchState, 10000);
    return () => clearInterval(t);
  }, []);

  const handleApprove = async (app: PendingApplication) => {
    setBusyId(app.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { hash, payload } = await generateACAHash(user.id, `application_approve_${app.id}`, [
        "APPLICATION_APPROVE",
        "HAT_PROVISIONING",
      ]);
      const { data, error } = await supabase.functions.invoke("ascension-approve", {
        body: { application_id: app.id, aca_hash: hash, aca_payload: payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: "Application Approved",
        description: `Hat provisioned in pending_veto. ACA ${hash.substring(0, 8)}…`,
      });
      fetchState();
    } catch (e: any) {
      toast({ title: "Approve failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (app: PendingApplication) => {
    const reason = (rejectReason[app.id] || "").trim();
    if (reason.length < 10) {
      toast({
        title: "Reason required",
        description: "Provide at least 10 characters of justification.",
        variant: "destructive",
      });
      return;
    }
    setBusyId(app.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { hash, payload } = await generateACAHash(user.id, `application_reject_${app.id}`, [
        "APPLICATION_REJECT",
        "LEDGER_WRITE",
      ]);
      const { data, error } = await supabase.functions.invoke("ascension-reject", {
        body: { application_id: app.id, reason, aca_hash: hash, aca_payload: payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Application Rejected", description: `ACA ${hash.substring(0, 8)}…` });
      setRejectReason((m) => ({ ...m, [app.id]: "" }));
      fetchState();
    } catch (e: any) {
      toast({ title: "Reject failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleEndorse = async (app: PendingApplication) => {
    setBusyId(app.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { hash, payload } = await generateACAHash(user.id, `sponsor_${app.id}`, [
        "APPLICATION_ENDORSE", "SPONSORSHIP",
      ]);
      const { error } = await (supabase as any).from("committee_application_sponsorships").insert({
        application_id: app.id,
        sponsor_user_id: user.id,
        sponsor_aca_hash: hash,
      });
      if (error) throw error;
      await recordACA({
        userId: user.id, sourceId: "GOV_APPLICATION_ENDORSE",
        consentType: "APPLICATION_ENDORSE_V1", hash, payload,
      });
      toast({ title: "Endorsement recorded", description: `ACA ${hash.substring(0, 8)}…` });
      fetchState();
    } catch (e: any) {
      toast({ title: "Endorse failed", description: e.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (level < 2) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-2">
        <ShieldCheck size={14} className="text-teal-600" /> Application Review Queue · L{level}
      </h2>

      {apps.length === 0 ? (
        <div className="py-10 text-center opacity-40 space-y-2 bg-slate-50 dark:bg-muted/30 rounded-3xl border border-slate-100 dark:border-border">
          <Inbox className="mx-auto w-8 h-8 text-slate-400" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No Pending Applications</p>
        </div>
      ) : (
        <div className="space-y-3">
          {apps.map((app) => (
            <Card key={app.id} className="border-teal-100 dark:border-teal-900/40 rounded-3xl shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-wider">
                    {app.committee_id.replace(/_/g, " ")}
                  </Badge>
                  <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                    {new Date(app.created_at).toLocaleDateString()}
                  </span>
                  {typeof app.sponsor_count === "number" && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                      · {app.sponsor_count} sponsor{app.sponsor_count === 1 ? "" : "s"}
                    </span>
                  )}
                  {typeof app.risk_score === "number" && (
                    <span className="text-[9px] font-black uppercase tracking-widest text-rose-600">
                      · risk {app.risk_score}
                    </span>
                  )}
                </div>
                <p className="text-[10px] font-mono text-muted-foreground break-all">
                  applicant: {app.user_id}
                </p>
                <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {app.statement_of_competence || "(no statement provided)"}
                </p>

                <Textarea
                  value={rejectReason[app.id] || ""}
                  onChange={(e) => setRejectReason((m) => ({ ...m, [app.id]: e.target.value }))}
                  placeholder="Reason (required to reject, ≥10 chars)"
                  className="text-xs min-h-[60px] rounded-2xl"
                  disabled={busyId === app.id}
                />

                <div className="grid grid-cols-3 gap-2">
                  <Button
                    onClick={() => handleEndorse(app)}
                    disabled={busyId === app.id}
                    variant="outline"
                    className="h-10 font-black uppercase text-[10px] rounded-full border-teal-300 text-teal-700 hover:bg-teal-50 dark:hover:bg-teal-950/30"
                  >
                    <Handshake className="w-3.5 h-3.5 mr-1.5" />
                    Endorse
                  </Button>
                  <Button
                    onClick={() => handleApprove(app)}
                    disabled={busyId === app.id}
                    className="h-10 bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase text-[10px] rounded-full"
                  >
                    {busyId === app.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                        Approve
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => handleReject(app)}
                    disabled={busyId === app.id}
                    variant="outline"
                    className="h-10 font-black uppercase text-[10px] rounded-full border-rose-300 text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                  >
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
};

export default ApplicationReviewQueue;
