// gov-escalate-motion — Bring a committee-passed draft motion to the DAO-wide floor.
// Requires: caller is L2+ (oversight_chair OR tophat), motion is in 'draft' phase,
// and signature_count(endorse) >= committee_quorum_required.

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

    const { data: callerHats } = await admin
      .from("dao_hats")
      .select("hat_type")
      .eq("user_id", callerId)
      .eq("eligibility_status", "active")
      .is("revoked_at", null)
      .in("hat_type", ["tophat", "oversight_chair"]);
    if (!callerHats || callerHats.length === 0) {
      return new Response(
        JSON.stringify({ error: "Insufficient authority — Oversight Chair (L2) or Steward (L3) required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { proposal_id, aca_hash, aca_payload, on_chain_id, tx_hash, on_chain_block } = body || {};
    if (typeof proposal_id !== "string" || typeof aca_hash !== "string" || !aca_payload) {
      return new Response(JSON.stringify({ error: "Missing: proposal_id, aca_hash, aca_payload" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof on_chain_id !== "string" || on_chain_id.length === 0) {
      return new Response(JSON.stringify({ error: "Missing on_chain_id — client must anchor on Governor before escalate" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (typeof tx_hash !== "string" || !/^0x[a-f0-9]{64}$/i.test(tx_hash)) {
      return new Response(JSON.stringify({ error: "Invalid tx_hash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      return new Response(JSON.stringify({ error: "Invalid ACA hash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: prop, error: propErr } = await admin
      .from("dao_proposals")
      .select("id, committee_id, lifecycle_phase, committee_quorum_required")
      .eq("id", proposal_id)
      .maybeSingle();
    if (propErr || !prop) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (prop.lifecycle_phase !== "draft") {
      return new Response(JSON.stringify({ error: `Cannot escalate; phase is ${prop.lifecycle_phase}` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { count: endorseCount } = await admin
      .from("proposal_signatures")
      .select("*", { count: "exact", head: true })
      .eq("proposal_id", proposal_id)
      .eq("signature_type", "endorse");

    const required = prop.committee_quorum_required ?? 3;
    if ((endorseCount ?? 0) < required) {
      return new Response(
        JSON.stringify({ error: `Committee quorum not met: ${endorseCount}/${required} endorsements` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const nowIso = new Date().toISOString();
    const endIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updErr } = await admin
      .from("dao_proposals")
      .update({
        lifecycle_phase: "active",
        status: "active",
        on_chain_id,
        tx_hash,
        on_chain_block: typeof on_chain_block === "number" ? on_chain_block : null,
        escalated_at: nowIso,
        escalated_by: callerId,
        end_date: endIso,
      })
      .eq("id", proposal_id)
      .eq("lifecycle_phase", "draft");
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_MOTION_ESCALATE",
        consentType: "MOTION_ESCALATE_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[GOV_ESCALATE_MOTION] ACA mirror skipped:", (e as Error).message);
    }

    console.log("[GOV_ESCALATE_MOTION] OK", { caller: callerId, proposal_id });
    return new Response(JSON.stringify({ ok: true, proposal_id, vote_ends_at: endIso }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[GOV_ESCALATE_MOTION] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
