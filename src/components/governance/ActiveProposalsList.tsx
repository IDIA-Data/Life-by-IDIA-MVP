import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Gavel, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase.from("governance_ledger" as any).insert({
      user_id: user?.id,
      amount: -cost,
      transaction_type: "vote_cast",
      description: `Quadratic Vote: ${proposalId}`,
    }) as any);
    setIsSubmitting(false);
    if (!error) {
      toast({ title: "Intent Cast", description: `Spent ${cost} tokens for ${voteWeight[0]} weighted votes.` });
    } else {
      toast({ title: "Submission Failed", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="py-12 text-center opacity-30 space-y-2">
        <Gavel className="mx-auto w-8 h-8" />
        <p className="text-[10px] font-bold uppercase tracking-widest">No Active Proposals Found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
