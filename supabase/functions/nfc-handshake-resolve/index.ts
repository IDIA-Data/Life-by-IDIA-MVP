import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface PeerEnvelope {
  v?: number;
  uid?: string;
  sig?: string;
  ts?: number;
}

function parsePeerPayload(raw: unknown): { uid: string; ts?: number } | null {
  if (!raw) return null;

  // Object envelope
  if (typeof raw === "object") {
    const env = raw as PeerEnvelope;
    if (env.uid && UUID_RE.test(env.uid)) return { uid: env.uid.toLowerCase(), ts: env.ts };
  }

  if (typeof raw !== "string") return null;
  const s = raw.trim();

  // Direct uuid
  if (UUID_RE.test(s)) return { uid: s.toLowerCase() };

  // JSON envelope as string
  try {
    const j = JSON.parse(s) as PeerEnvelope;
    if (j.uid && UUID_RE.test(j.uid)) return { uid: j.uid.toLowerCase(), ts: j.ts };
  } catch (_) { /* not json */ }

  // Try to extract a uuid substring (fallback for legacy tokens like "IDIA_LIFE_SYNC_001:<uuid>")
  const m = s.match(UUID_RE);
  if (m) return { uid: m[0].toLowerCase() };

  return null;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
    if (!authHeader) {
      console.log("[NFC_RESOLVE_NO_AUTH]");
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userRes?.user) {
      console.log("[NFC_RESOLVE_BAD_JWT]", userErr?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const me = userRes.user.id.toLowerCase();

    const body = await req.json().catch(() => ({}));
    const parsed = parsePeerPayload(body?.peerPayload ?? body?.peer_payload);
    if (!parsed) {
      console.log("[NFC_RESOLVE_BAD_PAYLOAD]", JSON.stringify(body).slice(0, 200));
      return new Response(JSON.stringify({ error: "Invalid peer payload — could not resolve peer user id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const peer = parsed.uid;

    if (peer === me) {
      console.log("[NFC_RESOLVE_SELF]");
      return new Response(JSON.stringify({ error: "Cannot handshake with yourself" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (parsed.ts) {
      const age = Math.abs(Date.now() / 1000 - parsed.ts);
      if (age > 120) {
        console.log("[NFC_RESOLVE_STALE]", { age });
        return new Response(JSON.stringify({ error: "Handshake payload is stale" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // TODO: verify ed25519 sig once enclave pubkey registry exists.

    // Canonical pair ordering for idempotency
    const [u1, u2] = me < peer ? [me, peer] : [peer, me];

    // DELT ACA — server-anchored hash of the handshake intent
    const aca_hash = await sha256Hex(
      JSON.stringify({ source: "NFC_HANDSHAKE_LIFE", u1, u2, ts: Date.now() }),
    );

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Look up existing pair (idempotent)
    const { data: existing, error: selErr } = await admin
      .from("friends")
      .select("id, status")
      .eq("user_id_1", u1)
      .eq("user_id_2", u2)
      .maybeSingle();

    if (selErr) {
      console.error("[NFC_RESOLVE_SELECT_ERR]", selErr.message);
      return new Response(JSON.stringify({ error: selErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let friendshipId: string;
    let created = false;

    if (existing) {
      friendshipId = existing.id;
      if (existing.status !== "accepted") {
        await admin.from("friends")
          .update({ status: "accepted", accepted_at: new Date().toISOString() })
          .eq("id", existing.id);
      }
      console.log("[NFC_RESOLVE_EXISTING]", { friendshipId });
    } else {
      const { data: ins, error: insErr } = await admin
        .from("friends")
        .insert({
          user_id_1: u1,
          user_id_2: u2,
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      if (insErr || !ins) {
        console.error("[NFC_RESOLVE_INSERT_ERR]", insErr?.message);
        return new Response(JSON.stringify({ error: insErr?.message ?? "Insert failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      friendshipId = ins.id;
      created = true;
      console.log("[NFC_RESOLVE_CREATED]", { friendshipId });
    }

    return new Response(
      JSON.stringify({ friendshipId, peerUserId: peer, aca_hash, created }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[NFC_RESOLVE_CRASH]", String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
