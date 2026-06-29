import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getAuthUrl(userId: string) {
  if (!userId) return json({ error: "User ID is required" }, 400);

  const clientId = Deno.env.get("STRAVA_CLIENT_ID");
  if (!clientId) return json({ error: "Strava client ID not configured" }, 500);

  const redirectUri = `https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/strava-oauth-callback`;
  const scope = "read,activity:read_all";
  const oauthUrl =
    `https://www.strava.com/oauth/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&approval_prompt=force&scope=${scope}&state=${userId}`;

  return json({ oauthUrl });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { action, userId } = body ?? {};

    console.log(`[STRAVA_CONTROLLER] action=${action} userId=${userId ? "present" : "missing"}`);

    switch (action) {
      case "get-auth-url":
        return await getAuthUrl(userId);
      default:
        return json({ error: `Unknown action: ${action ?? "(none)"}` }, 400);
    }
  } catch (err) {
    console.error("[STRAVA_CONTROLLER][ERROR]", err);
    return json({ error: "Internal server error" }, 500);
  }
});
