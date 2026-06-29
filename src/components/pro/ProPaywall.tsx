import { useState } from "react";
import { Crown, Brain, Zap, Shield, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { SubscriptionTier, TIER_RANK } from "@/hooks/useSubscription";
import { toast } from "@/hooks/use-toast";

const tiers = [
  {
    id: "pro" as SubscriptionTier,
    name: "IDIA Life Pro",
    price: "FREE until July 11th then $9.99",
    period: "/mo",
    subtitle: "Workforce Optimization",
    icon: Zap,
    color: "from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)]",
    border: "border-[hsl(178,42%,32%)/0.3]",
    features: ["Human Reliability Index", "Performance Tools", "Cognitive Alerts"],
  },
  {
    id: "pro_plus" as SubscriptionTier,
    name: "IDIA Life Pro+",
    price: "FREE until July 11th then $29.99",
    period: "/mo",
    subtitle: "Cognitive Performance",
    icon: Brain,
    color: "from-[hsl(28,80%,55%)] to-[hsl(28,80%,45%)]",
    border: "border-[hsl(28,80%,55%)/0.3]",
    popular: true,
    features: ["Everything in Pro", "Pro+ Dashboard", "40Hz Gamma Trigger", "Memory Anchoring"],
  },
  {
    id: "pure_alpha" as SubscriptionTier,
    name: "Pure Alpha",
    price: "FREE until July 11th then $99.99",
    period: "/mo",
    subtitle: "Executive Sovereignty",
    icon: Crown,
    color: "from-[hsl(270,60%,50%)] to-[hsl(270,60%,35%)]",
    border: "border-[hsl(270,60%,50%)/0.3]",
    features: ["Everything in Pro+", "P&L Fusion", "Ghost Protocol"],
  },
];

interface ProPaywallProps {
  currentTier: SubscriptionTier;
  onSubscribe: (tier: SubscriptionTier) => Promise<boolean>;
}

const ProPaywall = ({ currentTier, onSubscribe }: ProPaywallProps) => {
  const [confirmTier, setConfirmTier] = useState<(typeof tiers)[0] | null>(null);
  const [subscribing, setSubscribing] = useState(false);

  const handleConfirm = async () => {
    if (!confirmTier) return;
    setSubscribing(true);
    const ok = await onSubscribe(confirmTier.id);
    setSubscribing(false);
    if (ok) {
      toast({ title: "Plan Updated", description: `You are now on ${confirmTier.name}.` });
      setConfirmTier(null);
    }
  };

  return (
    <div className="px-4 pt-3 pb-24 space-y-4 animate-fade-in">
      <div className="text-center space-y-1">
        <Shield className="w-5 h-5 text-[hsl(28,80%,55%)] mx-auto" />
        <h1 className="text-lg font-semibold tracking-tight">Unlock Your Edge</h1>
        <p className="text-[11px] text-muted-foreground">PREVIEW: Advanced Cognitive & Financial Tools.</p>
      </div>

      <div className="space-y-2.5">
        {tiers.map((t) => {
          const isActive = currentTier === t.id;
          const currentRank = TIER_RANK[String(currentTier)] || 0;
          const targetRank = TIER_RANK[String(t.id)];
          const isUpgrade = targetRank > currentRank;

          return (
            <div
              key={t.id}
              className={`relative rounded-xl border p-3 bg-card/60 backdrop-blur-xl transition-colors ${isActive ? "border-[hsl(178,42%,32%)]" : "border-border/40"}`}
            >
              {isActive && (
                <div className="absolute top-2 right-2 text-[9px] font-medium text-[hsl(178,42%,42%)] tracking-wide">
                  CURRENT
                </div>
              )}
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-md bg-gradient-to-br ${t.color} flex items-center justify-center`}>
                    <t.icon className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <h3 className="font-medium text-[13px] leading-tight">{t.name}</h3>
                    <p className="text-[10px] text-muted-foreground leading-tight">{t.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-base font-semibold">{t.price}</span>
                  <span className="text-[10px] text-muted-foreground">/mo</span>
                </div>
              </div>
              <ul className="grid grid-cols-2 gap-x-2 gap-y-1 mb-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Check className="w-2.5 h-2.5 text-[hsl(178,42%,42%)] shrink-0" />
                    <span className="truncate">{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant={isActive ? "outline" : "default"}
                className={`w-full h-8 text-xs ${isActive ? "" : `bg-gradient-to-r ${t.color} border-0 text-white hover:opacity-90`}`}
                onClick={() => setConfirmTier(t)}
                disabled={isActive || subscribing}
              >
                {isActive ? "Active" : isUpgrade ? "Upgrade" : "Downgrade"}
              </Button>
            </div>
          );
        })}
      </div>

      <Dialog open={!!confirmTier} onOpenChange={() => setConfirmTier(null)}>
        <DialogContent className="max-w-sm backdrop-blur-xl bg-card/95">
          <DialogHeader>
            <DialogTitle>Confirm Plan Change</DialogTitle>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmTier(null)}>
              Cancel
            </Button>
            <Button
              className={`bg-gradient-to-r ${confirmTier?.color} text-white`}
              onClick={handleConfirm}
              disabled={subscribing}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProPaywall;
