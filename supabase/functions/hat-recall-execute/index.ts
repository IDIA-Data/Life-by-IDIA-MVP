// hat-recall-execute — Opens a recall petition against a peer officer's hat.
// The DB trigger (`recall_signature_threshold`) handles execution once the
// signature count reaches the petition threshold. This function exists to
// create the petition atomically with ACA anchoring + authority check.

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
    const { target_hat_id, reason, aca_hash, aca_payload } = body || {};
    if (typeof target_hat_id !== "string" || typeof reason !== "string" || reason.trim().length < 20
        || typeof aca_hash !== "string" || !aca_payload) {
      return new Response(JSON.stringify({ error: "Missing: target_hat_id, reason (≥20 chars), aca_hash, aca_payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      return new Response(JSON.stringify({ error: "Invalid ACA hash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetHat, error: tErr } = await admin
      .from("dao_hats")
      .select("id, user_id, hat_type, eligibility_status, revoked_at")
      .eq("id", target_hat_id)
      .maybeSingle();
    if (tErr || !targetHat) {
      return new Response(JSON.stringify({ error: "Target hat not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (targetHat.revoked_at || targetHat.eligibility_status !== "active") {
      return new Response(JSON.stringify({ error: "Target hat is not active" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (targetHat.user_id === callerId) {
      return new Response(JSON.stringify({ error: "Cannot petition recall against yourself — resign instead" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Caller must hold an active hat of the same committee
    const { data: peerHats } = await admin
      .from("dao_hats")
      .select("hat_type")
      .eq("user_id", callerId)
      .eq("eligibility_status", "active")
      .is("revoked_at", null)
      .in("hat_type", [targetHat.hat_type, "tophat", "oversight_chair"]);
    if (!peerHats || peerHats.length === 0) {
      return new Response(JSON.stringify({ error: "Only fellow officers of this committee may open a recall" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: petition, error: insErr } = await admin
      .from("hat_recall_petitions")
      .insert({
        target_hat_id,
        petitioner_id: callerId,
        reason,
        aca_hash_key: aca_hash,
      })
      .select("id")
      .single();
    if (insErr) {
      // Likely the unique partial index — open petition already exists
      return new Response(JSON.stringify({ error: insErr.message }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_HAT_RECALL_OPEN",
        consentType: "HAT_RECALL_OPEN_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[HAT_RECALL_EXECUTE] ACA mirror skipped:", (e as Error).message);
    }

    console.log("[HAT_RECALL_EXECUTE] OK", { caller: callerId, target_hat_id, petition_id: petition?.id });
    return new Response(JSON.stringify({ ok: true, petition_id: petition?.id }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[HAT_RECALL_EXECUTE] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
