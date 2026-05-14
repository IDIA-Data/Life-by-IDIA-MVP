import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowDownRight, ArrowUpRight, Loader2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Flow {
  id: string;
  direction: "in" | "out";
  asset: string;
  amount_usd: number;
  counterparty_label: string | null;
  recorded_at: string;
}

const TreasuryFlows: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchFlows = async () => {
      console.log("[TREASURY_FLOWS] START: Syncing Delaware treasury telemetry.");
      try {
        const { data, error } = await supabase
          .from("dao_treasury_flows" as any)
          .select("*")
          .gte("recorded_at", new Date(Date.now() - 30 * 86400_000).toISOString())
          .order("recorded_at", { ascending: false });

        if (error) throw error;

        if (isMounted) {
          console.log(`[TREASURY_FLOWS] SUCCESS: Retrieved ${data?.length || 0} ledger entries for the 30-day window.`);
          setFlows((data as any) || []);
        }
      } catch (err: any) {
        console.error(`[TREASURY_FLOWS] CRITICAL_FAILURE: Telemetry sync stalled. Reason: ${err.message}`);
        toast({
          title: "Treasury Sync Failed",
          description: "Could not retrieve corporate financial telemetry.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log("[TREASURY_FLOWS] END: Sync execution thread terminated.");
        }
      }
    };

    // Initial Fetch
    fetchFlows();

    // Establish Real-Time Socket Connection
    console.log("[TREASURY_FLOWS] SOCKET_START: Establishing real-time connection to Delaware Treasury.");
    const ch = supabase
      .channel("treasury_flows_telemetry")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dao_treasury_flows" }, (payload) => {
        console.log(
          "[TREASURY_FLOWS] SOCKET_EVENT: Real-time financial mutation detected. Re-evaluating chart data...",
          payload,
        );
        fetchFlows();
      })
      .subscribe((status) => {
        console.log(`[TREASURY_FLOWS] SOCKET_STATUS: Treasury socket state -> ${status}`);
      });

    return () => {
      isMounted = false;
      console.log("[TREASURY_FLOWS] SOCKET_CLOSE: Tearing down real-time connection.");
      supabase.removeChannel(ch);
    };
  }, []);

  const series = React.useMemo(() => {
    console.log("[TREASURY_FLOWS] CALC: Computing 30-day chart aggregation matrix.");
    const buckets: Record<string, { day: string; in: number; out: number }> = {};

    [...flows].reverse().forEach((f) => {
      const day = new Date(f.recorded_at).toISOString().slice(5, 10);
      if (!buckets[day]) buckets[day] = { day, in: 0, out: 0 };
      buckets[day][f.direction] += Number(f.amount_usd);
    });

    return Object.values(buckets);
  }, [flows]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-teal-50 shadow-sm overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <p className="text-[9px] font-black uppercase tracking-widest text-teal-700/50">
            Auditing Treasury Ledger...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-teal-50 shadow-sm overflow-hidden transition-all">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-teal-50/50 pb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-800 flex items-center gap-2">
            <TrendingUp size={14} className="text-teal-600" />
            Treasury Flows · 30D Window
          </h3>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">USD / Stablecoins</div>
        </div>

        {series.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 opacity-40 space-y-2">
            <Activity className="w-8 h-8 text-slate-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Awaiting Oracle Ingest</p>
          </div>
        ) : (
          <>
            <div className="h-36 pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(178,42%,42%)" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="hsl(178,42%,42%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: 700 }}
                    stroke="transparent"
                    tickMargin={8}
                  />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 12,
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ fontWeight: 800 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="in"
                    name="Ingress"
                    stroke="hsl(178,42%,32%)"
                    strokeWidth={2}
                    fill="url(#gIn)"
                  />
                  <Area
                    type="monotone"
                    dataKey="out"
                    name="Egress"
                    stroke="#f97316"
                    strokeWidth={2}
                    fill="url(#gOut)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-4 border-t border-teal-50">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 mb-2">
                Recent Atomic Settlements
              </p>
              {flows.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg",
                        f.direction === "in" ? "bg-emerald-50 text-emerald-600" : "bg-orange-50 text-orange-500",
                      )}
                    >
                      {f.direction === "in" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">{f.counterparty_label || f.asset}</span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">
                        {new Date(f.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-black tracking-tighter",
                      f.direction === "in" ? "text-emerald-700" : "text-slate-700",
                    )}
                  >
                    {f.direction === "in" ? "+" : "-"}${Number(f.amount_usd).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default TreasuryFlows;
