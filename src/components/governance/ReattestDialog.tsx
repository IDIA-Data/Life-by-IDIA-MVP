import React, { useState } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { toast } from "@/hooks/use-toast";

interface ReattestDialogProps {
  hatId: string;
  hatLabel: string;
  isGrayed: boolean;
  open: boolean;
  onClose: () => void;
  onReattested?: () => void;
}

const ReattestDialog: React.FC<ReattestDialogProps> = ({
  hatId, hatLabel, isGrayed, open, onClose, onReattested,
}) => {
  const [statement, setStatement] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (statement.trim().length < 50) {
      toast({ title: "Statement too short", description: "Provide at least 50 characters.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { hash, payload } = await generateACAHash(user.id, `hat_reattest_${hatId}`, [
        "HAT_REATTEST", "OFFICER_CONTINUITY",
      ]);
      const { data, error } = await supabase.functions.invoke("hat-reattest", {
        body: { hat_id: hatId, statement: statement.trim(), aca_hash: hash, aca_payload: payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({
        title: isGrayed ? "Authority restored" : "Re-attested",
        description: `ACA ${hash.substring(0, 8)}…`,
      });
      setStatement("");
      onReattested?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Re-attestation failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" /> Re-Attest Authority
          </AlertDialogTitle>
          <AlertDialogDescription>
            Confirm continued service for <strong>{hatLabel}</strong>. Your statement is permanently anchored to the ledger and resets the renewal clock.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="Statement of continued service (≥50 chars)"
          className="text-xs min-h-[120px] rounded-2xl"
          disabled={busy}
        />
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-teal-600 hover:bg-teal-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Re-Attest
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default ReattestDialog;
