import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const googleFitApiKey = Deno.env.get('GOOGLE_FIT_API_KEY');
    
    if (!googleFitApiKey) {
      return new Response(JSON.stringify({
        error: 'Google Fit API key not configured. Please add GOOGLE_FIT_API_KEY to your Supabase secrets.'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const requestBody = await req.json();
    const { user_id, google_access_token, data_types, automated_sync } = requestBody;
    
    // Handle automated sync for all active connections
    if (automated_sync) {
      console.log('Live-only policy active: skipping simulated Google Fit data generation.');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'Live-only policy enforced. Automated sync will not generate simulated Google Fit data. Real data requires user-initiated sync with a valid access token.',
          policy: 'no-simulated-data'
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!user_id || !google_access_token) {
      throw new Error('Missing required fields: user_id and google_access_token');
    }

    console.log('Syncing Google Fit data for user:', user_id);

    // Update user connection status
    await supabase
      .from('user_connections')
      .upsert({
        user_id: user_id,
        provider: 'google_fit',
        connection_status: 'connected',
        connection_data: { last_sync: new Date().toISOString() },
        last_sync_at: new Date().toISOString()
      });

    const processedData = [];
    const requestedDataTypes = data_types || ['steps', 'heart_rate', 'calories'];

    // Get data for the last 7 days
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Fetch steps data
    if (requestedDataTypes.includes('steps')) {
      try {
        const stepsResponse = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${google_access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aggregateBy: [{
              dataTypeName: 'com.google.step_count.delta',
              dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
            }],
            bucketByTime: { durationMillis: 86400000 }, // 1 day buckets
            startTimeMillis: startTime.getTime(),
            endTimeMillis: endTime.getTime()
          })
        });

        if (stepsResponse.ok) {
          const stepsData = await stepsResponse.json();
          
          for (const bucket of stepsData.bucket || []) {
            if (bucket.dataset?.[0]?.point?.length > 0) {
              const steps = bucket.dataset[0].point.reduce((sum: number, point: any) => 
                sum + (point.value?.[0]?.intVal || 0), 0);
              
              const recordedAt = new Date(parseInt(bucket.startTimeMillis)).toISOString();
              
              if (steps > 0) {
                const { data: rawData, error: rawError } = await supabase
                  .from('raw_health_data')
                  .insert({
                    user_id: user_id,
                    data_source: 'google_fit',
                    data_type: 'steps',
                    raw_data: {
                      steps: steps,
                      recorded_at: recordedAt,
                      device: 'Android',
                      source: 'Google Fit'
                    },
                    recorded_at: recordedAt
                  })
                  .select('id')
                  .single();

                if (!rawError) {
                  processedData.push({ type: 'steps', id: rawData.id, value: steps, date: recordedAt });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching steps data:', error);
      }
    }

    // Fetch heart rate data
    if (requestedDataTypes.includes('heart_rate')) {
      try {
        const heartRateResponse = await fetch(`https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${google_access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            aggregateBy: [{
              dataTypeName: 'com.google.heart_rate.bpm'
            }],
            bucketByTime: { durationMillis: 86400000 }, // 1 day buckets
            startTimeMillis: startTime.getTime(),
            endTimeMillis: endTime.getTime()
          })
        });

        if (heartRateResponse.ok) {
          const heartRateData = await heartRateResponse.json();
          
          for (const bucket of heartRateData.bucket || []) {
            if (bucket.dataset?.[0]?.point?.length > 0) {
              const avgHeartRate = bucket.dataset[0].point.reduce((sum: number, point: any) => 
                sum + (point.value?.[0]?.fpVal || 0), 0) / bucket.dataset[0].point.length;
              
              const recordedAt = new Date(parseInt(bucket.startTimeMillis)).toISOString();
              
              if (avgHeartRate > 0) {
                const { data: rawData, error: rawError } = await supabase
                  .from('raw_health_data')
                  .insert({
                    user_id: user_id,
                    data_source: 'google_fit',
                    data_type: 'heart_rate',
                    raw_data: {
                      heart_rate: Math.round(avgHeartRate),
                      recorded_at: recordedAt,
                      device: 'Android',
                      source: 'Google Fit'
                    },
                    recorded_at: recordedAt
                  })
                  .select('id')
                  .single();

                if (!rawError) {
                  processedData.push({ type: 'heart_rate', id: rawData.id, value: avgHeartRate, date: recordedAt });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching heart rate data:', error);
      }
    }

    console.log('Successfully processed Google Fit data:', processedData);

    return new Response(JSON.stringify({
      success: true,
      message: 'Google Fit data synced successfully',
      processed_data: processedData,
      sync_timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Google Fit Sync Error:', message);
    return new Response(JSON.stringify({
      error: message,
      success: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});