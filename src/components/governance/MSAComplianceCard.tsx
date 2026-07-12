import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Loader2, Zap, RefreshCw } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type ChannelId = "bundles" | "api_mcp" | "best_friend_ai" | "egress";
type Sample = { ts: number; ms: number };

interface ChannelRow {
  id: ChannelId;
  sla_name: string;
  target_value: number;
  current_value: number | null;
  sample_count: number;
  status: "meeting" | "warning" | "breach" | "idle";
}

// Per-channel SLA budget (ms). Tune as the live data calibrates.
const SLA_BUDGET_MS: Record<ChannelId, number> = {
  bundles: 2000,
  api_mcp: 500,
  best_friend_ai: 250,
  egress: 1500,
};

const CHANNEL_LABELS: Record<ChannelId, string> = {
  bundles: "Marketplace Bundles",
  api_mcp: "API & MCP Gateways",
  best_friend_ai: "Best Friend AI",
  egress: "Global Egress Delivery",
};

// Per-channel chart stroke + gradient color (HSL friendly to teal/amber palette).
const CHANNEL_COLOR: Record<ChannelId, string> = {
  bundles: "hsl(178,42%,42%)",
  api_mcp: "#0ea5e9",
  best_friend_ai: "#a855f7",
  egress: "#f97316",
};

const WINDOW_MS = 30 * 86400_000;

/**
 * Parse a Postgres `interval` value as returned by PostgREST into milliseconds.
 * PostgREST returns intervals as strings — most commonly the ISO 8601 form
 * (e.g. "PT1.234S", "PT2M3.5S") or the legacy "HH:MM:SS.fff" form. We handle
 * both, plus a plain numeric fallback (seconds).
 */
const parseDurationToMs = (raw: unknown): number => {
  if (raw == null) return 0;
  if (typeof raw === "number") return raw * 1000; // assume seconds
  const s = String(raw).trim();
  if (!s) return 0;

  // ISO 8601 duration: PnYnMnDTnHnMnS — we only care about H/M/S
  if (/^P/i.test(s)) {
    const m = s.match(/T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?/i);
    if (m) {
      const h = parseFloat(m[1] || "0");
      const min = parseFloat(m[2] || "0");
      const sec = parseFloat(m[3] || "0");
      return (h * 3600 + min * 60 + sec) * 1000;
    }
  }

  // HH:MM:SS(.fff)
  const hms = s.match(/^(\d+):(\d+):(\d+(?:\.\d+)?)$/);
  if (hms) {
    return (parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseFloat(hms[3])) * 1000;
  }

  // Plain numeric — interpret as seconds
  const n = parseFloat(s);
  return Number.isFinite(n) ? n * 1000 : 0;
};

const dotColor = (s: ChannelRow["status"]) =>
  s === "meeting"
    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
    : s === "warning"
      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse"
      : s === "breach"
        ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse"
        : "bg-slate-400";

const textColor = (s: ChannelRow["status"]) =>
  s === "meeting"
    ? "text-emerald-700 dark:text-emerald-300"
    : s === "warning"
      ? "text-amber-700 dark:text-amber-300"
      : s === "breach"
        ? "text-red-700 dark:text-red-300"
        : "text-slate-500 dark:text-muted-foreground";

const statusLabel = (s: ChannelRow["status"]) =>
  s === "meeting"
    ? "Optimal"
    : s === "warning"
      ? "Latency Drift"
      : s === "breach"
        ? "SLA Breach"
        : "No Samples";

const statusFor = (avg: number | null, target: number, samples: number): ChannelRow["status"] => {
  if (!samples || avg == null) return "idle";
  if (avg > target * 1.5) return "breach";
  if (avg > target) return "warning";
  return "meeting";
};

type SamplesByChannel = Record<ChannelId, Sample[]>;
const EMPTY_SAMPLES: SamplesByChannel = { bundles: [], api_mcp: [], best_friend_ai: [], egress: [] };

const MSAComplianceCard: React.FC = () => {
  const [samples, setSamples] = useState<SamplesByChannel>(EMPTY_SAMPLES);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const fetchMetrics = useCallback(async (showToast: boolean = false) => {
    if (showToast) setIsRefreshing(true);
    console.log("[ORACLE_TELEMETRY][SHARED_SCHEMA][START] Syncing multi-tenant delivery latency profiles from live tables.");

    const since = new Date(Date.now() - WINDOW_MS).toISOString();

    try {
      const [bundlesRes, apiMcpRes, bfaiRes, egressRes] = await Promise.all([
        supabase
          .from("bundle_generation_logs" as any)
          .select("id, processing_duration, created_at")
          .gte("created_at", since)
          .limit(1000),
        supabase
          .from("api_metrics" as any)
          .select("id, endpoint, latency_ms, status_code, timestamp")
          .in("endpoint", ["mcp-gateway", "sql-endpoint"])
          .gte("timestamp", since)
          .limit(1000),
        supabase
          .from("api_metrics" as any)
          .select("id, endpoint, latency_ms, status_code, timestamp")
          .eq("endpoint", "best-friend-ai")
          .gte("timestamp", since)
          .limit(1000),
        (supabase as any).rpc("governance_global_egress_latency", { p_since: since }),
      ]);

      if (bundlesRes.error) throw bundlesRes.error;
      if (apiMcpRes.error) throw apiMcpRes.error;
      if (bfaiRes.error) throw bfaiRes.error;
      if (egressRes.error) throw egressRes.error;

      const toSample = (tsRaw: any, ms: number): Sample | null => {
        if (!Number.isFinite(ms) || ms <= 0 || !tsRaw) return null;
        const ts = new Date(tsRaw).getTime();
        if (!Number.isFinite(ts)) return null;
        return { ts, ms };
      };

      const bundleSamples: Sample[] = ((bundlesRes.data as any[]) || [])
        .map((row) => toSample(row.created_at, parseDurationToMs(row.processing_duration)))
        .filter((s): s is Sample => s !== null);

      const apiMcpSamples: Sample[] = ((apiMcpRes.data as any[]) || [])
        .map((row) => toSample(row.timestamp, Number(row.latency_ms ?? 0)))
        .filter((s): s is Sample => s !== null);

      const bfaiSamples: Sample[] = ((bfaiRes.data as any[]) || [])
        .map((row) => toSample(row.timestamp, Number(row.latency_ms ?? 0)))
        .filter((s): s is Sample => s !== null);

      const egressSamples: Sample[] = ((egressRes.data as any[]) || [])
        .map((row) => {
          if (!row.settled_at || !row.created_at) return null;
          const ms = new Date(row.settled_at).getTime() - new Date(row.created_at).getTime();
          return toSample(row.created_at, ms);
        })
        .filter((s): s is Sample => s !== null);

      console.log("[ORACLE_TELEMETRY][SHARED_SCHEMA][SUCCESS] Performance profiles calculated successfully.");
      setSamples({
        bundles: bundleSamples,
        api_mcp: apiMcpSamples,
        best_friend_ai: bfaiSamples,
        egress: egressSamples,
      });
    } catch (err: any) {
      console.error("[ORACLE_TELEMETRY][SHARED_SCHEMA][CRITICAL_FAILURE] Latency collection pass stalled: ", err?.message ?? err);
      if (showToast) {
        toast({
          title: "Telemetry Sync Failed",
          description: "Could not retrieve shared-schema delivery telemetry.",
          variant: "destructive",
        });
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const items = useMemo<ChannelRow[]>(() => {
    const avg = (arr: Sample[]) =>
      arr.length ? arr.reduce((a, b) => a + b.ms, 0) / arr.length : null;
    return (["bundles", "api_mcp", "best_friend_ai", "egress"] as ChannelId[]).map((id) => {
      const arr = samples[id] ?? [];
      const a = avg(arr);
      const target = SLA_BUDGET_MS[id];
      return {
        id,
        sla_name: CHANNEL_LABELS[id],
        target_value: target,
        current_value: a,
        sample_count: arr.length,
        status: statusFor(a, target, arr.length),
      };
    });
  }, [samples]);

  // Per-channel daily-averaged time series for the 30D window. Empty buckets
  // are omitted so AreaChart doesn't draw flat zero baselines across gaps.
  const seriesByChannel = useMemo<Record<ChannelId, { day: string; ms: number }[]>>(() => {
    const out: Record<ChannelId, { day: string; ms: number }[]> = {
      bundles: [], api_mcp: [], best_friend_ai: [], egress: [],
    };
    (Object.keys(samples) as ChannelId[]).forEach((id) => {
      const buckets: Record<string, { sum: number; n: number }> = {};
      samples[id].forEach((s) => {
        const day = new Date(s.ts).toISOString().slice(5, 10);
        if (!buckets[day]) buckets[day] = { sum: 0, n: 0 };
        buckets[day].sum += s.ms;
        buckets[day].n += 1;
      });
      out[id] = Object.entries(buckets)
        .map(([day, { sum, n }]) => ({ day, ms: sum / n }))
        .sort((a, b) => a.day.localeCompare(b.day));
    });
    return out;
  }, [samples]);




  useEffect(() => {
    fetchMetrics();

    const scheduleRefetch = (source: string) => {
      console.log(`[ORACLE_TELEMETRY][SHARED_SCHEMA][SOCKET_EVENT] source=${source}. Debounced re-aggregation queued.`);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => fetchMetrics(), 2000);
    };

    console.log("[ORACLE_TELEMETRY][SHARED_SCHEMA][SOCKET_START] Subscribing to bundle_generation_logs, egress_logs, api_metrics.");
    const ch = supabase
      .channel("global_oracle_telemetry_shared_schema")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "bundle_generation_logs" },
        () => scheduleRefetch("bundle_generation_logs"),
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "egress_logs" },
        () => scheduleRefetch("egress_logs"),
      )
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "api_metrics" },
        () => scheduleRefetch("api_metrics"),
      )
      .subscribe((status) => {
        console.log(`[ORACLE_TELEMETRY][SHARED_SCHEMA][SOCKET_STATUS] Shared-schema socket state -> ${status}`);
      });

    return () => {
      console.log("[ORACLE_TELEMETRY][SHARED_SCHEMA][SOCKET_CLOSE] Tearing down shared-schema listener.");
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      supabase.removeChannel(ch);
    };
  }, [fetchMetrics]);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-teal-50 dark:bg-card dark:border-teal-900/40 shadow-sm overflow-hidden min-h-[200px] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
      </Card>
    );
  }

  const totalSamples = items.reduce((a, r) => a + r.sample_count, 0);

  return (
    <Card className="rounded-3xl border-teal-50 dark:bg-card dark:border-teal-900/40 shadow-sm overflow-hidden transition-all">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-teal-50/50 dark:border-teal-900/40 pb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-800 dark:text-teal-200 flex items-center gap-2">
            <Zap size={14} className="text-teal-600 dark:text-teal-300" />
            Oracle Telemetry · Shared Schema · 30D
          </h3>
          <button
            onClick={() => fetchMetrics(true)}
            className="text-teal-600 hover:text-teal-800 transition-colors"
          >
            <RefreshCw size={12} className={cn(isRefreshing && "animate-spin")} />
          </button>
        </div>

        {totalSamples === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 opacity-40 space-y-2">
            <Activity className="w-8 h-8 text-slate-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">No Channel Samples in 30D Window</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((m) => {
              const series = seriesByChannel[m.id];
              const color = CHANNEL_COLOR[m.id];
              const gradId = `oracleArea_${m.id}`;
              return (
                <div
                  key={m.id}
                  className={cn(
                    "p-3 rounded-xl border transition-colors space-y-2",
                    m.status === "meeting"
                      ? "bg-teal-50/30 dark:bg-teal-950/20 border-teal-50 dark:border-teal-900/40"
                      : m.status === "warning"
                        ? "bg-amber-50/30 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/40"
                        : m.status === "breach"
                          ? "bg-red-50/30 dark:bg-red-950/20 border-red-100 dark:border-red-900/40"
                          : "bg-slate-50/30 dark:bg-muted/20 border-slate-100 dark:border-border",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative flex items-center justify-center w-3 h-3">
                        <span className={cn("absolute w-2 h-2 rounded-full", dotColor(m.status))} />
                      </div>
                      <div className="space-y-0.5">
                        <span className={cn("text-xs font-bold block truncate max-w-[180px]", textColor(m.status))}>{m.sla_name}</span>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block">
                          Status: {statusLabel(m.status)} · n={m.sample_count}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black tracking-tighter text-slate-700 dark:text-foreground">
                        {m.current_value != null ? m.current_value.toFixed(1) : "—"}
                        <span className="text-[10px] text-slate-400 dark:text-muted-foreground font-medium tracking-normal">
                          {" "}ms / SLA: {m.target_value}
                        </span>
                      </div>
                      <div className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground">
                        Shared Schema Feed
                      </div>
                    </div>
                  </div>

                  {series.length >= 2 ? (
                    <div className="h-20 -mx-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                          <defs>
                            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity={0.55} />
                              <stop offset="100%" stopColor={color} stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="day"
                            tick={{ fontSize: 8, fill: "#94a3b8", fontWeight: 700 }}
                            stroke="transparent"
                            tickMargin={4}
                            interval="preserveStartEnd"
                            minTickGap={24}
                          />
                          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, m.target_value) * 1.1]} />
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
                            formatter={(v: any) => [`${Number(v).toFixed(1)} ms`, "Avg Latency"]}
                          />
                          <ReferenceLine
                            y={m.target_value}
                            stroke="#94a3b8"
                            strokeDasharray="3 3"
                            strokeWidth={1}
                          />
                          <Area
                            type="monotone"
                            dataKey="ms"
                            name="Avg Latency"
                            stroke={color}
                            strokeWidth={2}
                            fill={`url(#${gradId})`}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="h-20 flex items-center justify-center">
                      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 dark:text-muted-foreground">
                        {series.length === 1 ? "Single Sample · Awaiting Trend" : "No Trend Data"}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

        )}
      </CardContent>
    </Card>
  );
};

export default MSAComplianceCard;
