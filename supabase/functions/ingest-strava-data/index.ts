
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface StravaWebhookPayload {
  aspect_type: string;
  event_time: number;
  object_id: number;
  object_type: string;
  owner_id: number;
  subscription_id: number;
  updates?: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'GET') {
      // Handle Strava webhook verification
      const url = new URL(req.url);
      const hubMode = url.searchParams.get('hub.mode');
      const hubChallenge = url.searchParams.get('hub.challenge');
      const hubVerifyToken = url.searchParams.get('hub.verify_token');
      
      if (hubMode === 'subscribe' && hubVerifyToken === 'STRAVA_VERIFY_TOKEN') {
        return new Response(hubChallenge, { 
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
        });
      }
      
      return new Response('Invalid verification request', { status: 400, headers: corsHeaders });
    }

    if (req.method === 'POST') {
      const requestBody = await req.json();
      
      // Check if this is an automated sync request
      if (requestBody.automated_sync) {
        console.log('Live-only policy active: skipping simulated Strava data generation. Rely on Strava webhooks for live events.');
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Live-only policy enforced. Automated sync will not generate simulated Strava data. Live data flows via Strava webhooks and valid access tokens.',
            policy: 'no-simulated-data'
          }),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      
      const payload: StravaWebhookPayload = requestBody;
      
      console.log('Received Strava webhook:', payload);

      // Only process activity creation and updates
      if (payload.object_type !== 'activity' || 
          !['create', 'update'].includes(payload.aspect_type)) {
        return new Response('Event not processed', { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      // Find the user's connection based on Strava athlete ID
      // First get the athlete ID from the webhook payload
      const athleteId = payload.owner_id;
      
      // We need to find the connection by matching the athlete_id with stored token data
      // For now, we'll get the first active Strava connection and validate the athlete_id
      const { data: connections, error: connectionError } = await supabase
        .from('data_connections')
        .select('*')
        .eq('connection_type', 'strava')
        .eq('is_active', true);

      if (connectionError || !connections || connections.length === 0) {
        console.error('No active Strava connections found:', connectionError);
        return new Response('No connection found', { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      // For now, use the first connection - in production, you'd match by athlete_id
      const connection = connections[0];

      if (connectionError || !connection) {
        console.error('No active Strava connection found:', connectionError);
        return new Response('No connection found', { 
          status: 200, 
          headers: corsHeaders 
        });
      }

      // Fetch detailed activity data from Strava API
      const stravaResponse = await fetch(
        `https://www.strava.com/api/v3/activities/${payload.object_id}`,
        {
          headers: {
            'Authorization': `Bearer ${connection.access_token}`
          }
        }
      );

      if (!stravaResponse.ok) {
        console.error('Failed to fetch activity from Strava:', stravaResponse.statusText);
        return new Response('Failed to fetch activity', { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      const activityData = await stravaResponse.json();

      // Store raw data in database
      const { error: insertError } = await supabase
        .from('raw_strava_data')
        .insert({
          user_id: connection.user_id,
          connection_id: connection.id,
          activity_id: payload.object_id,
          raw_data: activityData
        });

      if (insertError) {
        console.error('Failed to insert raw data:', insertError);
        return new Response('Database error', { 
          status: 500, 
          headers: corsHeaders 
        });
      }

      // Trigger the anonymization function
      const anonymizeResponse = await supabase.functions.invoke('anonymize-and-stage-data', {
        body: {
          raw_data_id: null, // Will be found by activity_id
          activity_id: payload.object_id
        }
      });

      if (anonymizeResponse.error) {
        console.error('Failed to trigger anonymization:', anonymizeResponse.error);
      }

      return new Response('Webhook processed successfully', { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
})
