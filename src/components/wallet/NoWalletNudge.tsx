import { X, Wallet, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NoWalletNudgeProps {
  isVisible: boolean;
  onDismiss: () => void;
  onCreateWallet: () => void;
}

const NoWalletNudge = ({ isVisible, onDismiss, onCreateWallet }: NoWalletNudgeProps) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="no-wallet-nudge-title"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/30 bg-white/90 backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        <div className="p-6 bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/15 rounded-xl">
              <Wallet className="w-6 h-6 text-amber-300" />
            </div>
            <h2 id="no-wallet-nudge-title" className="text-lg font-black tracking-tight">
              Sovereign Vault Required
            </h2>
          </div>
          <p className="text-xs text-teal-50/80 leading-relaxed">
            You don't have a Sovereign Vault yet. Create one to start receiving ETH, IDIA, and USDC.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <ShieldCheck className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 leading-relaxed">
              Your vault is generated locally on this device. Find it under{" "}
              <span className="font-bold text-slate-800">Wallet → Security</span>.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={onDismiss}
              className="rounded-xl"
            >
              Later
            </Button>
            <Button
              onClick={onCreateWallet}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
            >
              Create Wallet
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoWalletNudge;
