import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { Button } from "@/components/ui/button";
import { Shield, ScrollText } from "lucide-react";
import { toast } from "sonner";

type Decision = "accepted" | "declined" | null;

const AuthorityOfRecord = () => {
  const [decision, setDecision] = useState<Decision>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleContinue = async () => {
    if (!decision) return;
    setIsLoading(true);
    console.log("[AOR_FLOW] START: Processing Authority of Record decision:", decision);

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Identity verification failed.");
      console.log(`[AOR_FLOW] Identity Confirmed: ${user.id}`);

      const scopes = [
        "AOR_AUTHORIZATION",
        decision === "accepted" ? "POA_GRANTED" : "POA_DECLINED",
      ];
      const { payload } = await generateACAHash(user.id, "AUTHORITY_OF_RECORD_V1", scopes);
      console.log("[AOR_FLOW] ACA Hash Generated.");

      const { error: registryError } = await (supabase as any)
        .from("consent_registry")
        .insert({
          user_id: user.id,
          consent_type: "AUTHORITY_OF_RECORD_V1",
          decision,
          document_version: "v1",
          aca_hash_key: payload.aca_hash_key,
          payload,
        });
      if (registryError) throw registryError;
      console.log("[AOR_FLOW] Consent Registry Recorded.");

      const { error: acaError } = await (supabase as any).from("user_aca_records").insert({
        platform_guid: user.id,
        consent_type: "AUTHORITY_OF_RECORD_V1",
        aca_hash_key: payload.aca_hash_key,
      });
      if (acaError) throw acaError;

      const { error: deviceError } = await (supabase as any).from("device_events").insert({
        user_id: user.id,
        event_type: "aor_consent_ack",
        json_payload: {
          surface: "onboarding",
          feature: "authority_of_record",
          version: "v1",
          decision,
          aca: payload,
        },
      });
      if (deviceError) throw deviceError;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          aor_decision: decision,
          aor_decided_at: new Date().toISOString(),
          aor_version: "v1",
        },
      });
      if (authError) throw authError;
      console.log("[AOR_FLOW] Auth Metadata Updated.");

      toast.success(
        decision === "accepted"
          ? "Authority of Record authorization recorded"
          : "Decision recorded — protection declined",
      );
      navigate("/");
    } catch (error: any) {
      console.error(`[AOR_FLOW] CRITICAL STALL: ${error.message}`);
      toast.error("Consent capture failed. Please try again.");
    } finally {
      setIsLoading(false);
      console.log("[AOR_FLOW] END: Flow attempt finalized.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-2xl h-full max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Authority of Record Authorization</h1>
            <p className="text-xs text-muted-foreground">Elective protection — biometric confirmation required.</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="rounded-xl border border-border/60 bg-muted/20 p-5 space-y-4">
            <p className="text-sm leading-relaxed text-foreground">
              To protect your digital identity from unauthorized surveillance, you have the option to appoint{" "}
              <strong>IDIA Data Inc.</strong> as your <strong>Authority of Record</strong>.
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">
              By clicking <strong>Authorize</strong>, you are granting IDIA limited Power of Attorney to manage
              your digital identity assets and initiate legal claims on your behalf against entities that
              misappropriate them. This is an <em>elective</em> protection to ensure you are represented in the
              fight against mass surveillance.
            </p>
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() => setDecision("accepted")}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                decision === "accepted"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    decision === "accepted" ? "border-primary" : "border-muted-foreground"
                  }`}
                >
                  {decision === "accepted" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    I Authorize IDIA Data Inc. as my Authority of Record.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Grants limited POA for identity-asset defense.
                  </p>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDecision("declined")}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                decision === "declined"
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/40 bg-card"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                    decision === "declined" ? "border-primary" : "border-muted-foreground"
                  }`}
                >
                  {decision === "declined" && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                </div>
                <div>
                  <p className="text-sm font-semibold">I decline this protection.</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    No POA granted. You may revisit this later.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-border bg-background/60 flex flex-col items-center gap-3">
          <Button
            onClick={handleContinue}
            disabled={!decision || isLoading}
            className="w-full max-w-sm h-12 text-base font-semibold transition-all duration-300 disabled:opacity-30"
          >
            {isLoading ? "Capturing Consent..." : "Continue"}
          </Button>
          <p className="flex items-center gap-2 text-[11px] text-muted-foreground uppercase tracking-widest">
            <ScrollText size={14} />
            Anchored to your Identity Ledger
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthorityOfRecord;
