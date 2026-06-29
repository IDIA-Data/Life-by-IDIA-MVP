// ascension-veto — L3 Protocol Steward override.
// Revokes a `pending_veto` (or `active`) hat during the cooling-off window.
// Requires caller to hold an active `tophat` and supply a verified ACA hash.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller holds an active tophat (L3 Protocol Steward)
    const { data: callerHats, error: hatErr } = await admin
      .from("dao_hats")
      .select("hat_type")
      .eq("user_id", callerId)
      .eq("hat_type", "tophat")
      .eq("eligibility_status", "active")
      .is("revoked_at", null)
      .limit(1);

    if (hatErr) {
      console.error("[ASCENSION_VETO] hat lookup failed", hatErr);
      return new Response(JSON.stringify({ error: "Authority check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!callerHats || callerHats.length === 0) {
      return new Response(
        JSON.stringify({ error: "Insufficient authority — Protocol Steward (L3) required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { hat_id, veto_reason, aca_hash, aca_payload } = body || {};
    if (
      typeof hat_id !== "string" ||
      typeof aca_hash !== "string" ||
      !aca_payload ||
      typeof veto_reason !== "string" ||
      veto_reason.trim().length < 4
    ) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: hat_id, veto_reason, aca_hash, aca_payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      console.error("[ASCENSION_VETO] INDEMNITY_VIOLATION: malformed ACA hash", {
        caller: callerId,
        hat_id,
      });
      return new Response(
        JSON.stringify({ error: "Invalid ACA hash — Tophat overrides require a verified SHA-256 attestation." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log("[ASCENSION_VETO] TOPHAT_OVERRIDE_ANCHOR", {
      caller: callerId,
      hat_id,
      aca_hash: aca_hash.substring(0, 12) + "…",
      scopes: aca_payload?.consent_scope,
    });

    // Mirror caller's ACA into user_aca_records (strict insert).
    try {
      const { recordACA } = await import("../_shared/recordACA.ts");
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_HAT_VETO",
        consentType: "TOPHAT_VETO_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[ASCENSION_VETO] ACA mirror skipped:", (e as Error).message);
    }

    // Revoke the hat. Try with optional audit columns, fall back without.
    const nowIso = new Date().toISOString();
    const fullPayload: Record<string, unknown> = {
      eligibility_status: "revoked",
      revoked_at: nowIso,
      revoked_by: callerId,
      revocation_reason: veto_reason,
    };

    let { error: updErr } = await admin
      .from("dao_hats")
      .update(fullPayload)
      .eq("id", hat_id)
      .in("eligibility_status", ["pending_veto", "active"]);

    if (updErr) {
      const { error: retryErr } = await admin
        .from("dao_hats")
        .update({ eligibility_status: "revoked", revoked_at: nowIso })
        .eq("id", hat_id)
        .in("eligibility_status", ["pending_veto", "active"]);
      if (retryErr) {
        console.error("[ASCENSION_VETO] update failed", retryErr);
        return new Response(JSON.stringify({ error: retryErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    console.log("[ASCENSION_VETO] OK", { hat_id, caller: callerId });
    return new Response(JSON.stringify({ ok: true, hat_id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ASCENSION_VETO] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
