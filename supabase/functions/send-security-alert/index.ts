// Security alert dispatcher: records security events (new login, password change)
// and forwards to the transactional email system when configured. Safe no-op
// for delivery when no email infrastructure exists — logs are always emitted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Event = "new_login" | "password_changed";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { event } = (await req.json()) as { event: Event };
    if (event !== "new_login" && event !== "password_changed") {
      return new Response(JSON.stringify({ error: "invalid_event" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[security-alert] event=${event} user=${user.id} email=${user.email} at=${new Date().toISOString()}`);

    // Forward to transactional email if registered; otherwise just log.
    try {
      const tmpl = event === "new_login" ? "security-new-login" : "security-password-changed";
      const subject = event === "new_login" ? "New sign-in to your IDIA account" : "Your IDIA password was changed";
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName: tmpl,
          recipientEmail: user.email,
          idempotencyKey: `${event}-${user.id}-${Date.now()}`,
          templateData: { event, subject, when: new Date().toISOString() },
        },
      });
    } catch (err) {
      console.log("[security-alert] email dispatch skipped:", (err as Error).message);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[security-alert] error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
