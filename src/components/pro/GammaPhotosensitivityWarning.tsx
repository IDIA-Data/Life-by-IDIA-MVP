import { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { toast } from "@/hooks/use-toast";

interface GammaPhotosensitivityWarningProps {
  open: boolean;
  onCancel: () => void;
  onAcknowledge: () => void;
  surface: "CPMDashboard" | "PureAlphaDashboard";
}

export const GammaPhotosensitivityWarning = ({
  open,
  onCancel,
  onAcknowledge,
  surface,
}: GammaPhotosensitivityWarningProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    console.log(`[GammaConsent:START] Initiating ACA anchoring for surface: ${surface}`);
    setIsProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No authenticated user — cannot anchor consent.");

      console.log("[GammaConsent:ACA] Generating cryptographic hash...");
      const { payload: acaPayload } = await generateACAHash(
        user.id,
        "GAMMA_40HZ_ENTRAINMENT",
        ["PHOTOSENSITIVITY_ACK", "GAMMA_ENTRAINMENT_RUN"]
      );
      console.log("[GammaConsent:ACA] Hash generated:", acaPayload.aca_hash_key);

      console.log("[GammaConsent:DB] Inserting event into public.device_events...");
      const { error } = await supabase.from("device_events").insert({
        user_id: user.id,
        event_type: "gamma_40hz_consent_ack",
        data_category: "ai_interaction",
        json_payload: {
          surface,
          feature: "GAMMA_40HZ_ENTRAINMENT",
          frequency_hz: 40,
          acknowledgement: "I_UNDERSTAND",
          aca: acaPayload,
        },
      });

      if (error) throw error;

      console.log("[GammaConsent:DB] Event successfully anchored.");
      console.log("[GammaConsent:END] Flow complete. Proceeding to sequence.");
      onAcknowledge();
    } catch (err: any) {
      console.error(`[GammaConsent:ERROR] Critical failure in consent flow:`, err);
      toast({
        variant: "destructive",
        title: "System Error",
        description: "Failed to anchor consent. Gamma sequence aborted for safety.",
      });
      onCancel();
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !isProcessing) onCancel(); }}>
      <AlertDialogContent className="bg-white/95 backdrop-blur-xl border border-amber-200 shadow-2xl max-w-md">
        <AlertDialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-50 border-2 border-amber-400 flex items-center justify-center mb-2">
            <AlertTriangle className="w-6 h-6 text-amber-600" />
          </div>
          <AlertDialogTitle className="text-center text-slate-900 font-black uppercase tracking-wider text-sm">
            Photosensitivity Warning
          </AlertDialogTitle>
          <AlertDialogDescription className="text-slate-700 text-xs leading-relaxed space-y-2 pt-2">
            <p>
              The 40Hz Gamma Entrainment uses high-frequency flashing light and audio.
              This <strong className="text-amber-700">may trigger seizures</strong> in
              individuals with photosensitive epilepsy.
            </p>
            <p>
              Do not use if you or any family member has a history of seizures.
              Do not use while driving or operating machinery. A stationary, dimly
              lit environment is recommended. Discontinue immediately if you feel
              dizziness, nausea, or visual discomfort.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isProcessing}
            className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700 text-white font-black uppercase tracking-wider"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Anchoring...
              </>
            ) : (
              "I Understand"
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default GammaPhotosensitivityWarning;
