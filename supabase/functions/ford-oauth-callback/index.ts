import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state'); // user_id
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Ford OAuth error:', error);
      return new Response('OAuth authorization failed', { status: 400, headers: corsHeaders });
    }

    if (!code || !state) {
      return new Response('Missing authorization code or state', { status: 400, headers: corsHeaders });
    }

    const clientId = Deno.env.get('FORD_CLIENT_ID');
    const clientSecret = Deno.env.get('FORD_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      return new Response('Missing Ford API configuration', { status: 500, headers: corsHeaders });
    }

    // Exchange code for access token via FordConnect token endpoint
    const tokenResponse = await fetch('https://dah2vb2cprod.b2clogin.com/914d88b1-3523-4bf6-9be4-1b96b4f6f919/oauth2/v2.0/token?p=B2C_1A_signup_signin_common', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        redirect_uri: `https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/ford-oauth-callback`,
      }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Failed to exchange code for token:', errorText);
      return new Response('Failed to get access token', { status: 500, headers: corsHeaders });
    }

    const tokenData = await tokenResponse.json();

    // Store the connection in the database
    const { error: upsertError } = await supabase
      .from('data_connections')
      .upsert({
        user_id: state,
        connection_type: 'ford',
        connection_name: 'FordConnect',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
        is_active: true,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,connection_type'
      });

    if (upsertError) {
      console.error('Failed to store Ford connection:', upsertError);
      return new Response('Failed to store connection', { status: 500, headers: corsHeaders });
    }

    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Ford Connected Successfully</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f8f9fa; }
            .success { color: #1351d8; font-size: 24px; margin-bottom: 20px; }
            .message { color: #666; font-size: 16px; }
            .ford-logo { font-size: 48px; margin-bottom: 16px; }
          </style>
        </head>
        <body>
          <div class="ford-logo">🚗</div>
          <div class="success">✅ FordConnect Linked Successfully!</div>
          <div class="message">Vehicle telemetry is now streaming. You can close this window.</div>
          <script>setTimeout(() => window.close(), 3000);</script>
        </body>
      </html>
    `;

    return new Response(successHtml, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' }
    });

  } catch (error) {
    console.error('Ford OAuth callback error:', error);
    return new Response('Internal server error', { status: 500, headers: corsHeaders });
  }
})
