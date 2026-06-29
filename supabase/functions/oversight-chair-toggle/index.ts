// oversight-chair-toggle — L3 Protocol Steward action.
// Promotes a Level 1 committee officer to Level 2 (Oversight Chair) by minting
// an `oversight_chair` hat, or demotes by revoking it. Requires caller to hold
// an active `tophat`.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
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
      console.error("[OVERSIGHT_CHAIR_TOGGLE] hat lookup failed", hatErr);
      return json({ error: "Authority check failed" }, 500);
    }
    if (!callerHats || callerHats.length === 0) {
      return json({ error: "Insufficient authority — Protocol Steward (L3) required" }, 403);
    }

    let body: any;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
    const { target_user_id, action, aca_hash, aca_payload } = body || {};
    if (
      typeof target_user_id !== "string" ||
      !/^[0-9a-f-]{36}$/i.test(target_user_id) ||
      (action !== "promote" && action !== "demote") ||
      typeof aca_hash !== "string" ||
      !aca_payload
    ) {
      return json(
        { error: "Missing or invalid fields: target_user_id, action ('promote'|'demote'), aca_hash, aca_payload" },
        400,
      );
    }
    if (!/^[a-f0-9]{64}$/i.test(aca_hash)) {
      console.error("[OVERSIGHT_CHAIR_TOGGLE] INDEMNITY_VIOLATION: malformed ACA hash", {
        caller: callerId,
        target: target_user_id,
        action,
        aca_hash_len: aca_hash.length,
      });
      return json(
        { error: "Invalid ACA hash — Tophat actions require a verified SHA-256 attestation." },
        400,
      );
    }

    console.log("[OVERSIGHT_CHAIR_TOGGLE] TOPHAT_ANCHOR", {
      caller: callerId,
      target: target_user_id,
      action,
      aca_hash: aca_hash.substring(0, 12) + "…",
    });

    // Mirror ACA
    try {
      const { recordACA } = await import("../_shared/recordACA.ts");
      await recordACA(admin, {
        userId: callerId,
        sourceId: "GOV_OVERSIGHT_CHAIR",
        consentType: "OVERSIGHT_CHAIR_TOGGLE_V1",
        hash: aca_hash,
        payload: aca_payload,
      });
    } catch (e) {
      console.warn("[OVERSIGHT_CHAIR_TOGGLE] ACA mirror skipped:", (e as Error).message);
    }

    if (action === "promote") {
      // Require target to hold at least one active committee hat (L1+)
      const { data: targetHats, error: thErr } = await admin
        .from("dao_hats")
        .select("id, hat_type")
        .eq("user_id", target_user_id)
        .eq("eligibility_status", "active")
        .is("revoked_at", null);
      if (thErr) {
        console.error("[OVERSIGHT_CHAIR_TOGGLE] target lookup failed", thErr);
        return json({ error: "Target lookup failed" }, 500);
      }
      const hasCommittee = (targetHats || []).some((h: any) => h.hat_type !== "oversight_chair" && h.hat_type !== "tophat");
      if (!hasCommittee) {
        return json({ error: "Target must hold an active committee hat (L1) before promotion." }, 400);
      }
      const alreadyChair = (targetHats || []).some((h: any) => h.hat_type === "oversight_chair");
      if (alreadyChair) {
        console.log("[OVERSIGHT_CHAIR_TOGGLE] noop — already L2", { target: target_user_id });
        return json({ ok: true, noop: true });
      }

      const { error: insErr } = await admin.from("dao_hats").insert({
        user_id: target_user_id,
        hat_type: "oversight_chair",
        eligibility_status: "active",
      });
      if (insErr) {
        console.error("[OVERSIGHT_CHAIR_TOGGLE] promote insert failed", insErr);
        return json({ error: insErr.message }, 500);
      }
      console.log("[OVERSIGHT_CHAIR_TOGGLE] PROMOTED L1→L2", { target: target_user_id, caller: callerId });
      return json({ ok: true, action: "promote" });
    }

    // demote
    const { error: revErr } = await admin
      .from("dao_hats")
      .update({ revoked_at: new Date().toISOString(), eligibility_status: "revoked" })
      .eq("user_id", target_user_id)
      .eq("hat_type", "oversight_chair")
      .eq("eligibility_status", "active")
      .is("revoked_at", null);
    if (revErr) {
      console.error("[OVERSIGHT_CHAIR_TOGGLE] demote update failed", revErr);
      return json({ error: revErr.message }, 500);
    }
    console.log("[OVERSIGHT_CHAIR_TOGGLE] DEMOTED L2→L1", { target: target_user_id, caller: callerId });
    return json({ ok: true, action: "demote" });
  } catch (e: any) {
    console.error("[OVERSIGHT_CHAIR_TOGGLE] FATAL", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
