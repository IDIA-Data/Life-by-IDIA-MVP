import React, { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { Button } from "@/components/ui/button";
import { Download, ScrollText } from "lucide-react";
import { toast } from "sonner";

const MANUAL_PDF_URL = "/legal/IDIA_Data_DUNA_Welcome_Manual.pdf";
const MANUAL_VERSION = "v1";

interface WelcomeManualGateProps {
  userId: string;
  onAcknowledged: () => void;
}

const WelcomeManualGate: React.FC<WelcomeManualGateProps> = ({ userId, onAcknowledged }) => {
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollTop + clientHeight >= scrollHeight - 24 && !hasScrolledToBottom) {
      console.log("[DUNA_WELCOME] Bottom reached: Acknowledgement enabled.");
      setHasScrolledToBottom(true);
    }
  };

  const handleAcknowledge = async () => {
    setIsLoading(true);
    console.log("[DUNA_WELCOME] START: Capturing manual review acknowledgement.");
    try {
      const { payload } = await generateACAHash(userId, "DUNA_WELCOME_V1", [
        "MANUAL_REVIEW",
        "GOVERNANCE_ONBOARDING",
      ]);
      console.log("[DUNA_WELCOME] ACA Hash Generated.");

      const { error: deviceError } = await (supabase as any).from("device_events").insert({
        user_id: userId,
        event_type: "duna_welcome_ack",
        json_payload: {
          surface: "governance",
          feature: "welcome_manual",
          document: "IDIA_Data_DUNA_Welcome_Manual",
          version: MANUAL_VERSION,
          acknowledgement: "I_UNDERSTAND",
          aca: payload,
        },
      });
      if (deviceError) throw deviceError;

      const { error: acaError } = await (supabase as any).from("user_aca_records").insert({
        platform_guid: userId,
        consent_type: "DUNA_WELCOME_V1",
        aca_hash_key: payload.aca_hash_key,
      });
      if (acaError) throw acaError;

      const { error: authError } = await supabase.auth.updateUser({
        data: {
          duna_welcome_ack_at: new Date().toISOString(),
          duna_welcome_version: MANUAL_VERSION,
        },
      });
      if (authError) throw authError;

      console.log("[DUNA_WELCOME] SUCCESS: Sovereign acknowledgement ledgered.");
      toast.success("Welcome Manual Acknowledged");
      onAcknowledged();
    } catch (error: any) {
      console.error(`[DUNA_WELCOME] STALL: ${error.message}`);
      toast.error("Could not capture acknowledgement. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-xl flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-2xl h-full max-h-[90vh] flex flex-col rounded-[2rem] border border-border bg-card shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-border bg-gradient-to-br from-[hsl(178,42%,32%)]/10 to-transparent flex items-center gap-3">
          <div className="p-2 bg-[hsl(178,42%,32%)]/10 rounded-lg">
            <ScrollText className="w-6 h-6 text-[hsl(178,42%,32%)]" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">IDIA Data DUNA — Welcome Manual</h1>
            <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
              Scroll to the bottom to acknowledge
            </p>
          </div>
        </div>

        <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto bg-muted/20">
          <div className="flex flex-col items-center gap-4 py-4 px-3 bg-muted/20">
            {Array.from({ length: 11 }, (_, i) => {
              const n = String(i + 1).padStart(2, "0");
              return (
                <img
                  key={n}
                  src={`/legal/duna-manual-pages/page-${n}.jpg`}
                  alt={`IDIA Data DUNA Welcome Manual — Page ${i + 1}`}
                  loading={i < 2 ? "eager" : "lazy"}
                  className="w-full max-w-[760px] rounded-md shadow-md border border-border bg-white"
                />
              );
            })}
          </div>
          <div className="px-6 py-4 text-center bg-white border-t border-border">
            <p className="text-xs text-muted-foreground mb-2">
              PDF not rendering? Open it directly:
            </p>
            <a
              href={MANUAL_PDF_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[hsl(178,42%,32%)] underline text-sm font-semibold"
            >
              Open Welcome Manual in new tab
            </a>
          </div>
          <div className="h-8" />
        </div>

        <div className="p-6 border-t border-border bg-background/60 flex flex-col items-center gap-3">
          <Button
            onClick={handleAcknowledge}
            disabled={!hasScrolledToBottom || isLoading}
            className="w-full max-w-sm h-12 text-base font-semibold bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,38%)] text-white transition-all duration-300 disabled:opacity-30"
          >
            {isLoading ? "Sealing Acknowledgement..." : "I Understand"}
          </Button>
          <a
            href={MANUAL_PDF_URL}
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

export default WelcomeManualGate;
