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
import { Loader2, Gavel } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";
import { toast } from "@/hooks/use-toast";

interface RecallPetitionDialogProps {
  targetHatId: string;
  targetUserId: string;
  hatLabel: string;
  open: boolean;
  onClose: () => void;
  onOpened?: () => void;
}

const RecallPetitionDialog: React.FC<RecallPetitionDialogProps> = ({
  targetHatId, targetUserId, hatLabel, open, onClose, onOpened,
}) => {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (reason.trim().length < 20) {
      toast({ title: "Reason too short", description: "Provide at least 20 characters.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { hash, payload } = await generateACAHash(user.id, `recall_open_${targetHatId}`, [
        "HAT_RECALL_OPEN", "PEER_ACCOUNTABILITY",
      ]);
      const { data, error } = await supabase.functions.invoke("hat-recall-execute", {
        body: { target_hat_id: targetHatId, reason: reason.trim(), aca_hash: hash, aca_payload: payload },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: "Recall petition opened", description: `ACA ${hash.substring(0, 8)}…` });
      setReason("");
      onOpened?.();
      onClose();
    } catch (e: any) {
      toast({ title: "Petition failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !v && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Gavel className="w-5 h-5 text-rose-600" /> Open Recall Petition
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-1">
            <span className="block">Target hat: <strong>{hatLabel}</strong></span>
            <span className="block font-mono text-[10px] break-all">{targetUserId}</span>
            <span className="block">Once 3 fellow officers co-sign, the hat is automatically revoked.</span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason for recall (≥20 chars, will be permanently anchored)"
          className="text-xs min-h-[100px] rounded-2xl"
          disabled={busy}
        />
        <AlertDialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white">
            {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Open Petition
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default RecallPetitionDialog;
