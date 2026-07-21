import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, ArrowDownRight, ArrowUpRight, Loader2, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Flow {
  id: string;
  direction: "in" | "out";
  asset: string;
  amount_usd: number;
  counterparty_label: string | null;
  recorded_at: string;
  entry_type: string;
}

// Ingress = corporate capitalization into the synapse credit pool.
// Egress = data-purchase, escrow, adjustment, or payout drain.
const INGRESS_TYPES = new Set(["deposit", "credit", "revenue", "top_up"]);

// Strip UUIDs AND long hex strings (0x… wallet addresses, tx hashes) so the
// public Atomic Settlements feed never leaks a user GUID or on-chain identity.
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const LONG_HEX_RE = /\b0x[0-9a-f]{16,}\b/gi;
const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;

const entryTypeFallback = (entryType: string): string => {
  const t = (entryType || "").toLowerCase();
  if (t === "deposit" || t === "credit" || t === "revenue" || t === "top_up") return "Corporate Capitalization";
  if (t === "usage" || t === "debit" || t === "data_purchase") return "Enterprise Data Purchase";
  if (t === "escrow") return "Validator Security Fee";
  if (t === "adjustment" || t === "split" || t === "payout") return "Sovereign Pool Dividend";
  return "Network Settlement";
};

const sanitizeCounterparty = (label: string | null, entryType: string): string => {
  const fallback = entryTypeFallback(entryType);
  if (!label) return fallback;
  const cleaned = label
    .replace(UUID_RE, "")
    .replace(LONG_HEX_RE, "")
    .replace(EMAIL_RE, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\[\s*\]/g, "")
    .replace(/[:\s\-–—]+$/g, "")
    .trim();
  return cleaned.length ? cleaned : fallback;
};

const TreasuryFlows: React.FC = () => {
  const [flows, setFlows] = useState<Flow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchFlows = async () => {
      console.log("[GLOBAL_TREASURY_FLOWS] START: Initializing multi-tenant ledger aggregation pass.");
      try {
        const { data, error } = await (supabase as any).rpc("governance_global_treasury_flows");

        if (error) throw error;

        const normalized: Flow[] = ((data as any[]) || []).map((row) => {
          const entryType = String(row.entry_type ?? "").toLowerCase();
          const direction: "in" | "out" = INGRESS_TYPES.has(entryType) ? "in" : "out";
          const meta = (row.metadata ?? {}) as Record<string, any>;
          return {
            id: row.id,
            direction,
            asset: (meta.asset as string) ?? "SYN",
            amount_usd: Math.abs(Number(row.amount ?? 0)),
            counterparty_label: row.description ?? null,
            recorded_at: row.created_at,
            entry_type: entryType,
          };
        });

        if (isMounted) {
          console.log(
            `[GLOBAL_TREASURY_FLOWS] SUCCESS: Gathered total transaction entities for graph matrix extrapolation. count=${normalized.length}`,
          );
          setFlows(normalized);
        }
      } catch (err: any) {
        console.log("[GLOBAL_TREASURY_FLOWS] CRITICAL_FAILURE: Global telemetry bridge stalled. Reason: " + err.message);
        toast({
          title: "Treasury Sync Failed",
          description: "Could not retrieve global ledger telemetry.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchFlows();

    console.log("[GLOBAL_TREASURY_FLOWS] SOCKET_START: Listening for aggregate network modifications on synapse channels.");
    const ch = supabase
      .channel("global_synapse_ledger_telemetry")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "synapse_credit_ledger" },
        () => {
          console.log("[GLOBAL_TREASURY_FLOWS] SOCKET_EVENT: Aggregate ledger mutation detected. Re-extrapolating…");
          fetchFlows();
        },
      )
      .subscribe((status) => {
        console.log(`[GLOBAL_TREASURY_FLOWS] SOCKET_STATUS: Synapse socket state -> ${status}`);
      });

    return () => {
      isMounted = false;
      console.log("[GLOBAL_TREASURY_FLOWS] SOCKET_CLOSE: Tearing down aggregate synapse listener.");
      supabase.removeChannel(ch);
    };
  }, []);

  const series = React.useMemo(() => {
    const buckets: Record<string, { day: string; in: number; out: number }> = {};
    [...flows].reverse().forEach((f) => {
      const day = new Date(f.recorded_at).toISOString().slice(5, 10);
      if (!buckets[day]) buckets[day] = { day, in: 0, out: 0 };
      buckets[day][f.direction] += f.amount_usd;
    });
    return Object.values(buckets);
  }, [flows]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-teal-50 dark:bg-card dark:border-teal-900/40 shadow-sm overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <p className="text-[9px] font-black uppercase tracking-widest text-teal-700/50">
            Aggregating Global Ledger…
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-teal-50 dark:bg-card dark:border-teal-900/40 shadow-sm overflow-hidden transition-all">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-teal-50/50 dark:border-teal-900/40 pb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-800 dark:text-teal-200 flex items-center gap-2">
            <TrendingUp size={14} className="text-teal-600 dark:text-teal-300" />
            Global Treasury Flows · 30D Window
          </h3>
          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-muted-foreground">Synapse Credits</div>
        </div>

        {series.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 opacity-40 space-y-2">
            <Activity className="w-8 h-8 text-slate-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No Ledger Activity in Window</p>
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
                  <YAxis yAxisId="in" hide domain={[0, "dataMax"]} />
                  <YAxis yAxisId="out" hide orientation="right" domain={[0, "dataMax"]} />
                  <Tooltip
                    contentStyle={{
                      fontSize: 11,
                      borderRadius: 12,
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      color: "hsl(var(--popover-foreground))",
                      boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                    }}
                    itemStyle={{ fontWeight: 800, color: "hsl(var(--popover-foreground))" }}
                  />
                  <Area yAxisId="in" type="monotone" dataKey="in" name="Ingress" stroke="hsl(178,42%,32%)" strokeWidth={2} fill="url(#gIn)" />
                  <Area yAxisId="out" type="monotone" dataKey="out" name="Egress" stroke="#f97316" strokeWidth={2} fill="url(#gOut)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2 pt-4 border-t border-teal-50 dark:border-teal-900/40">
              <p className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground mb-2">
                Recent Atomic Settlements
              </p>
              {flows.slice(0, 5).map((f) => (
                <div
                  key={f.id}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-transparent hover:border-slate-100 dark:hover:border-border hover:bg-slate-50 dark:hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "p-1.5 rounded-lg",
                        f.direction === "in"
                          ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300"
                          : "bg-orange-50 dark:bg-orange-950/40 text-orange-500 dark:text-orange-300",
                      )}
                    >
                      {f.direction === "in" ? <ArrowDownRight size={14} /> : <ArrowUpRight size={14} />}
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 dark:text-foreground block">
                        {sanitizeCounterparty(f.counterparty_label, f.entry_type)}
                      </span>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-muted-foreground block">
                        {new Date(f.recorded_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "font-black tracking-tighter",
                      f.direction === "in" ? "text-emerald-700 dark:text-emerald-300" : "text-slate-700 dark:text-foreground",
                    )}
                  >
                    {f.direction === "in" ? "+" : "-"}
                    {f.amount_usd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
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
