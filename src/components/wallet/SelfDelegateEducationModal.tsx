import { X, Vote, Coins, Fuel, ShieldCheck, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SelfDelegateEducationModalProps {
  isVisible: boolean;
  onDismiss: () => void;
  onGoToWallet?: () => void;
}

const SelfDelegateEducationModal = ({
  isVisible,
  onDismiss,
  onGoToWallet,
}: SelfDelegateEducationModalProps) => {
  if (!isVisible) return null;

  return (
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in"
      onClick={onDismiss}
      role="dialog"
      aria-modal="true"
      aria-labelledby="self-delegate-edu-title"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-white/30 bg-white/95 backdrop-blur-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-full hover:bg-slate-100 transition-colors z-10"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4 text-slate-500" />
        </button>

        <div className="p-6 bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(35,92%,52%)] text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-white/15 rounded-xl">
              <Vote className="w-6 h-6 text-amber-200" />
            </div>
            <h2 id="self-delegate-edu-title" className="text-lg font-black tracking-tight">
              Claim Your Voice
            </h2>
          </div>
          <p className="text-xs text-white/90 leading-relaxed">
            You've just added a wallet! To obtain governance power of the IDIA Protocol you need a
            small amount of crypto to Self-Delegate.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-teal-50 border border-teal-100">
              <Coins className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-teal-700/70 font-bold">
                  Required
                </p>
                <p className="text-xs font-black text-teal-900">≥ 1 IDIA</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <Fuel className="w-4 h-4 text-amber-700 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-amber-700/70 font-bold">
                  Gas (Base)
                </p>
                <p className="text-xs font-black text-amber-900">~0.0001 ETH</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            <strong className="text-slate-800">Self-Delegating</strong> is how you Claim Your Voice
            in the IDIA Protocol. Pressing the "Self-Delegate" button after you have the necessary
            crypto assigns your voting weight to your wallet.
          </p>

          <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
            <ShieldCheck className="w-4 h-4 text-teal-600 mt-0.5 shrink-0" />
            <p className="text-xs text-slate-600 leading-relaxed">
              You will be responsible for reviewing proposals and casting your own votes.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onDismiss} className="rounded-xl">
              Got it
            </Button>
            <Button
              onClick={() => {
                onGoToWallet?.();
                onDismiss();
              }}
              className="rounded-xl bg-teal-600 hover:bg-teal-700 text-white"
            >
              Go to Wallet
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelfDelegateEducationModal;
