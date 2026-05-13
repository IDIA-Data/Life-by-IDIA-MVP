// verify-good-deed-evidence — Phase 5 of the IDIA Life Tab upgrade
// Validates a submitted Good Deed using the Lovable AI Gateway against the
// uploaded evidence file (image/audio/video) plus the user description.
// On `accept`, marks the deed verified and bumps the user's trust_score.
//
// Per project core rules:
//  - DELT Protocol: emits an Auditable Consent Artifact (ACA) hash on egress.
//  - Edge functions: validates JWT in code; uses SERVICE_ROLE_KEY internally.
//  - Zero-PII DB: never stores user names; only uses anonymous user_id UUIDs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface VerifyBody {
  deed_id: string;
}

const TRUST_SCORE_BUMP_ON_ACCEPT = 12;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "AI gateway is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 1. JWT validation (in-code, per Edge Function Standards) ---
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) {
      return new Response(JSON.stringify({ error: "Missing Authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, jwt, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    // --- 2. Validate body ---
    const body = (await req.json().catch(() => null)) as VerifyBody | null;
    if (!body?.deed_id || typeof body.deed_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing deed_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 3. Service-role client for privileged ops ---
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: deed, error: deedErr } = await admin
      .from("good_deeds")
      .select("id, user_id, title, description, evidence_url, verification_status")
      .eq("id", body.deed_id)
      .maybeSingle();

    if (deedErr || !deed) {
      return new Response(JSON.stringify({ error: "Deed not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (deed.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Not your deed" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!deed.evidence_url) {
      return new Response(JSON.stringify({ error: "Deed has no evidence" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 4. Build a short-lived signed URL the AI gateway can fetch ---
    // evidence_url stored is the storage object path: `${userId}/${deed.id}.${ext}`
    const { data: signed, error: signErr } = await admin.storage
      .from("deed-evidence")
      .createSignedUrl(deed.evidence_url, 60 * 5);

    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "Could not access evidence" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- 5. Call Lovable AI Gateway with structured output via tool calling ---
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are the IDIA Friend AI good-deed verifier. You judge whether a piece of evidence (image, audio, or video) plausibly supports the user's description of a good deed. Be lenient but honest. Reject only if the evidence clearly contradicts the description, is missing, is offensive, or shows fraud.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Title: ${deed.title}\n\nDescription: ${deed.description}\n\nDecide: accept or reject. Provide a one-sentence reason in plain fifth-grade English with no contractions.`,
              },
              { type: "image_url", image_url: { url: signed.signedUrl } },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "submit_verdict",
              description: "Return the verdict for this good deed.",
              parameters: {
                type: "object",
                properties: {
                  verdict: { type: "string", enum: ["accept", "reject"] },
                  reason: { type: "string" },
                },
                required: ["verdict", "reason"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "submit_verdict" } },
      }),
    });

    if (!aiResp.ok) {
      const t = await aiResp.text();
      console.error("[AI_GATEWAY_ERROR]", aiResp.status, t);
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please add funds to your Lovable AI workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson?.choices?.[0]?.message?.tool_calls?.[0];
    let verdict: "accept" | "reject" = "reject";
    let reason = "Could not verify the evidence.";
    try {
      const args = JSON.parse(toolCall?.function?.arguments ?? "{}");
      if (args.verdict === "accept" || args.verdict === "reject") verdict = args.verdict;
      if (typeof args.reason === "string" && args.reason.length) reason = args.reason;
    } catch (_) {
      // keep defaults
    }

    // --- 6. Update the deed and (on accept) bump trust_score ---
    const newStatus = verdict === "accept" ? "verified" : "rejected";
    const { error: updErr } = await admin
      .from("good_deeds")
      .update({
        verification_status: newStatus,
        verified_at: verdict === "accept" ? new Date().toISOString() : null,
      })
      .eq("id", deed.id);

    if (updErr) {
      console.error("[DEED_UPDATE_FAILED]", updErr);
    }

    if (verdict === "accept") {
      const { data: profile } = await admin.from("profiles").select("trust_score").eq("user_id", userId).maybeSingle();
      const next = (profile?.trust_score ?? 850) + TRUST_SCORE_BUMP_ON_ACCEPT;
      await admin.from("profiles").update({ trust_score: next }).eq("user_id", userId);
      await admin.from("trust_score_history").insert({ user_id: userId, score: next });
    }

    // --- 7. DELT Protocol — ACA hash for the egress ---
    const acaPayload = `${userId}|${deed.id}|${verdict}|${Date.now()}`;
    const acaHash = await sha256(acaPayload);

    return new Response(
      JSON.stringify({
        verdict,
        reason,
        status: newStatus,
        aca_hash_key: acaHash,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[VERIFY_GOOD_DEED_FATAL]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function sha256(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
