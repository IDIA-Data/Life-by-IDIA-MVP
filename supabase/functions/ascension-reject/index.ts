// ascension-reject — L2/L3 reviewer rejects a pending committee application.
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
    const { application_id, reason, aca_hash, aca_payload } = body || {};
    if (typeof application_id !== "string" || typeof aca_hash !== "string" || !aca_payload) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      return new Response(JSON.stringify({ error: "Invalid ACA hash" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: updErr } = await admin
      .from("committee_applications")
      .update({ status: "rejected" })
      .eq("id", application_id)
      .eq("status", "pending");
    if (updErr) {
      return new Response(JSON.stringify({ error: updErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const { recordACA } = await import("../_shared/recordACA.ts");
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_APPLICATION_REJECT",
        consentType: "APPLICATION_REJECT_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[ASCENSION_REJECT] ACA mirror skipped:", (e as Error).message);
    }

    console.log("[ASCENSION_REJECT] OK", { caller: callerId, application_id });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[ASCENSION_REJECT] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
