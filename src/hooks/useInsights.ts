import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { stage } from "@/lib/stageLogger";

export type InsightsTier = "pro" | "pro_plus" | "pure_alpha";

export interface InsightsForecast {
  stress_24h: number;
  fatigue_24h: number;
  confidence: number;
  summary: string;
}
export interface InsightsTrend {
  metric: string;
  window: string;
  slope: string;
  interpretation: string;
}
export interface InsightsRecommendation {
  title: string;
  body: string;
  evidence_refs?: string[];
}
export interface InsightsIntervention {
  trigger: string;
  action: string;
  urgency: string;
}
export interface InsightsCoaching {
  plan_name: string;
  weekly_focus: string;
  actions: string[];
}
export interface InsightsClinicalReport {
  headline: string;
  findings_markdown: string;
  red_flags?: string[];
}
export interface InsightsCohort {
  cohort_label: string;
  percentile_summary: string;
  callouts?: string[];
}

export interface InsightsPayload {
  forecast: InsightsForecast;
  trends: InsightsTrend[];
  recommendation: InsightsRecommendation;
  intervention: InsightsIntervention;
  coaching?: InsightsCoaching;
  clinical_report?: InsightsClinicalReport;
  cohort?: InsightsCohort;
}

export interface InsightsResult {
  payload: InsightsPayload | null;
  empty: boolean;
  loading: boolean;
  error: string | null;
  generatedAt: string | null;
  tier: InsightsTier;
  refresh: () => void;
}

export function useInsights(tier: InsightsTier): InsightsResult {
  const [payload, setPayload] = useState<InsightsPayload | null>(null);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const debounceRef = useRef<number | null>(null);

  const fetchOnce = useCallback(async () => {
    const s = stage("INSIGHTS", "FETCH");
    s.start({ tier });
    setLoading(true);
    setError(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "predictive-insights",
        { body: { tier } },
      );
      if (invokeErr) throw invokeErr;
      if ((data as any)?.error) throw new Error((data as any).error);
      if ((data as any)?.empty) {
        setEmpty(true);
        setPayload(null);
        setGeneratedAt(null);
        s.ok({ empty: true });
      } else {
        setEmpty(false);
        setPayload((data as any).payload);
        setGeneratedAt((data as any).generated_at ?? null);
        s.ok({ from_cache: (data as any).from_cache });
      }
    } catch (e: any) {
      setError(e?.message ?? "Failed to load insights");
      s.fail(e);
    } finally {
      setLoading(false);
    }
  }, [tier]);

  // Initial + tier-change fetch.
  useEffect(() => {
    fetchOnce();
  }, [fetchOnce]);

  // Realtime: re-fetch shortly after new staged_health_data lands.
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (cancelled || !u?.user) return;
      channel = supabase
        .channel(`insights_pulse_${u.user.id}`)
        .on(
          "postgres_changes" as any,
          { event: "INSERT", schema: "public", table: "staged_health_data" },
          () => {
            if (debounceRef.current) window.clearTimeout(debounceRef.current);
            debounceRef.current = window.setTimeout(() => fetchOnce(), 60_000);
          },
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [fetchOnce]);

  return {
    payload,
    empty,
    loading,
    error,
    generatedAt,
    tier,
    refresh: fetchOnce,
  };
}
