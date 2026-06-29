// hat-reattest — Officer re-attests continued service on one of their own hats.
// Resets last_attested_at. If the hat is currently `grayed`, flips back to `active`.

import { createClient } from "npm:@supabase/supabase-js@2";
import { recordACA } from "../_shared/recordACA.ts";

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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { hat_id, statement, aca_hash, aca_payload } = body || {};
    if (typeof hat_id !== "string" || typeof statement !== "string" || statement.trim().length < 50
        || typeof aca_hash !== "string" || !aca_payload) {
      return new Response(JSON.stringify({ error: "Missing: hat_id, statement (≥50 chars), aca_hash, aca_payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      return new Response(JSON.stringify({ error: "Invalid ACA hash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: hat, error: hatErr } = await admin
      .from("dao_hats")
      .select("id, user_id, eligibility_status, revoked_at")
      .eq("id", hat_id)
      .maybeSingle();
    if (hatErr || !hat) {
      return new Response(JSON.stringify({ error: "Hat not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (hat.user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Cannot re-attest someone else's hat" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (hat.revoked_at) {
      return new Response(JSON.stringify({ error: "Hat already revoked — re-apply instead" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: Record<string, unknown> = {
      last_attested_at: new Date().toISOString(),
    };
    if (hat.eligibility_status === "grayed") update.eligibility_status = "active";

    const { error: updErr } = await admin.from("dao_hats").update(update).eq("id", hat_id);
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_HAT_REATTEST",
        consentType: "HAT_REATTEST_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[HAT_REATTEST] ACA mirror skipped:", (e as Error).message);
    }

    console.log("[HAT_REATTEST] OK", { caller: callerId, hat_id });
    return new Response(JSON.stringify({ ok: true, hat_id, restored: hat.eligibility_status === "grayed" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[HAT_REATTEST] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
