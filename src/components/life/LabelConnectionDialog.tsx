import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { localPIIVault } from "@/lib/localPIIVault";
import { toast } from "@/components/ui/sonner";

interface LabelConnectionDialogProps {
  connectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
}

const LabelConnectionDialog: React.FC<LabelConnectionDialogProps> = ({
  connectionId,
  open,
  onOpenChange,
  onSaved,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);

  // Pre-load existing label when the dialog opens
  useEffect(() => {
    if (!open || !connectionId) return;
    let cancelled = false;
    (async () => {
      const existing = await localPIIVault.lookup(connectionId);
      if (cancelled) return;
      setFirstName(existing?.first_name ?? "");
      setLastName(existing?.last_name ?? "");
      setNickname(existing?.nickname ?? "");
    })();
    return () => {
      cancelled = true;
    };
  }, [open, connectionId]);

  const handleSave = async () => {
    if (!connectionId) return;
    setSaving(true);
    try {
      await localPIIVault.save({
        connection_id: connectionId,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
        nickname: nickname.trim() || undefined,
      });
      toast.success("Saved on this phone only", {
        description: "Your name for this Connection stays on your device.",
      });
      onSaved?.();
      onOpenChange(false);
    } catch {
      toast("Could not save the name", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-foreground">Name this new Connection</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-snug">
            This name is saved only on your phone. It is not sent to the cloud and no one
            else can see it.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="nickname" className="text-xs text-foreground">
              Nickname
            </Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="What you call them"
              className="border-teal-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="first" className="text-xs text-foreground">
                First name
              </Label>
              <Input
                id="first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First"
                className="border-teal-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last" className="text-xs text-foreground">
                Last name
              </Label>
              <Input
                id="last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last"
                className="border-teal-100"
              />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            className="border-teal-200 text-teal-700"
          >
            Skip for now
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || (!firstName.trim() && !lastName.trim() && !nickname.trim())}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {saving ? "Saving…" : "Save on this phone"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LabelConnectionDialog;
