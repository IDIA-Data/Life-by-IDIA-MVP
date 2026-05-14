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
import { ShieldAlert, Code, Scale, HeartHandshake, ChevronRight, Fingerprint, Loader2, Clock } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { isNative } from "@/services/platform";

// We keep the structural UI metadata static, but all metrics are hydrated live.
const COMMITTEES_META = [
  {
    id: "legal_defense",
    name: "Legal Defense & Jurisdiction",
    icon: Scale,
    description: "Fiduciary oversight of the Delaware MSA. Manages corporate defense funds and regulatory compliance.",
    pathway: "Level 1 pathway to the ⚖️ Legal Defense Hat",
  },
  {
    id: "sociorelational",
    name: "Sociorelational Impact (DCGP)",
    icon: HeartHandshake,
    description: "Manages the Virtuous Cycle. Oversees distribution of the 1% and 10% data yield to community grants.",
    pathway: "Level 1 pathway to the 🤝 Sociorelational Hat",
  },
  {
    id: "security_council", // Aligned ID with dao_hats enum
    name: "Security Council Auxiliary",
    icon: ShieldAlert,
    description: "Audits smart contracts, monitors for Sybil attacks, and reviews system threat telemetries.",
    pathway: "Level 1 pathway to the 🛡️ Security Council Hat",
  },
  {
    id: "product_xr",
    name: "Product & XR Architecture",
    icon: Code,
    description: "Enforces the 'Glossy/Glass' aesthetic and reviews spatial computing manifestations.",
    pathway: "Level 1 pathway to the 💻 Product/XR Hat",
  },
];

const CommitteesList: React.FC = () => {
  const [selectedCommittee, setSelectedCommittee] = useState<(typeof COMMITTEES_META)[0] | null>(null);
  const [statement, setStatement] = useState("");
  const [msaAcknowledged, setMsaAcknowledged] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Live Ledger States
  const [officerCounts, setOfficerCounts] = useState<Record<string, number>>({});
  const [userApplications, setUserApplications] = useState<string[]>([]);
  const [isLoadingLedger, setIsLoadingLedger] = useState(true);

  const fetchLedgerState = async () => {
    console.log("[COMMITTEES_LIST] START: Hydrating live registry metrics.");
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 1. Fetch live active officer counts from the Hats wardrobe ledger
      const { data: hatsData, error: hatsError } = await (supabase as any)
        .from("dao_hats")
        .select("hat_type")
        .eq("eligibility_status", "active")
        .is("revoked_at", null);

      if (hatsError) throw hatsError;

      const counts: Record<string, number> = {};
      hatsData?.forEach((hat: any) => {
        counts[hat.hat_type] = (counts[hat.hat_type] || 0) + 1;
      });
      setOfficerCounts(counts);

      // 2. Fetch current user's pending applications to prevent duplicate submissions
      if (user) {
        const { data: appsData, error: appsError } = await (supabase as any)
          .from("committee_applications")
          .select("committee_id")
          .eq("user_id", user.id);

        if (appsError) throw appsError;
        if (appsData) setUserApplications(appsData.map((a: any) => a.committee_id));
      }

      console.log("[COMMITTEES_LIST] SUCCESS: Registry metrics synced.");
    } catch (error: any) {
      console.error("[COMMITTEES_LIST] CRITICAL_FAILURE: Matrix sync failed:", error.message);
    } finally {
      setIsLoadingLedger(false);
    }
  };

  useEffect(() => {
    fetchLedgerState();
  }, []);

  const handleApplyClick = (committee: (typeof COMMITTEES_META)[0]) => {
    console.log(`[UI_INTERACTION] START: User selected ${committee.name} for application.`);
    setSelectedCommittee(committee);
    setStatement("");
    setMsaAcknowledged(false);
  };

  const handleSubmission = async () => {
    console.log(`[COMMITTEE_APPLICATION] START: Initializing Level 1 Ascension sequence for ${selectedCommittee?.id}.`);
    if (!isNative()) {
      toast({
        title: "Native Device Required",
        description: "Committee bonding requires Secure Enclave attestation. Please use the iOS or Android app.",
        variant: "destructive",
      });
      return;
    }
    setIsProcessing(true);

    try {
      console.log(`[COMMITTEE_APPLICATION] VERIFY: Auditing Statement of Competence payload.`);
      if (statement.trim().length < 50) {
        const err = new Error(
          "Statement of Competence failed validation: Insufficient length. Minimum 50 characters required.",
        );
        console.error(`[COMMITTEE_APPLICATION] VALIDATION_ERROR: ${err.message}`);
        toast({
          title: "Validation Failed",
          description: "Your Statement of Competence must be at least 50 characters.",
          variant: "destructive",
        });
        throw err;
      }

      console.log(`[COMMITTEE_APPLICATION] VERIFY: Checking Delaware MSA Fiduciary Bonding acknowledgment.`);
      if (!msaAcknowledged) {
        const err = new Error("Fiduciary bonding refused. User must acknowledge MSA liability.");
        console.error(`[COMMITTEE_APPLICATION] VALIDATION_ERROR: ${err.message}`);
        toast({
          title: "Bonding Required",
          description: "You must legally bind your identity to the MSA to proceed.",
          variant: "destructive",
        });
        throw err;
      }

      console.log(`[COMMITTEE_APPLICATION] AUTH: Retrieving local sovereign identity.`);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Authentication failure prior to ACA generation.");
      }

      console.log(`[COMMITTEE_APPLICATION] ACA_ANCHOR_START: Requesting hardware-backed biological anchor...`);
      const { hash, payload } = await generateACAHash(user.id, `committee_join_${selectedCommittee?.id}`, [
        "DELAWARE_MSA_BONDING",
        "LEDGER_WRITE",
      ]);
      console.log(
        `[COMMITTEE_APPLICATION] ACA_ANCHOR_END: Biological presence verified. SHA-256 Hash Generated: ${hash}`,
      );

      console.log(`[COMMITTEE_APPLICATION] NETWORK_START: Transmitting secure payload to Delaware MSA Registry.`);
      // Fixed: Cast the entire supabase object to any to bypass inference
      const { error: ledgerError } = await (supabase as any).from("committee_applications").insert({
        user_id: user.id,
        committee_id: selectedCommittee?.id,
        statement_of_competence: statement,
        aca_hash_key: hash,
        aca_payload: payload,
        status: "pending",
      });

      if (ledgerError) throw ledgerError;
      console.log(`[COMMITTEE_APPLICATION] NETWORK_END: Ledger entry committed.`);

      toast({
        title: "Application Committed",
        description: `Identity anchored to ${selectedCommittee?.name} with ACA Hash: ${hash.substring(0, 8)}...`,
      });

      // Refresh UI state
      fetchLedgerState();
      setSelectedCommittee(null);
    } catch (error: any) {
      // Redundant toast removed here to prevent double-notifications.
      // The terminal log maintains the engineering audit trail.
      console.error(`[COMMITTEE_APPLICATION] CRITICAL_FAILURE: Ascension sequence halted. Reason: ${error.message}`);
    } finally {
      setIsProcessing(false);
      console.log(`[COMMITTEE_APPLICATION] END: Execution thread terminated.`);
    }
  };

  if (isLoadingLedger) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <Scale size={14} className="text-teal-600" /> Delaware Registry · Level 1 Ascension
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Select a committee to submit your Statement of Competence and bond your identity to the protocol's fiduciary
          oversight matrix.
        </p>
      </div>

      <div className="grid gap-4">
        {COMMITTEES_META.map((committee) => {
          const Icon = committee.icon;
          // Dynamically map active members. Defaults to 0 if none exist yet.
          const activeMembers = officerCounts[committee.id] || 0;
          const hasApplied = userApplications.includes(committee.id);

          return (
            <Card
              key={committee.id}
              className="overflow-hidden border-teal-100 shadow-sm transition-all hover:shadow-md"
            >
              <CardContent className="p-0">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 gap-4">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-teal-50 rounded-xl">
                      <Icon className="w-6 h-6 text-teal-700" />
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-sm text-foreground">{committee.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-2 sm:line-clamp-none max-w-sm">
                        {committee.description}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-50 px-2 py-0.5 rounded-full">
                          {activeMembers} Active Officer{activeMembers === 1 ? "" : "s"}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-medium">{committee.pathway}</span>
                      </div>
                    </div>
                  </div>

                  {hasApplied ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      className="w-full sm:w-auto border-amber-200 text-amber-700 bg-amber-50/50"
                    >
                      <Clock className="w-3 h-3 mr-1.5" />
                      Pending Audit
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full sm:w-auto border-teal-200 text-teal-800 hover:bg-teal-50"
                      onClick={() => handleApplyClick(committee)}
                    >
                      Apply to Join <ChevronRight className="w-4 h-4 ml-1 opacity-50" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

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
                className="min-h-[120px] resize-none text-sm"
                value={statement}
                onChange={(e) => setStatement(e.target.value)}
                disabled={isProcessing}
              />
              <p className="text-[10px] text-right text-muted-foreground">{statement.length} / 50 min chars</p>
            </div>

            <div className="flex items-start space-x-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
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
                  Generating ACA Hash...
                </>
              ) : (
                <>
                  <Fingerprint className="mr-2 h-4 w-4" />
                  ACA Handshake & Submit
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CommitteesList;