// Live AI predictive insights for the Pro tier dashboards.
// Reads from staged_health_data + raw_health_data, optionally augments with
// governance/wallet activity timestamps, and returns a tier-shaped payload.
// NO MOCK DATA. If there is nothing in the pipeline, returns { empty: true }.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.5";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Tier = "pro" | "pro_plus" | "pure_alpha";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function summarizeStaged(rows: any[]) {
  if (!rows.length) return null;
  const num = (v: any) => (typeof v === "number" && !Number.isNaN(v) ? v : null);
  const avg = (key: string) => {
    const vals = rows.map((r) => num(r[key])).filter((v) => v !== null) as number[];
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  };
  const trend = (key: string) => {
    const vals = rows.map((r) => num(r[key])).filter((v) => v !== null) as number[];
    if (vals.length < 4) return null;
    const half = Math.floor(vals.length / 2);
    const first = vals.slice(0, half).reduce((a, b) => a + b, 0) / half;
    const last = vals.slice(half).reduce((a, b) => a + b, 0) / (vals.length - half);
    return last - first;
  };
  return {
    sample_count: rows.length,
    window_days: 30,
    hrv_ms_avg: avg("heart_rate_variability_ms"),
    hrv_ms_trend: trend("heart_rate_variability_ms"),
    resting_hr_avg: avg("heart_rate"),
    resting_hr_trend: trend("heart_rate"),
    respiratory_avg: avg("respiratory_rate"),
    audio_exposure_db_avg: avg("environmental_audio_exposure_db"),
    walking_asymmetry_pct_avg: avg("walking_asymmetry_percentage"),
    walking_asymmetry_pct_trend: trend("walking_asymmetry_percentage"),
    data_quality_avg: avg("data_quality_score"),
    last_recorded_at: rows[0]?.recorded_at ?? rows[0]?.created_at ?? null,
  };
}

function tierSchema(tier: Tier) {
  const base: any = {
    type: "object",
    properties: {
      forecast: {
        type: "object",
        properties: {
          stress_24h: { type: "number" },
          fatigue_24h: { type: "number" },
          confidence: { type: "number" },
          summary: { type: "string" },
        },
        required: ["stress_24h", "fatigue_24h", "confidence", "summary"],
      },
      trends: {
        type: "array",
        items: {
          type: "object",
          properties: {
            metric: { type: "string" },
            window: { type: "string" },
            slope: { type: "string" },
            interpretation: { type: "string" },
          },
          required: ["metric", "window", "slope", "interpretation"],
        },
      },
      recommendation: {
        type: "object",
        properties: {
          title: { type: "string" },
          body: { type: "string" },
          evidence_refs: { type: "array", items: { type: "string" } },
        },
        required: ["title", "body"],
      },
      intervention: {
        type: "object",
        properties: {
          trigger: { type: "string" },
          action: { type: "string" },
          urgency: { type: "string" },
        },
        required: ["trigger", "action", "urgency"],
      },
    },
    required: ["forecast", "trends", "recommendation", "intervention"],
  };

  if (tier === "pro_plus" || tier === "pure_alpha") {
    base.properties.coaching = {
      type: "object",
      properties: {
        plan_name: { type: "string" },
        weekly_focus: { type: "string" },
        actions: { type: "array", items: { type: "string" } },
      },
      required: ["plan_name", "weekly_focus", "actions"],
    };
    base.properties.clinical_report = {
      type: "object",
      properties: {
        headline: { type: "string" },
        findings_markdown: { type: "string" },
        red_flags: { type: "array", items: { type: "string" } },
      },
      required: ["headline", "findings_markdown"],
    };
    base.required.push("coaching", "clinical_report");
  }

  if (tier === "pure_alpha") {
    base.properties.cohort = {
      type: "object",
      properties: {
        cohort_label: { type: "string" },
        percentile_summary: { type: "string" },
        callouts: { type: "array", items: { type: "string" } },
      },
      required: ["cohort_label", "percentile_summary"],
    };
    base.required.push("cohort");
  }

  return base;
}

async function callGateway(tier: Tier, features: unknown, behavioral: unknown) {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY is not configured");
  }
  const schema = tierSchema(tier);
  const sys =
    "You are an explainable health-insights model. Given derived biometric features (no raw PII), output a strict JSON object matching the supplied tool schema. Be concrete, specific to the input numbers, and conservative — never invent values the features don't support. Stress and fatigue are 0-100 integers. Confidence is 0-1.";
  const userPrompt = JSON.stringify({ tier, features, behavioral });

  const res = await fetch(
    "https://ai.gateway.lovable.dev/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "emit_insights",
              description: "Emit tier-shaped predictive insight payload.",
              parameters: schema,
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "emit_insights" } },
      }),
    },
  );

  if (res.status === 429) {
    return { error: "rate_limited", status: 429 } as const;
  }
  if (res.status === 402) {
    return { error: "payment_required", status: 402 } as const;
  }
  if (!res.ok) {
    const body = await res.text();
    return { error: `gateway_${res.status}`, status: res.status, body } as const;
  }
  const data = await res.json();
  const call = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!call) return { error: "no_tool_call", status: 502 } as const;
  try {
    return { payload: JSON.parse(call) } as const;
  } catch {
    return { error: "bad_tool_json", status: 502 } as const;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  console.log("[INSIGHTS][INVOKE][START]");
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.toLowerCase().startsWith("bearer ")) {
      return json({ error: "unauthorized" }, 401);
    }
    const userJwt = authHeader.slice(7);

    // Service-role client for reads + cache writes
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    // User client purely to resolve auth.uid()
    const userClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${userJwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser(userJwt);
    if (userErr || !userData?.user) {
      console.error("[INSIGHTS][AUTH][END:FAIL]", userErr?.message);
      return json({ error: "unauthorized" }, 401);
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const requestedTier: Tier = (body?.tier as Tier) || "pro";

    // Re-validate tier server-side against user_subscriptions (never trust client).
    const { data: subRow } = await admin
      .from("user_subscriptions" as any)
      .select("tier")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const validTiers: Tier[] = ["pro", "pro_plus", "pure_alpha"];
    const subscriptionTier = (subRow as any)?.tier as Tier | undefined;
    // Effective tier = lowest of (requested, subscription, default pro). If no sub, base tier.
    const rank: Record<Tier, number> = { pro: 1, pro_plus: 2, pure_alpha: 3 };
    let effectiveTier: Tier = "pro";
    if (subscriptionTier && validTiers.includes(subscriptionTier)) {
      effectiveTier =
        rank[requestedTier] <= rank[subscriptionTier] ? requestedTier : subscriptionTier;
    } else {
      // No active subscription → base pro insights only.
      effectiveTier = "pro";
    }

    // Pull last 30d of staged_health_data via pseudonym.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: staged } = await admin
      .from("staged_health_data" as any)
      .select(
        "heart_rate, heart_rate_variability_ms, respiratory_rate, environmental_audio_exposure_db, walking_asymmetry_percentage, data_quality_score, recorded_at, created_at",
      )
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(500);

    // Raw count as freshness signal
    const { count: rawCount } = await admin
      .from("raw_health_data")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", since);

    const features = summarizeStaged((staged as any[]) || []);

    if (!features || (features.sample_count ?? 0) === 0) {
      console.log("[INSIGHTS][INVOKE][END:OK] empty");
      return json({ empty: true, tier: effectiveTier, raw_count: rawCount ?? 0 });
    }

    // Behavioral signal: recent governance + wallet activity counts (no PII).
    const [{ count: voteCount }, { count: txCount }] = await Promise.all([
      admin
        .from("votes" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", since),
      admin
        .from("transactions" as any)
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", since),
    ]);
    const behavioral = {
      window_days: 30,
      governance_actions: voteCount ?? 0,
      wallet_transactions: txCount ?? 0,
    };

    const sourceHash = await sha256Hex(
      JSON.stringify({ features, behavioral, tier: effectiveTier, model: MODEL }),
    );

    // Cache hit?
    const { data: cached } = await admin
      .from("insights_cache")
      .select("payload, generated_at")
      .eq("user_id", user.id)
      .eq("tier", effectiveTier)
      .eq("source_hash", sourceHash)
      .maybeSingle();
    if (cached) {
      console.log("[INSIGHTS][INVOKE][END:OK] cache_hit");
      return json({
        from_cache: true,
        tier: effectiveTier,
        generated_at: cached.generated_at,
        payload: cached.payload,
      });
    }

    const result = await callGateway(effectiveTier, features, behavioral);
    if ("error" in result) {
      console.error("[INSIGHTS][GATEWAY][END:FAIL]", result.error);
      const status = result.status ?? 502;
      const msg =
        result.error === "rate_limited"
          ? "Rate limits exceeded, please try again shortly."
          : result.error === "payment_required"
          ? "Lovable AI credits exhausted — add credits in workspace settings."
          : "AI gateway error";
      return json({ error: msg, code: result.error }, status);
    }

    const { error: insErr } = await admin.from("insights_cache").insert({
      user_id: user.id,
      tier: effectiveTier,
      payload: result.payload,
      source_hash: sourceHash,
      model: MODEL,
    });
    if (insErr) console.warn("[INSIGHTS][CACHE][WARN]", insErr.message);

    console.log("[INSIGHTS][INVOKE][END:OK] fresh");
    return json({
      from_cache: false,
      tier: effectiveTier,
      generated_at: new Date().toISOString(),
      payload: result.payload,
    });
  } catch (e) {
    console.error("[INSIGHTS][INVOKE][END:FAIL]", e instanceof Error ? e.message : e);
    return json({ error: e instanceof Error ? e.message : "unknown" }, 500);
  }
});
