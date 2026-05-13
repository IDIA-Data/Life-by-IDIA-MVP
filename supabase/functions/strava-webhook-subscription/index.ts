import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action } = await req.json();
    
    const clientId = Deno.env.get('STRAVA_CLIENT_ID');
    const clientSecret = Deno.env.get('STRAVA_CLIENT_SECRET');
    const verifyToken = Deno.env.get('STRAVA_VERIFY_TOKEN');
    
    if (!clientId || !clientSecret || !verifyToken) {
      return new Response('Missing Strava configuration', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    if (action === 'subscribe') {
      // Subscribe to webhooks
      const subscriptionResponse = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          callback_url: `https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/ingest-strava-data`,
          verify_token: verifyToken
        })
      });

      if (!subscriptionResponse.ok) {
        const errorText = await subscriptionResponse.text();
        console.error('Failed to subscribe to webhooks:', errorText);
        return new Response(`Failed to subscribe: ${errorText}`, { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      const subscriptionData = await subscriptionResponse.json();
      console.log('Webhook subscription created:', subscriptionData);

      return new Response(JSON.stringify({ 
        success: true, 
        subscription: subscriptionData 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else if (action === 'list') {
      // List existing subscriptions
      const listResponse = await fetch(
        `https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`
      );

      if (!listResponse.ok) {
        const errorText = await listResponse.text();
        console.error('Failed to list subscriptions:', errorText);
        return new Response(`Failed to list subscriptions: ${errorText}`, { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      const subscriptions = await listResponse.json();
      
      return new Response(JSON.stringify({ 
        success: true, 
        subscriptions 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } else {
      return new Response('Invalid action', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

  } catch (error) {
    console.error('Webhook subscription error:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
})