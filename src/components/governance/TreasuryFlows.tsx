import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, AreaChart, Area, XAxis, Tooltip } from "recharts";

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

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dao_treasury_flows" as any)
        .select("*")
        .gte("recorded_at", new Date(Date.now() - 30 * 86400_000).toISOString())
        .order("recorded_at", { ascending: false });
      setFlows((data as any) || []);
    })();
  }, []);

  const series = React.useMemo(() => {
    const buckets: Record<string, { day: string; in: number; out: number }> = {};
    [...flows].reverse().forEach((f) => {
      const day = new Date(f.recorded_at).toISOString().slice(5, 10);
      if (!buckets[day]) buckets[day] = { day, in: 0, out: 0 };
      buckets[day][f.direction] += Number(f.amount_usd);
    });
    return Object.values(buckets);
  }, [flows]);

  return (
    <Card className="rounded-3xl border-teal-50 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-700 flex items-center gap-2">
          <TrendingUp size={14} /> Treasury Flows · 30D
        </h3>

        {series.length === 0 ? (
          <p className="text-[10px] uppercase tracking-widest opacity-30 py-6 text-center">
            Awaiting Oracle Ingest
          </p>
        ) : (
          <>
            <div className="h-32">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series}>
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
                  <XAxis dataKey="day" tick={{ fontSize: 9 }} stroke="#94a3b8" />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 12 }} />
                  <Area type="monotone" dataKey="in" stroke="hsl(178,42%,32%)" fill="url(#gIn)" />
                  <Area type="monotone" dataKey="out" stroke="#f97316" fill="url(#gOut)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-teal-50">
              {flows.slice(0, 10).map((f) => (
                <div key={f.id} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-2">
                    {f.direction === "in" ? (
                      <ArrowDownRight size={12} className="text-emerald-600" />
                    ) : (
                      <ArrowUpRight size={12} className="text-orange-500" />
                    )}
                    <span className="font-bold">{f.counterparty_label || f.asset}</span>
                  </div>
                  <span className="font-black tabular-nums">${Number(f.amount_usd).toLocaleString()}</span>
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
