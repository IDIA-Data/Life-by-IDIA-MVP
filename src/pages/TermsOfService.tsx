import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { Button } from "@/components/ui/button";
import { Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const TOS_PDF_URL = "/legal/IDIA_Protocol_Terms_of_Service.pdf";

const TermsOfService = () => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 20 && !hasScrolledToBottom) {
      console.log("[TOS_UI] Bottom reached: Acceptance button enabled.");
      setHasScrolledToBottom(true);
    }
  };

  const handleAcceptance = async () => {
    setIsLoading(true);
    console.log("[TOS_FLOW] START: Processing biometric-linked consent.");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();
      if (userError || !user) throw new Error("Identity verification failed.");
      console.log(`[TOS_FLOW] Identity Confirmed: ${user.id}`);

      const { payload } = await generateACAHash(user.id, "TERMS_OF_SERVICE_V1", [
        "TOS_ACCEPTANCE",
        "LEGAL_BINDING",
      ]);
      console.log("[TOS_FLOW] ACA Hash Generated.");

      const { error: deviceError } = await (supabase as any).from("device_events").insert({
        user_id: user.id,
        event_type: "tos_acceptance_ack",
        json_payload: {
          surface: "onboarding",
          feature: "terms_of_service",
          document: "IDIA_Protocol_Terms_of_Service",
          version: "v1",
          acknowledgement: "I_ACCEPT",
          aca: payload,
        },
      });
      if (deviceError) throw deviceError;
      console.log("[TOS_FLOW] Device Event Logged.");

      const { error: acaError } = await (supabase as any).from("user_aca_records").insert({
        platform_guid: user.id,
        consent_type: "TOS_ACCEPTANCE_V1",
        aca_hash_key: payload.aca_hash_key,
      });
      if (acaError) throw acaError;
      console.log("[TOS_FLOW] ACA Record Mirrored.");

      const { error: authError } = await supabase.auth.updateUser({
        data: { tos_accepted_at: new Date().toISOString(), tos_version: "v1" },
      });
      if (authError) throw authError;
      console.log("[TOS_FLOW] Auth Metadata Updated.");

      toast.success("Identity Ledger Updated: ToS Accepted");
      navigate("/");
    } catch (error: any) {
      console.error(`[TOS_FLOW] CRITICAL STALL: ${error.message}`);
      toast.error("Compliance capture failed. System entry denied.");
    } finally {
      setIsLoading(false);
      console.log("[TOS_FLOW] END: Flow attempt finalized.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-2xl h-full max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ShieldCheck className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">IDIA Protocol — Terms of Service</h1>
            <p className="text-xs text-muted-foreground">Scroll to the bottom to enable acceptance.</p>
          </div>
        </div>

        {/* Scrollable Document View */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-muted/20"
        >
          <object
            data={`${TOS_PDF_URL}#toolbar=0&navpanes=0`}
            type="application/pdf"
            className="w-full h-[1400px] block"
            aria-label="IDIA Protocol Terms of Service"
          >
            <iframe
              src={TOS_PDF_URL}
              title="IDIA Protocol Terms of Service"
              className="w-full h-[1400px] border-0"
            />
          </object>
          {/* Sentinel padding to ensure scroll-to-bottom can fire after PDF area */}
          <div className="h-8" />
        </div>

        {/* Action Footer */}
        <div className="p-6 border-t border-border bg-background/60 flex flex-col items-center gap-3">
          <Button
            onClick={handleAcceptance}
            disabled={!hasScrolledToBottom || isLoading}
            className="w-full max-w-sm h-12 text-base font-semibold transition-all duration-300 disabled:opacity-30"
          >
            {isLoading ? "Capturing Consent..." : "I Accept"}
          </Button>

          <a
            href={TOS_PDF_URL}
            download
            className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors uppercase tracking-widest"
          >
            <Download size={14} />
            Download PDF Copy
          </a>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
