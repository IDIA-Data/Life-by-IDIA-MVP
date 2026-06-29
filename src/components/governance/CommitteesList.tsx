import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  ShieldAlert,
  Code,
  Scale,
  HeartHandshake,
  ChevronRight,
  Fingerprint,
  Loader2,
  Clock,
  RotateCcw,
  LogOut,
  UserPlus,
  Users,
  ShieldCheck,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { isNative } from "@/services/platform";
import { getAscensionLevel, LEVEL_LABEL, LEVEL_BADGE_CLASS } from "@/utils/governanceGate";
import CommitteeRosterModal from "./CommitteeRosterModal";

// We keep the structural UI metadata static, but all metrics are hydrated live.
const COMMITTEES_META = [
  {
    id: "legal_defense",
    name: "Legal Defense & Jurisdiction",
    icon: Scale,
    description: "Fiduciary oversight of the Delaware MSA. Manages corporate defense funds and regulatory compliance.",
    hatName: "⚖️ Legal Defense Hat",
  },
  {
    id: "sociorelational",
    name: "Sociorelational Impact (DCGP)",
    icon: HeartHandshake,
    description: "Manages the Virtuous Cycle. Oversees distribution of the 1% and 10% data yield to community grants.",
    hatName: "🤝 Sociorelational Hat",
  },
  {
    id: "security_council",
    name: "Security Council Auxiliary",
    icon: ShieldAlert,
    description: "Audits smart contracts, monitors for Sybil attacks, and reviews system threat telemetries.",
    hatName: "🛡️ Security Council Hat",
  },
  {
    id: "product_xr",
    name: "Product & XR Architecture",
    icon: Code,
    description: "Enforces the 'Glossy/Glass' aesthetic and reviews spatial computing manifestations.",
    hatName: "💻 Prod/XR Hat",
  },
];

type CommitteeMeta = (typeof COMMITTEES_META)[0];

const CommitteesList: React.FC = () => {
  const [selectedCommittee, setSelectedCommittee] = useState<CommitteeMeta | null>(null);
  const [statement, setStatement] = useState("");
  const [msaAcknowledged, setMsaAcknowledged] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Map committee_id -> { id, status, sponsor_count } for the current user
  const [userApplications, setUserApplications] = useState<Record<string, any>>({});
  // Map hat_type -> { eligibility_status, veto_window_end }
  const [userHats, setUserHats] = useState<Record<string, any>>({});
  const [userActiveHats, setUserActiveHats] = useState<Set<string>>(new Set());
  // Map hat_type -> veto_window_end ISO for the CURRENT user's pending_veto hats
  const [userPendingHats, setUserPendingHats] = useState<Record<string, string>>({});
  // ADD THIS LINE
  const [officerCounts, setOfficerCounts] = useState<Record<string, number>>({});
  // Set of hat_type values where the current user holds an active hat
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);

  // Confirm dialog state for revoke + resign
  const [revokeTarget, setRevokeTarget] = useState<CommitteeMeta | null>(null);
  const [resignTarget, setResignTarget] = useState<CommitteeMeta | null>(null);
  const [rosterTarget, setRosterTarget] = useState<CommitteeMeta | null>(null);
  const [callerId, setCallerId] = useState<string | null>(null);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  // 1. Fetch Hats + Applications in one sweep
  const fetchLedgerState = async () => {
    console.log("[COMMITTEES_LIST] START: Hydrating live registry metrics.");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsLoadingLedger(false);
        return;
      }
      setCallerId(user.id);

      // 1. Fetch Hats + Applications
      const [hatsRes, appsRes] = await Promise.all([
        (supabase as any)
          .from("dao_hats")
          .select("hat_type, user_id, eligibility_status, veto_window_end, revoked_at")
          .is("revoked_at", null),
        (supabase as any)
          .from("committee_applications")
          .select("id, committee_id, status, sponsor_count")
          .eq("user_id", user.id),
      ]);

      const hatMap: Record<string, any> = {};
      const counts: Record<string, number> = {};
      const myHats = new Set<string>();
      const myPending: Record<string, string> = {};

      hatsRes.data?.forEach((h: any) => {
        counts[h.hat_type] = (counts[h.hat_type] || 0) + 1;
        if (h.user_id === user.id) {
          if (h.eligibility_status === "active") myHats.add(h.hat_type);
          else if (h.eligibility_status === "pending_veto") {
            myPending[h.hat_type] = h.veto_window_end;
          }
        }
        hatMap[h.hat_type] = h;
      });

      const appMap: Record<string, any> = {};
      appsRes.data?.forEach((a: any) => (appMap[a.committee_id] = a));

      setOfficerCounts(counts);
      setUserActiveHats(myHats);
      setUserPendingHats(myPending);
      setUserHats(hatMap);
      setUserApplications(appMap);

      console.log("[COMMITTEES_LIST] SUCCESS: Registry metrics synced.");
    } catch (error: any) {
      console.error("[COMMITTEES_LIST] CRITICAL_FAILURE: Matrix sync failed:", error.message);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  useEffect(() => {
    fetchLedgerState();
    const interval = setInterval(fetchLedgerState, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApplyClick = (committee: CommitteeMeta) => {
    console.log(`[UI_INTERACTION] START: User selected ${committee.name} for application.`);
    setSelectedCommittee(committee);
    setStatement("");
    setMsaAcknowledged(false);
  };

  const handleSubmission = async () => {
    console.log(`[COMMITTEE_APPLICATION] START: Initializing Level 1 Ascension sequence for ${selectedCommittee?.id}.`);
    setIsProcessing(true);

    try {
      if (statement.trim().length < 50) {
        toast({
          title: "Validation Failed",
          description: "Your Statement of Competence must be at least 50 characters.",
          variant: "destructive",
        });
        throw new Error("Statement too short.");
      }
      if (!msaAcknowledged) {
        toast({
          title: "Bonding Required",
          description: "You must legally bind your identity to the MSA to proceed.",
          variant: "destructive",
        });
        throw new Error("MSA not acknowledged.");
      }

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Authentication failure prior to ACA generation.");

      // NATIVELY READ TOPHAT ROLE
      const isTophat = userActiveHats.has("tophat");
      const actionIdentifier = isTophat
        ? `committee_auto_join_${selectedCommittee?.id}`
        : `committee_join_${selectedCommittee?.id}`;

      const { hash, payload } = await generateACAHash(user.id, actionIdentifier, [
        "DELAWARE_MSA_BONDING",
        "LEDGER_WRITE",
        ...(isTophat ? ["TOPHAT_OVERRIDE"] : []),
      ]);

      if (isTophat) {
        // TOPHAT OVERRIDE: Automatically approve application and provision the hat
        console.log(`[COMMITTEE_APPLICATION] Tophat override detected. Auto-provisioning ${selectedCommittee?.id}.`);

        const { error: appError } = await (supabase as any).from("committee_applications").insert({
          user_id: user.id,
          committee_id: selectedCommittee?.id,
          statement_of_competence: statement,
          aca_hash_key: hash,
          aca_payload: payload,
          status: "approved",
        });
        if (appError) throw appError;

        const { error: hatError } = await (supabase as any).from("dao_hats").insert({
          user_id: user.id,
          hat_type: selectedCommittee?.id,
          eligibility_status: "active",
        });
        if (hatError) throw hatError;

        toast({
          title: "Tophat Override Authorized",
          description: `Auto-provisioned ${selectedCommittee?.name} hat. ACA Hash: ${hash.substring(0, 8)}...`,
        });
      } else {
        // STANDARD FLOW: Submit for audit
        const { error: ledgerError } = await (supabase as any).from("committee_applications").insert({
          user_id: user.id,
          committee_id: selectedCommittee?.id,
          statement_of_competence: statement,
          aca_hash_key: hash,
          aca_payload: payload,
          status: "pending",
        });
        if (ledgerError) throw ledgerError;

        toast({
          title: "Application Committed",
          description: `Identity anchored to ${selectedCommittee?.name} with ACA Hash: ${hash.substring(0, 8)}...`,
        });
      }

      fetchLedgerState();
      setSelectedCommittee(null);
    } catch (error: any) {
      console.error(`[COMMITTEE_APPLICATION] CRITICAL_FAILURE: ${error.message}`);
      toast({ title: "Ascension Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRevokeRequest = async (committee: CommitteeMeta) => {
    console.log(`[COMMITTEE_REVOKE] START: Withdrawing pending application for ${committee.id}.`);
    const app = userApplications[committee.id];
    if (!app || app.status !== "pending") {
      toast({ title: "No Pending Application", description: "Nothing to withdraw.", variant: "destructive" });
      setRevokeTarget(null);
      return;
    }

    setActionBusyId(committee.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication failure.");

      const { hash, payload } = await generateACAHash(user.id, `committee_revoke_request_${committee.id}`, [
        "DELAWARE_MSA_WITHDRAWAL",
        "LEDGER_WRITE",
      ]);

      const { error } = await (supabase as any)
        .from("committee_applications")
        .update({ status: "withdrawn", aca_hash_key: hash, aca_payload: payload })
        .eq("id", app.id)
        .eq("user_id", user.id)
        .eq("status", "pending");
      if (error) throw error;

      toast({
        title: "Request Withdrawn",
        description: `Pending application to ${committee.name} released. ACA ${hash.substring(0, 8)}…`,
      });
      setRevokeTarget(null);
      fetchLedgerState();
    } catch (error: any) {
      console.error(`[COMMITTEE_REVOKE] CRITICAL_FAILURE: ${error.message}`);
      toast({ title: "Withdrawal Failed", description: error.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const handleRemoveMembership = async (committee: CommitteeMeta) => {
    console.log(`[COMMITTEE_RESIGN] START: Revoking active hat ${committee.id}.`);
    setActionBusyId(committee.id);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Authentication failure.");

      const { hash, payload } = await generateACAHash(user.id, `committee_resign_${committee.id}`, [
        "DELAWARE_MSA_RESIGNATION",
        "HAT_REVOCATION",
      ]);

      const { error } = await (supabase as any)
        .from("dao_hats")
        .update({
          revoked_at: new Date().toISOString(),
          eligibility_status: "revoked",
          revocation_aca_hash: hash,
          revocation_aca_payload: payload,
        })
        .eq("user_id", user.id)
        .eq("hat_type", committee.id)
        .eq("eligibility_status", "active")
        .is("revoked_at", null);

      if (error && (error.message?.includes("revocation_aca_hash") || error.message?.includes("column"))) {
        const retry = await (supabase as any)
          .from("dao_hats")
          .update({ revoked_at: new Date().toISOString(), eligibility_status: "revoked" })
          .eq("user_id", user.id)
          .eq("hat_type", committee.id)
          .eq("eligibility_status", "active")
          .is("revoked_at", null);
        if (retry.error) throw retry.error;
      } else if (error) {
        throw error;
      }

      toast({
        title: "Membership Revoked",
        description: `You have stepped down from ${committee.name}. ACA ${hash.substring(0, 8)}…`,
      });
      setResignTarget(null);
      fetchLedgerState();
    } catch (error: any) {
      console.error(`[COMMITTEE_RESIGN] CRITICAL_FAILURE: ${error.message}`);
      toast({ title: "Resignation Failed", description: error.message, variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  if (isLoadingLedger) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  const ascensionLevel = getAscensionLevel(userActiveHats);

  return (
    <div className="space-y-4">
      <div className="px-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Scale size={14} className="text-teal-600" />
          Delaware Registry ·{" "}
          {ascensionLevel === 3
            ? "Stewardship Matrix"
            : ascensionLevel === 2
              ? "Oversight Matrix"
              : "Level 1 Ascension"}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {ascensionLevel === 3
            ? "Select a committee to execute a Tophat Override and provision an active hat instantly."
            : "Select a committee to submit your Statement of Competence and bond your identity to the protocol's fiduciary oversight matrix."}
        </p>
      </div>

      <div className="grid gap-4">
        {COMMITTEES_META.map((committee) => {
          const Icon = committee.icon;
          const activeMembers = officerCounts[committee.id] || 0;
          const app = userApplications[committee.id];

          // L3 Protocol Stewards (tophat) have universal authority over every committee.
          const isActiveMember = userActiveHats.has(committee.id) || ascensionLevel === 3;
          const pendingVetoEnd = userPendingHats[committee.id];
          const isProvisionedPendingVeto = !!pendingVetoEnd && !isActiveMember;
          const isPending = !!app && app.status === "pending" && !isProvisionedPendingVeto;
          const busy = actionBusyId === committee.id;

          // Compute the dynamic pathway text
          const pathwayText =
            ascensionLevel === 3
              ? `Tophat Override to the ${committee.hatName}`
              : ascensionLevel === 2
                ? `Oversight of the ${committee.hatName}`
                : `Level 1 pathway to the ${committee.hatName}`;

          return (
            <Card
              key={committee.id}
              className="overflow-hidden border-teal-100 dark:bg-card dark:border-teal-900/40 shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-teal-50 dark:bg-teal-950/40 rounded-xl">
                      <Icon className="w-6 h-6 text-teal-700 dark:text-teal-300" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-foreground">{committee.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-none max-w-sm">
                        {committee.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 dark:text-orange-300 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
                          {activeMembers} Active Officer{activeMembers === 1 ? "" : "s"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">{pathwayText}</span>
                        {ascensionLevel === 3 && (
                          <button
                            type="button"
                            onClick={() => setRosterTarget(committee)}
                            className="text-[10px] font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-900/50 px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                          >
                            <Users className="w-3 h-3" /> View Roster
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
                    {isActiveMember ? (
                      <>
                        <div
                          className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border ${LEVEL_BADGE_CLASS[ascensionLevel || 1]}`}
                        >
                          <ShieldCheck className="w-3 h-3" /> {LEVEL_LABEL[ascensionLevel || 1]}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setResignTarget(committee)}
                          className="w-full sm:w-auto border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-800"
                        >
                          {busy ? (
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          ) : (
                            <LogOut className="w-3 h-3 mr-1.5" />
                          )}
                          Remove Membership
                        </Button>
                      </>
                    ) : isProvisionedPendingVeto ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/30 px-2.5 py-1 rounded-full border border-purple-200 dark:border-purple-900/50">
                          <ShieldCheck className="w-3 h-3" /> Provisioned · Veto Window
                        </div>
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Activates {new Date(pendingVetoEnd!).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </>
                    ) : isPending ? (
                      <>
                        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-full border border-amber-200 dark:border-amber-900/50">
                          <Clock className="w-3 h-3" /> Pending Audit
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() => setRevokeTarget(committee)}
                          className="w-full sm:w-auto border-orange-200 dark:border-orange-900/50 text-orange-700 dark:text-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950/30 hover:text-orange-800"
                        >
                          {busy ? (
                            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3 mr-1.5" />
                          )}
                          Revoke Request
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 hover:bg-teal-50 dark:hover:bg-teal-950/40"
                        onClick={() => handleApplyClick(committee)}
                      >
                        Apply to Join <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Apply dialog */}
      <Dialog open={!!selectedCommittee} onOpenChange={(open) => !open && setSelectedCommittee(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-orange-500" />
              Committee Ascension
            </DialogTitle>
            <DialogDescription>
              Applying to the <strong className="text-foreground">{selectedCommittee?.name}</strong>. This action
              legally binds your identity to the Delaware MSA registry.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            <div className="space-y-3">
              <Label htmlFor="competence" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Statement of Competence
              </Label>
              <Textarea
                id="competence"
                placeholder="Detail your professional experience and operational readiness for this specific domain..."
                className="min-h-[120px] resize-none text-sm bg-background text-foreground border-input placeholder:text-muted-foreground"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-[10px] text-right text-muted-foreground">{statement.length} / 50 min chars</p>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-slate-50 dark:bg-muted/30 rounded-lg border border-slate-100 dark:border-border">
              <Checkbox
                id="msa"
                checked={msaAcknowledged}
                onCheckedChange={(c) => setMsaAcknowledged(c as boolean)}
                disabled={isProcessing}
                className="mt-1"
              />
              <div className="space-y-1">
                <Label htmlFor="msa" className="text-xs font-bold leading-none cursor-pointer">
                  Fiduciary Bonding Acknowledgment
                </Label>
                <p className="text-[10px] text-muted-foreground leading-relaxed">
                  By checking this box, I acknowledge the MSA Compliance Card. I legally bind my biological identity to
                  the fiduciary and regulatory responsibilities of the Delaware jurisdiction.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setSelectedCommittee(null)} disabled={isProcessing}>
              Cancel
            </Button>
            <Button
              className="bg-teal-700 hover:bg-teal-800 text-white shadow-lg shadow-teal-900/20"
              onClick={handleSubmission}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke pending request dialog */}
      <Dialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-orange-500" />
              Revoke Pending Request
            </DialogTitle>
            <DialogDescription>
              Withdraw your pending application to <strong className="text-foreground">{revokeTarget?.name}</strong>.
              Your fiduciary bond will be released and you may re-apply later.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setRevokeTarget(null)} disabled={actionBusyId === revokeTarget?.id}>
              Cancel
            </Button>
            <Button
              className="bg-orange-600 hover:bg-orange-700 text-white"
              onClick={() => revokeTarget && handleRevokeRequest(revokeTarget)}
              disabled={actionBusyId === revokeTarget?.id}
            >
              {actionBusyId === revokeTarget?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Releasing…
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Withdraw
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove membership dialog */}
      <Dialog open={!!resignTarget} onOpenChange={(open) => !open && setResignTarget(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <LogOut className="w-5 h-5 text-red-500" />
              Remove Committee Membership
            </DialogTitle>
            <DialogDescription>
              You are stepping down from <strong className="text-foreground">{resignTarget?.name}</strong>. Your officer
              hat will be revoked on-ledger and you will lose committee voting rights. This action is recorded
              immutably.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="ghost" onClick={() => setResignTarget(null)} disabled={actionBusyId === resignTarget?.id}>
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => resignTarget && handleRemoveMembership(resignTarget)}
              disabled={actionBusyId === resignTarget?.id}
            >
              {actionBusyId === resignTarget?.id ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Resigning Hat…
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  Resign
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <CommitteeRosterModal
        committee={rosterTarget}
        callerId={callerId}
        open={!!rosterTarget}
        onOpenChange={(o) => !o && setRosterTarget(null)}
        onChanged={fetchLedgerState}
      />
    </div>
  );
};

export default CommitteesList;
