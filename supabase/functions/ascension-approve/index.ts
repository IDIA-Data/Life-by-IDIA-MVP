// ascension-approve — L2/L3 reviewer approves a pending committee application.
// Marks committee_applications.status='approved' and provisions a dao_hats row
// in 'pending_veto' with a 72h veto window. Tophat (L3) or oversight_chair (L2)
// may approve. Application + hat are both ACA-anchored.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VETO_WINDOW_MS = 72 * 60 * 60 * 1000;

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

    // Authority check: tophat (L3) OR oversight_chair (L2)
    const { data: callerHats, error: hatErr } = await admin
      .from("dao_hats")
      .select("hat_type")
      .eq("user_id", callerId)
      .eq("eligibility_status", "active")
      .is("revoked_at", null)
      .in("hat_type", ["tophat", "oversight_chair"]);

    if (hatErr) {
      console.error("[ASCENSION_APPROVE] hat lookup failed", hatErr);
      return new Response(JSON.stringify({ error: "Authority check failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!callerHats || callerHats.length === 0) {
      return new Response(
        JSON.stringify({ error: "Insufficient authority — Oversight Chair (L2) or Protocol Steward (L3) required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let body: any;
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { application_id, aca_hash, aca_payload } = body || {};
    if (typeof application_id !== "string" || typeof aca_hash !== "string" || !aca_payload) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: application_id, aca_hash, aca_payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      return new Response(JSON.stringify({ error: "Invalid ACA hash — verified SHA-256 required." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load application
    const { data: app, error: appErr } = await admin
      .from("committee_applications")
      .select("id, user_id, committee_id, status")
      .eq("id", application_id)
      .maybeSingle();
    if (appErr || !app) {
      return new Response(JSON.stringify({ error: "Application not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (app.status !== "pending") {
      return new Response(JSON.stringify({ error: `Application already ${app.status}` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Reject if applicant already holds an active hat for this committee
    const { data: existing } = await admin
      .from("dao_hats")
      .select("id, eligibility_status")
      .eq("user_id", app.user_id)
      .eq("hat_type", app.committee_id)
      .is("revoked_at", null)
      .in("eligibility_status", ["pending_veto", "active"]);
    if (existing && existing.length > 0) {
      return new Response(JSON.stringify({ error: "Applicant already holds or is awaiting this hat" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vetoWindowEnd = new Date(Date.now() + VETO_WINDOW_MS).toISOString();

    // Update application
    const { error: updErr } = await admin
      .from("committee_applications")
      .update({ status: "approved" })
      .eq("id", application_id)
      .eq("status", "pending");
    if (updErr) {
      console.error("[ASCENSION_APPROVE] app update failed", updErr);
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Provision pending_veto hat
    const hatPayload: Record<string, unknown> = {
      user_id: app.user_id,
      hat_type: app.committee_id,
      eligibility_status: "pending_veto",
      veto_window_end: vetoWindowEnd,
      provisioned_by: callerId,
    };
    const { data: newHat, error: hatInsertErr } = await admin
      .from("dao_hats")
      .insert(hatPayload)
      .select("id")
      .single();
    if (hatInsertErr) {
      console.error("[ASCENSION_APPROVE] hat insert failed", hatInsertErr);
      // Roll back app status so it can be retried
      await admin.from("committee_applications").update({ status: "pending" }).eq("id", application_id);
      return new Response(JSON.stringify({ error: hatInsertErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mirror caller's ACA into user_aca_records (strict insert).
    try {
      const { recordACA } = await import("../_shared/recordACA.ts");
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_APPLICATION_APPROVE",
        consentType: "APPLICATION_APPROVE_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[ASCENSION_APPROVE] ACA mirror skipped:", (e as Error).message);
    }

    console.log("[ASCENSION_APPROVE] OK", {
      caller: callerId,
      application_id,
      hat_id: newHat?.id,
      veto_window_end: vetoWindowEnd,
    });
    return new Response(
      JSON.stringify({ ok: true, hat_id: newHat?.id, veto_window_end: vetoWindowEnd }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[ASCENSION_APPROVE] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
