import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, ShieldOff, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PendingAction {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  timelock_expires_at: string;
  veto_threshold: number;
  veto_count: number;
  status: "pending" | "vetoed" | "executed";
}

const formatRemaining = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "Timelock expired";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m remaining`;
};

const PendingActionsCarousel: React.FC = () => {
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [vetoing, setVetoing] = useState<string | null>(null);

  const fetchActions = async () => {
    const { data } = await supabase
      .from("dao_pending_actions" as any)
      .select("*")
      .eq("status", "pending")
      .order("timelock_expires_at", { ascending: true });
    setActions((data as any) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchActions();
    const ch = supabase
      .channel("dao_pending_actions_live")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dao_pending_actions" }, fetchActions)
      .subscribe();
    const tick = setInterval(() => setActions((a) => [...a]), 60_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(tick);
    };
  }, []);

  const castVeto = async (actionId: string) => {
    setVetoing(actionId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({ title: "Sign in required", variant: "destructive" });
      setVetoing(null);
      return;
    }
    const { error } = await supabase.from("dao_vetoes" as any).insert({ action_id: actionId, user_id: user.id });
    setVetoing(null);
    if (error) {
      toast({ title: "Veto failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Veto cast", description: "Your dissent has been recorded." });
      await supabase.functions.invoke("dao-veto-tally", { body: { actionId } });
      fetchActions();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="py-12 text-center opacity-30 space-y-2">
        <Zap className="mx-auto w-8 h-8" />
        <p className="text-[10px] font-bold uppercase tracking-widest">No Pending Actions in Timelock</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-3 px-1 snap-x snap-mandatory scrollbar-hide">
      {actions.map((a) => {
        const expired = new Date(a.timelock_expires_at).getTime() <= Date.now();
        return (
          <Card
            key={a.id}
            className="min-w-[280px] max-w-[280px] snap-center rounded-3xl border-orange-100 shadow-sm flex-shrink-0"
          >
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Badge className="bg-orange-500 text-white text-[8px] font-black uppercase">Optimistic</Badge>
                <span className="text-[9px] font-black uppercase tracking-widest text-teal-700">{a.category}</span>
              </div>
              <h4 className="font-black text-sm leading-tight">{a.title}</h4>
              <p className="text-[11px] text-muted-foreground line-clamp-3">{a.description}</p>

              <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-600">
                <Clock size={11} /> {formatRemaining(a.timelock_expires_at)}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-orange-50">
                <div className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                  Vetoes {a.veto_count}/{a.veto_threshold}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={vetoing === a.id || expired}
                  onClick={() => castVeto(a.id)}
                  className="h-7 text-[9px] font-black uppercase tracking-widest border-orange-300 text-orange-700 hover:bg-orange-50 rounded-full"
                >
                  {vetoing === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : (<><ShieldOff size={11} className="mr-1" /> Veto</>)}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default PendingActionsCarousel;
