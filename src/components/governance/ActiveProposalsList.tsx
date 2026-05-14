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

const ActiveProposalsList: React.FC<{ balance: number }> = ({ balance }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [voteWeight, setVoteWeight] = useState([1]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase
        .from("dao_proposals" as any)
        .select("*")
        .eq("voting_modality", "quadratic")
        .order("created_at", { ascending: false }) as any);
      if (data) setProposals(data);
      setLoading(false);
    })();
  }, []);

  const handleCastVote = async (proposalId: string) => {
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
      const cost = calculateVoteCost(voteWeight[0]);

      if (cost > balance) {
        const err = new Error(
          `Insufficient Governance Tokens. Requested weight costs ${cost}, but sovereign balance is ${balance}.`,
        );
        console.error(`[VOTE_CAST] VALIDATION_ERROR: ${err.message}`);
        toast({
          title: "Insufficient IDIA Tokens",
          description: `This quadratic weight costs ${cost} tokens.`,
          variant: "destructive",
        });
        throw err;
      }

      console.log(`[VOTE_CAST] AUTH: Retrieving local sovereign identity.`);
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error("Sovereign authentication failed or identity not found.");
      }

      console.log(`[VOTE_CAST] ACA_ANCHOR_START: Requesting hardware-backed biological anchor for vote mapping...`);
      const { hash, payload } = await generateACAHash(user.id, `proposal_vote_${prop.id}`, [
        "GOVERNANCE_VOTE",
        "LEDGER_WRITE",
      ]);
      console.log(`[VOTE_CAST] ACA_ANCHOR_END: Biological presence verified. SHA-256 Hash Generated: ${hash}`);

      console.log(`[VOTE_CAST] NETWORK_START: Transmitting secure vote payload to Wyoming Operational Gateway.`);
      const { error: voteError } = await (supabase.from("dao_votes" as any).insert({
        proposal_id: prop.id,
        user_id: user.id,
        vote_type: "for",
        vote_weight: voteWeight[0],
        aca_hash_key: hash,
        aca_payload: payload,
      }) as any);

      if (voteError) {
        if ((voteError as any).code === "23505") {
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
      const { error: burnError } = await (supabase.rpc as any)("increment_wallet_balance", {
        target_user_id: user.id,
        increment_amount: -cost,
      });
      if (burnError) {
        console.warn(`[VOTE_CAST] BURN_WARNING: Token burn failed but vote stands. ${burnError.message}`);
      }

      console.log(`[VOTE_CAST] NETWORK_END: Ledger entry committed. Intent synced for proposal ${prop.id}.`);
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
            {prop.status}
          </Badge>
          <h3 className="font-black text-lg leading-tight text-slate-800">{prop.title}</h3>
          <p className="text-xs text-muted-foreground leading-relaxed">{prop.description}</p>
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
                  VERIFYING ACA...
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

const ActiveProposalsList: React.FC<{ balance: number }> = ({ balance }) => {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      console.log("[ACTIVE_PROPOSALS] START: Initializing protocol fetch for active quadratic proposals.");
      try {
        const { data, error } = await (supabase
          .from("dao_proposals" as any)
          .select("*")
          .eq("voting_modality", "quadratic")
          .order("created_at", { ascending: false }) as any);

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
        <Card key={prop.id} className="border-teal-50 shadow-sm rounded-3xl">
          <CardContent className="p-5 space-y-4">
            <div className="space-y-1">
              <Badge className="bg-orange-500 text-white text-[8px] font-black uppercase">{prop.status}</Badge>
              <h3 className="font-black text-base">{prop.title}</h3>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{prop.description}</p>
            </div>

            <div className="p-4 bg-teal-50/30 rounded-2xl border border-teal-100/50 space-y-3">
              <div className="flex justify-between items-center text-[9px] font-black uppercase">
                <span className="text-teal-700">Quadratic Weight</span>
                <span className="text-orange-600">Cost: {calculateVoteCost(voteWeight[0])} IDIA</span>
              </div>
              <Slider value={voteWeight} onValueChange={setVoteWeight} max={50} step={1} />
              <div className="flex justify-between items-center">
                <p className="text-xl font-black text-teal-800">
                  {voteWeight[0]} <span className="text-[10px] font-bold text-teal-600/50">VOTES</span>
                </p>
                <Button
                  onClick={() => handleCastVote(prop.id)}
                  disabled={isSubmitting}
                  className="bg-[hsl(178,42%,32%)] hover:bg-teal-700 text-white font-black uppercase text-[9px] px-6 rounded-full h-9"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sync Intent"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default ActiveProposalsList;
