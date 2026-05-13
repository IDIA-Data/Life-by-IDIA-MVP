import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useWallet } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Download, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const RecoveryPhrase = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const viewMode = params.get("mode") === "view";
  const { getSeedPhrase, wallet } = useWallet();
  const { toast } = useToast();

  const [phrase, setPhrase] = useState<string>("");
  const [revealed, setRevealed] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("[START: Backup Generation]");
    (async () => {
      try {
        const p = await getSeedPhrase();
        if (!p) {
          console.error("[ERROR] Recovery: No seed phrase available");
          toast({ title: "No vault found", description: "Returning to dashboard.", variant: "destructive" });
          navigate("/", { replace: true });
          return;
        }
        setPhrase(p);
        console.log("[PROCESS] Recovery: Seed phrase loaded");
      } catch (e: any) {
        console.error("[ERROR] Recovery: Load failed", e);
        toast({ title: "Failed to load phrase", description: e.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();
  }, [getSeedPhrase, navigate, toast]);

  const handleDownload = () => {
    console.log("[PROCESS] Recovery: Download triggered");
    const content =
      `IDIA Sovereign Vault — Recovery Key\n` +
      `Address: ${wallet?.address || "(pending)"}\n` +
      `Created: ${new Date().toISOString()}\n\n` +
      `Mnemonic: ${phrase}\n\n` +
      `WARNING: Anyone with this phrase controls your vault. Store offline.\n`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `idia-recovery-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloaded(true);
    toast({ title: "Recovery key saved", description: "Store this file in a secure location." });
  };

  const handleComplete = () => {
    console.log("[END: Backup Generation]");
    if (viewMode) navigate("/settings", { replace: true });
    else navigate("/onboarding", { replace: true });
  };

  const words = phrase ? phrase.trim().split(/\s+/) : [];
  const canProceed = downloaded || acknowledged;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-md backdrop-blur-xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <CardTitle className="text-xl">{viewMode ? "Your Recovery Phrase" : "Secure Your Vault"}</CardTitle>
          <p className="text-muted-foreground text-sm">
            These 12 words are the only way to restore your vault. Save them now.
          </p>
        </CardHeader>

        <CardContent className="space-y-4">
          {wallet?.address && (
            <div className="text-xs text-muted-foreground text-center font-mono">
              {wallet.address.slice(0, 10)}…{wallet.address.slice(-8)}
            </div>
          )}

          {/* Phrase grid */}
          <div className="relative">
            <div
              className={`grid grid-cols-3 gap-2 p-3 rounded-lg bg-muted/30 border border-border transition ${
                revealed ? "" : "blur-md select-none"
              }`}
            >
              {(loading ? Array(12).fill("…") : words).map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-1 text-xs font-mono px-2 py-1.5 rounded bg-background/60"
                >
                  <span className="text-muted-foreground">{i + 1}.</span>
                  <span className="font-medium">{w}</span>
                </div>
              ))}
            </div>
            {!revealed && (
              <button
                onClick={() => setRevealed(true)}
                className="absolute inset-0 flex items-center justify-center text-sm font-medium text-primary"
              >
                <Eye className="w-4 h-4 mr-2" /> Tap to reveal
              </button>
            )}
            {revealed && (
              <button
                onClick={() => setRevealed(false)}
                className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              >
                <EyeOff className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 bg-destructive/5 border border-destructive/20 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <span className="text-xs text-muted-foreground">
              Never share these words. IDIA cannot recover your vault if you lose them.
            </span>
          </div>

          <Button variant="outline" className="w-full" onClick={handleDownload} disabled={loading}>
            <Download className="w-4 h-4 mr-2" />
            Download Recovery Key
          </Button>

          {!viewMode && (
            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={acknowledged}
                onCheckedChange={(v) => setAcknowledged(!!v)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground">
                I have safely backed up my keys.
              </span>
            </label>
          )}

          <Button
            className="w-full"
            onClick={handleComplete}
            disabled={!viewMode && !canProceed}
          >
            {viewMode ? "Done" : "Complete Setup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default RecoveryPhrase;
