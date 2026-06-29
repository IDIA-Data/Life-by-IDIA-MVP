import { useState, useEffect } from "react";
import { ShieldCheck, Lock, Unlock, Fingerprint } from "lucide-react";

interface SovereignAuthProps {
  onVerified: () => void;
}

const SovereignAuth = ({ onVerified }: SovereignAuthProps) => {
  const [stage, setStage] = useState<"idle" | "scanning" | "verified">("idle");

  useEffect(() => {
    let isMounted = true;

    const autoUnlockVault = async () => {
      // Start the automated vault opening sequence
      setStage("scanning");

      // Simulate the vault decrypting/opening
      await new Promise((r) => setTimeout(r, 1800));
      if (!isMounted) return;

      // Vault is open
      setStage("verified");

      // Brief pause so the user can read the "Welcome" message before redirect
      await new Promise((r) => setTimeout(r, 1200));
      if (!isMounted) return;

      // Automatically trigger the route to the Pro Paywall
      onVerified();
    };

    autoUnlockVault();

    return () => {
      isMounted = false;
    };
  }, [onVerified]);

  return (
    <div className="p-4 pb-24 flex flex-col items-center justify-center min-h-[60vh] animate-fade-in">
      <div className="rounded-3xl border border-white/20 bg-card/60 backdrop-blur-xl p-8 max-w-sm w-full text-center space-y-6">
        <div className="flex justify-center">
          <div
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 ${
              stage === "scanning"
                ? "bg-[hsl(28,80%,55%)]/20 animate-pulse"
                : stage === "verified"
                  ? "bg-[hsl(142,71%,45%)]/20 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
                  : "bg-muted"
            }`}
          >
            {stage === "verified" ? (
              <Unlock className="w-10 h-10 text-[hsl(142,71%,45%)] animate-in zoom-in duration-300" />
            ) : (
              <Lock
                className={`w-10 h-10 transition-colors ${
                  stage === "scanning" ? "text-[hsl(28,80%,55%)] animate-pulse" : "text-muted-foreground"
                }`}
              />
            )}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-bold text-foreground mb-1">
            {stage === "verified" ? "Vault Opened" : "Sovereign Vault"}
          </h2>
          <p className="text-xs text-muted-foreground transition-all duration-300">
            {stage === "idle" && "Initializing secure connection..."}
            {stage === "scanning" && "Decrypting Status..."}
            {stage === "verified" && "Identity Confirmed. Welcome."}
          </p>
        </div>

        {/* Retained the technical readout to keep the high-fidelity aesthetic */}
        <div
          className={`rounded-lg bg-muted/50 p-3 text-left space-y-1.5 transition-opacity duration-500 ${stage === "verified" ? "opacity-50" : "opacity-100"}`}
        >
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <ShieldCheck
              className={`w-3 h-3 ${stage === "verified" ? "text-[hsl(142,71%,45%)]" : "text-[hsl(28,80%,55%)]"}`}
            />
            Secure Handshake
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Fingerprint
              className={`w-3 h-3 ${stage === "verified" ? "text-[hsl(142,71%,45%)]" : "text-[hsl(178,42%,32%)]"}`}
            />
            Automated Biometric Pass
          </div>
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
            <Lock
              className={`w-3 h-3 ${stage === "verified" ? "text-[hsl(142,71%,45%)]" : "text-[hsl(270,60%,50%)]"}`}
            />
            Accessing Pro Tiers
          </div>
        </div>
      </div>
    </div>
  );
};

export default SovereignAuth;
