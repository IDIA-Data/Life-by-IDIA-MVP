// supabase/functions/submit-connection-rating/index.ts
// Validates a 1–5 star rating from one Connection to another, writes it,
// and applies a small Trust Score delta to the ratee per the IDIA Protocol.
//
// DELT Protocol: generates an ACA hash for the egress event.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Fuzzy key matching per project standard
function getEnv(...names: string[]): string {
  for (const n of names) {
    const v = Deno.env.get(n);
    if (v) return v;
  }
  return "";
}

const SUPABASE_URL = getEnv("SUPABASE_URL", "VITE_SUPABASE_URL");
const SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY");
const ANON_KEY = getEnv("SUPABASE_ANON_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY");

// Star → trust_score delta (small, bounded — feeds the IDIA recalc)
const DELTA_BY_STARS: Record<number, number> = {
  1: -8,
  2: -3,
  3: 0,
  4: +3,
  5: +8,
};

async function generateAcaHash(payload: string): Promise<string> {
  const data = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("[SUBMIT_RATING_START]");

    if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
      throw new Error("Server misconfigured");
    }

    // --- AuthN: validate the caller JWT --------------------------------
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const raterId = userData.user.id;

    // --- Input validation ---------------------------------------------
    const body = await req.json().catch(() => ({}));
    const rateeId = String(body?.ratee_id ?? "").trim();
    const stars = Number(body?.stars);

    if (!/^[0-9a-f-]{36}$/i.test(rateeId)) {
      return new Response(JSON.stringify({ error: "Invalid ratee_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      return new Response(JSON.stringify({ error: "Stars must be an integer 1-5" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rateeId === raterId) {
      return new Response(JSON.stringify({ error: "Cannot rate yourself" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Service-role client for write + score update ------------------
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` } },
    });

    // Insert the rating row (Zero-PII: only UUIDs + integer)
    const { error: insertErr } = await admin
      .from("connection_ratings")
      .insert({ rater_id: raterId, ratee_id: rateeId, stars });

    if (insertErr) {
      console.log("[SUBMIT_RATING_INSERT_ERROR]", insertErr);
      return new Response(JSON.stringify({ error: "Could not save rating" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Apply trust_score delta to the ratee (bounded 0..999)
    const delta = DELTA_BY_STARS[stars] ?? 0;
    let newScore: number | null = null;
    if (delta !== 0) {
      const { data: prof } = await admin.from("profiles").select("trust_score").eq("user_id", rateeId).maybeSingle();

      const current = Number(prof?.trust_score ?? 0);
      newScore = Math.max(0, Math.min(999, current + delta));
      await admin
        .from("profiles")
        .update({ trust_score: newScore, updated_at: new Date().toISOString() })
        .eq("user_id", rateeId);

      // Snapshot for the trend chart
      await admin.from("trust_score_history").insert({ user_id: rateeId, score: newScore });
    }

    // DELT Protocol: ACA hash for the egress
    const aca = await generateAcaHash(`${raterId}|${rateeId}|${stars}|${Date.now()}`);

    console.log("[SUBMIT_RATING_END]", { stars, delta, aca: aca.slice(0, 12) });

    return new Response(
      JSON.stringify({
        ok: true,
        stars,
        applied_delta: delta,
        new_score: newScore,
        aca_hash_key: aca,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("[SUBMIT_RATING_FATAL]", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
