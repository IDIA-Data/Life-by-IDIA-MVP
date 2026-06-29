import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: "User ID is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const clientId = Deno.env.get("FORD_CLIENT_ID");
    if (!clientId) {
      return new Response(JSON.stringify({ error: "Ford client ID not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const redirectUri = `https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/ford-oauth-callback`;

    // FordConnect API scopes for full vehicle telemetry access
    const scope = "access";
    const state = userId;

    // Explicitly forcing response_mode=query so Azure AD B2C doesn't hide the payload in a POST body
    const oauthUrl = `https://fordconnect.cv.ford.com/common/login?make=F&application_id=${clientId}&client_id=${clientId}&response_type=code&response_mode=query&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}`;

    return new Response(JSON.stringify({ oauthUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating Ford OAuth URL:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
