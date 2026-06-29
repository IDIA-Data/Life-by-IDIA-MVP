import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, ShieldCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { governanceService } from "@/services/governanceService";
import { stage } from "@/lib/stageLogger";

interface Props {
  idiaBalance: number;
  onActivated?: () => void;
}

const ActivateVotingPowerCard: React.FC<Props> = ({ idiaBalance, onActivated }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleActivate = async () => {
    const s = stage("VOTING_POWER", "SELF_DELEGATE_RELAY");
    s.start({ balance: idiaBalance });
    setIsSubmitting(true);
    try {
      const { hash, acaHash } = await governanceService.signAndRelaySelfDelegation();
      s.ok({ tx: hash, aca: acaHash });
      toast({
        title: "Voting Power Activated",
        description: `Self-delegation confirmed on-chain · tx ${hash.substring(0, 10)}…`,
      });
      onActivated?.();
    } catch (e: any) {
      s.fail(e);
      console.error("[VOTING_POWER] activation failed", e);
      toast({
        title: "Activation Failed",
        description: e?.message || "Could not relay delegation.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="bg-gradient-to-br from-orange-500/95 to-orange-600/95 text-white border-none shadow-xl rounded-3xl overflow-hidden backdrop-blur-xl">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
            <Zap className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-50/70">
              Action Required
            </p>
            <h3 className="font-black text-base leading-tight">Activate Voting Power</h3>
            <p className="text-[11px] mt-1 text-orange-50/90 leading-relaxed">
              You hold <strong>{idiaBalance.toLocaleString()}</strong> IDIA but they don't count as
              votes yet. ERC20Votes requires you to self-delegate before tokens carry voting weight.
              We'll cover the gas via the sovereign relayer.
            </p>
          </div>
        </div>
        <Button
          onClick={handleActivate}
          disabled={isSubmitting}
          className="w-full h-11 bg-white text-orange-700 hover:bg-orange-50 font-black uppercase text-[11px] tracking-widest rounded-full"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Relaying Delegation…
            </>
          ) : (
            <>
              <ShieldCheck className="w-4 h-4 mr-2" />
              Activate (Gasless Self-Delegate)
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ActivateVotingPowerCard;
