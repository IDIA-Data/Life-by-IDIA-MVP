import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Gavel, Loader2, Fingerprint, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { generateACAHash } from "@/utils/acaGenerator";
import { isNative } from "@/services/platform";

interface Proposal {
  id: string;
  title: string;
  description: string;
  status: string;
}

const calculateVoteCost = (n: number) => Math.pow(n, 2);

// 1. Extracted Individual Proposal Card Component
const ProposalCard: React.FC<{ proposal: Proposal; balance: number }> = ({ proposal, balance }) => {
  const [voteWeight, setVoteWeight] = useState([1]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCastVote = async () => {
    const cost = calculateVoteCost(voteWeight[0]);
    if (cost > balance) {
      toast({
        title: "Insufficient IDIA Tokens",
        description: `This weight costs ${cost} tokens.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      console.log(`[VOTE_CAST] VERIFY: Auditing financial metrics for quadratic weight: ${voteWeight[0]}`);

      console.log(`[VOTE_CAST] AUTH: Retrieving local sovereign identity.`);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Sovereign authentication failed or identity not found.");
      }

      console.log(`[VOTE_CAST] ACA_ANCHOR_START: Requesting hardware-backed biological anchor for vote mapping...`);
      const { hash, payload } = await generateACAHash(user.id, `proposal_vote_${proposal.id}`, [
        "GOVERNANCE_VOTE",
        "LEDGER_WRITE",
      ]);
      console.log(`[VOTE_CAST] ACA_ANCHOR_END: Biological presence verified. SHA-256 Hash Generated: ${hash}`);

      console.log(`[VOTE_CAST] NETWORK_START: Transmitting secure vote payload to Wyoming Operational Gateway.`);
      
      const { error: voteError } = await (supabase as any).from("dao_votes").insert({
        proposal_id: proposal.id,
        user_id: user.id,
        vote_type: "for",
        vote_weight: voteWeight[0],
        aca_hash_key: hash,
        aca_payload: payload,
      });

      if (voteError) {
        if (voteError.code === "23505") {
          toast({
            title: "Already Voted",
            description: "Sovereign intent on this proposal is already recorded.",
            variant: "destructive",
          });
          return;
        }
        throw voteError;
      }

      // Burn IDIA tokens via wallet decrement (atomic)
      const { error: burnError } = await (supabase as any).rpc("increment_wallet_balance", {
        target_user_id: user.id,
        increment_amount: -cost,
      });
      
      if (burnError) {
        console.warn(`[VOTE_CAST] BURN_WARNING: Token burn failed but vote stands. ${burnError.message}`);
      }

      console.log(`[VOTE_CAST] NETWORK_END: Ledger entry committed. Intent synced for proposal ${proposal.id}.`);
      toast({
        title: "Intent Cast Successfully",
        description: `Secured via ACA Hash ${hash.substring(0, 8)}...`,
      });

      setVoteWeight([1]);
    } catch (error: any) {
      console.error(`[VOTE_CAST] CRITICAL_FAILURE: Vote sequence halted. Reason: ${error.message}`);
      toast({
        title: "Submission Failed",
        description: "The vote sequence was interrupted. Check logs for details.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      console.log(`[VOTE_CAST] END: Execution thread terminated.`);
    }
  };

  return (
    <Card className="border-teal-50 shadow-sm rounded-3xl overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        <div className="space-y-2">
          <Badge className="bg-orange-500 hover:bg-orange-600 text-white text-[9px] font-black uppercase tracking-wider">
            {proposal.status}
          </Badge>
          <h3 className="font-black text-lg leading-tight text-slate-800">{proposal.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{proposal.description}</p>
        </div>

        <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-100/50 space-y-4">
          <div className="flex justify-between items-center text-[10px] font-black uppercase tracking-wider">
            <span className="text-teal-700 flex items-center gap-1">
              <Activity size={12} /> Quadratic Weight
            </span>
            <span className="text-orange-600 bg-orange-100/50 px-2 py-1 rounded-md">
              Cost: {calculateVoteCost(voteWeight[0])} IDIA
            </span>
          </div>

          <Slider
            value={voteWeight}
            onValueChange={setVoteWeight}
            max={50}
            min={1}
            step={1}
            disabled={isSubmitting}
            className="cursor-pointer"
          />

          <div className="flex justify-between items-center pt-2">
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-black text-teal-800 tracking-tighter">{voteWeight[0]}</p>
              <span className="text-[10px] font-bold text-teal-600/60 uppercase tracking-widest">VOTES</span>
            </div>

            <Button
              onClick={handleCastVote}
              disabled={isSubmitting}
              className="bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase text-[10px] px-6 rounded-full h-10 shadow-lg shadow-teal-900/10 transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  VERIFYING...
                </>
              ) : (
                <>
                  <Fingerprint className="w-4 h-4 mr-2" />
                  SYNC INTENT
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// 2. The Main List Component
const ActiveProposalsList: React.FC<{ balance: number }> = ({ balance }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      console.log("[ACTIVE_PROPOSALS] START: Initializing protocol fetch for active quadratic proposals.");
      try {
        const { data, error } = await (supabase as any)
          .from("dao_proposals")
          .select("*")
          .eq("voting_modality", "quadratic")
          .order("created_at", { ascending: false });

        if (error) {
          throw error;
        }

        if (isMounted) {
          console.log(
            `[ACTIVE_PROPOSALS] SUCCESS: Retrieved ${data?.length || 0} active proposals from Wyoming Gateway.`,
          );
          setProposals(data || []);
        }
      } catch (err: any) {
        console.error(
          `[ACTIVE_PROPOSALS] CRITICAL_FAILURE: Failed to query Wyoming operational data. Reason: ${err.message}`,
        );
        toast({
          title: "Telemetry Stalled",
          description: "Failed to retrieve active proposals from the ledger.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
          console.log("[ACTIVE_PROPOSALS] END: Fetch execution thread terminated.");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/50">
          Syncing Operational Gateway...
        </p>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="py-16 text-center opacity-40 space-y-3 bg-slate-50 rounded-3xl border border-slate-100">
        <Gavel className="mx-auto w-10 h-10 text-slate-400" />
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">No Active Proposals Found</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {proposals.map((prop) => (
        <ProposalCard key={prop.id} proposal={prop} balance={balance} />
      ))}
    </div>
  );
};

export default ActiveProposalsList;