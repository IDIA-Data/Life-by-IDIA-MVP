import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Wallet, Plus, Download, Eye, EyeOff, Copy, CheckCircle, AlertTriangle, Shield, Key } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  mode: "create" | "import" | "view-seed";
  onCreateWallet: () => Promise<{ address: string; mnemonic: string } | null>;
  onImportWallet: (m: string) => Promise<boolean>;
  getSeedPhrase: () => Promise<string | null>;
  walletAddress?: string | null;
  provisioningStage?:
    | "idle"
    | "requesting_drip"
    | "awaiting_gas"
    | "approving_usdc"
    | "approving_vault"
    | "delegating_self"
    | "done"
    | "failed";
}

const STAGE_COPY: Record<string, string> = {
  idle: "Generating Cryptographic Keys...",
  requesting_drip: "Generating Cryptographic Keys...",
  awaiting_gas: "Securing Ecosystem Routing...",
  approving_usdc: "Securing Ecosystem Routing...",
  delegating_self: "Finalizing Configuration...",
  done: "Configuration complete.",
  failed: "Configuration partially completed — you can finish setup later.",
};

const WalletSetupModal: React.FC<Props> = ({
  isOpen,
  onClose,
  mode,
  onCreateWallet,
  onImportWallet,
  getSeedPhrase,
  walletAddress,
  provisioningStage = "idle",
}) => {
  const { toast } = useToast();
  type Step = "intro" | "creating" | "show-seed" | "confirm-seed" | "success" | "import-form" | "loading-seed";
  const [step, setStep] = useState<Step>("intro");
  const [seed, setSeed] = useState<string | null>(null);
  const [addr, setAddr] = useState<string | null>(null);
  const [showSeed, setShowSeed] = useState(false);
  const [importText, setImportText] = useState("");
  const [importErr, setImportErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmWord, setConfirmWord] = useState("");
  const [confirmIdx, setConfirmIdx] = useState(0);

  React.useEffect(() => {
    if (!isOpen) return;
    setSeed(null);
    setAddr(null);
    setShowSeed(false);
    setImportText("");
    setImportErr(null);
    setConfirmWord("");
    if (mode === "create") setStep("intro");
    else if (mode === "import") setStep("import-form");
    else if (mode === "view-seed") {
      setStep("loading-seed");
      getSeedPhrase().then((p) => {
        if (p) {
          setSeed(p);
          setStep("show-seed");
        } else {
          toast({ title: "Error", description: "Could not retrieve seed phrase.", variant: "destructive" });
          onClose();
        }
      });
    }
  }, [isOpen, mode]);

  const handleCreate = async () => {
    setStep("creating");
    setBusy(true);
    try {
      const r = await onCreateWallet();
      if (r) {
        setSeed(r.mnemonic);
        setAddr(r.address);
        setConfirmIdx(Math.floor(Math.random() * 12));
        setStep("show-seed");
      } else {
        setStep("intro");
      }
    } catch (e: any) {
      setStep("intro");
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const handleConfirm = () => {
    const w = (seed || "").split(" ");
    if (confirmWord.trim().toLowerCase() === w[confirmIdx]?.toLowerCase()) setStep("success");
    else toast({ title: "Incorrect", description: "Wrong word. Try again.", variant: "destructive" });
  };
  const handleImport = async () => {
    setImportErr(null);
    setBusy(true);
    try {
      if (await onImportWallet(importText)) {
        setStep("success");
      } else {
        setImportErr("Failed. Check your seed phrase.");
      }
    } catch (e: any) {
      setImportErr(e.message);
    } finally {
      setBusy(false);
    }
  };
  const copy = (t: string) => {
    navigator.clipboard.writeText(t);
    toast({ title: "Copied" });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5" />
            <span>{mode === "create" ? "Create Wallet" : mode === "import" ? "Import Wallet" : "Seed Phrase"}</span>
          </DialogTitle>
        </DialogHeader>

        {step === "loading-seed" && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">Retrieving...</p>
          </div>
        )}

        {step === "intro" && mode === "create" && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Plus className="w-8 h-8 text-teal-600" />
              </div>
              <h3 className="text-lg font-semibold">Create a New Wallet</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Generate a 12-word seed phrase. Write it down and store safely.
              </p>
            </div>
            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Your seed phrase is the only way to recover your wallet. Never share it.
                  </p>
                </div>
              </CardContent>
            </Card>
            <Button onClick={handleCreate} className="w-full bg-teal-500 hover:bg-teal-600" disabled={busy}>
              {busy ? "Creating..." : "Create New Wallet"}
            </Button>
          </div>
        )}

        {step === "creating" && (
          <div className="text-center py-8">
            <div className="w-10 h-10 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-muted-foreground">{STAGE_COPY[provisioningStage] ?? "Generating..."}</p>
          </div>
        )}

        {step === "show-seed" && seed && (
          <div className="space-y-4">
            {(addr || walletAddress) && (
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Wallet</p>
                <div className="flex items-center justify-center space-x-2 mt-1">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                    {(addr || walletAddress || "").slice(0, 8)}...{(addr || walletAddress || "").slice(-6)}
                  </code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copy(addr || walletAddress || "")}
                    className="h-6 w-6 p-0"
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            )}
            <Card className="bg-red-50 border-red-200">
              <CardContent className="p-3">
                <div className="flex items-start space-x-2">
                  <Shield className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-800 font-medium">Write down these 12 words. Do not screenshot.</p>
                </div>
              </CardContent>
            </Card>
            <div className="relative">
              {!showSeed && (
                <div
                  className="absolute inset-0 bg-gray-900/80 rounded-lg flex items-center justify-center z-10 cursor-pointer"
                  onClick={() => setShowSeed(true)}
                >
                  <div className="text-center text-white">
                    <EyeOff className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm font-medium">Tap to reveal</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 p-3 bg-muted rounded-lg">
                {seed.split(" ").map((w, i) => (
                  <div key={i} className="flex items-center space-x-1 bg-background rounded px-2 py-1.5 border">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}.</span>
                    <span className="text-sm font-mono font-medium">{w}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowSeed(!showSeed)} className="w-full">
              {showSeed ? (
                <>
                  <EyeOff className="w-4 h-4 mr-2" />
                  Hide
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Show
                </>
              )}
            </Button>
            {mode === "create" ? (
              <Button onClick={() => setStep("confirm-seed")} className="w-full bg-teal-500 hover:bg-teal-600">
                I've Written It Down
              </Button>
            ) : (
              <Button onClick={onClose} className="w-full">
                Done
              </Button>
            )}
          </div>
        )}

        {step === "confirm-seed" && (
          <div className="space-y-4 text-center">
            <Key className="w-10 h-10 text-teal-600 mx-auto mb-2" />
            <h3 className="font-semibold">Verify Backup</h3>
            <p className="text-sm text-muted-foreground">
              Enter word <strong>#{confirmIdx + 1}</strong>:
            </p>
            <Input
              placeholder={`Word #${confirmIdx + 1}`}
              value={confirmWord}
              onChange={(e) => setConfirmWord(e.target.value)}
              className="text-center text-lg"
              autoFocus
            />
            <Button onClick={handleConfirm} className="w-full bg-teal-500 hover:bg-teal-600">
              Verify
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setStep("show-seed")}
              className="w-full text-muted-foreground"
            >
              Go back
            </Button>
          </div>
        )}

        {step === "import-form" && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <Download className="w-10 h-10 text-teal-600 mx-auto mb-2" />
              <h3 className="font-semibold">Import Wallet</h3>
              <p className="text-sm text-muted-foreground mt-1">Enter your 12-word seed phrase.</p>
            </div>
            <textarea
              className="w-full min-h-[100px] p-3 border rounded-lg text-sm font-mono resize-none focus:ring-2 focus:ring-teal-500"
              placeholder="word1 word2 word3 ..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            />
            {importErr && <p className="text-sm text-red-600">{importErr}</p>}
            <Button
              onClick={handleImport}
              className="w-full bg-teal-500 hover:bg-teal-600"
              disabled={busy || importText.trim().split(/\s+/).length < 12}
            >
              {busy ? "Importing..." : "Import Wallet"}
            </Button>
          </div>
        )}

        {step === "success" && (
          <div className="text-center space-y-4 py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-green-700">
              {mode === "create" ? "Wallet Created!" : "Wallet Imported!"}
            </h3>
            <Button onClick={onClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WalletSetupModal;
