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
    const state = url.searchParams.get('state'); // This should contain the user_id
    const error = url.searchParams.get('error');

    if (error) {
      console.error('Strava OAuth error:', error);
      return new Response('OAuth authorization failed', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    if (!code || !state) {
      return new Response('Missing authorization code or state', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    // Exchange code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: Deno.env.get('STRAVA_CLIENT_ID'),
        client_secret: Deno.env.get('STRAVA_CLIENT_SECRET'),
        code: code,
        grant_type: 'authorization_code'
      })
    });

    if (!tokenResponse.ok) {
      console.error('Failed to exchange code for token:', tokenResponse.statusText);
      return new Response('Failed to get access token', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    const tokenData = await tokenResponse.json();

    // Store or update the connection in the database
    const { error: upsertError } = await supabase
      .from('data_connections')
      .upsert({
        user_id: state,
        connection_type: 'strava',
        connection_name: 'Strava',
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        token_expires_at: new Date(tokenData.expires_at * 1000).toISOString(),
        is_active: true,
        last_sync_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,connection_type'
      });

    if (upsertError) {
      console.error('Failed to store connection:', upsertError);
      return new Response('Failed to store connection', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Subscribe to webhooks
    const webhookResponse = await supabase.functions.invoke('strava-webhook-subscription', {
      body: { action: 'subscribe' }
    });

    if (webhookResponse.error) {
      console.error('Failed to subscribe to webhooks:', webhookResponse.error);
    }

    // Return success page or redirect
    const successHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Strava Connected Successfully</title>
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            .success { color: #28a745; font-size: 24px; margin-bottom: 20px; }
            .message { color: #666; font-size: 16px; }
          </style>
        </head>
        <body>
          <div class="success">✅ Strava Connected Successfully!</div>
          <div class="message">You can now close this window and return to the app.</div>
          <script>
            // Auto-close after 3 seconds
            setTimeout(() => window.close(), 3000);
          </script>
        </body>
      </html>
    `;

    return new Response(successHtml, {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'text/html' 
      }
    });

  } catch (error) {
    console.error('OAuth callback error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
})