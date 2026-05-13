import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FORD_API_BASE = 'https://api.mps.ford.com/api/fordconnect/v3';

async function refreshFordToken(supabase: any, connection: any) {
  const clientId = Deno.env.get('FORD_CLIENT_ID');
  const clientSecret = Deno.env.get('FORD_CLIENT_SECRET');

  if (!clientId || !clientSecret || !connection.refresh_token) return null;

  const tokenResponse = await fetch('https://dah2vb2cprod.b2clogin.com/914d88b1-3523-4bf6-9be4-1b96b4f6f919/oauth2/v2.0/token?p=B2C_1A_signup_signin_common', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: connection.refresh_token,
    }).toString()
  });

  if (!tokenResponse.ok) return null;

  const tokenData = await tokenResponse.json();

  await supabase
    .from('data_connections')
    .update({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token || connection.refresh_token,
      token_expires_at: new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString(),
    })
    .eq('id', connection.id);

  return tokenData.access_token;
}

async function fordApiCall(accessToken: string, endpoint: string) {
  const response = await fetch(`${FORD_API_BASE}${endpoint}`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Application-Id': Deno.env.get('FORD_CLIENT_ID') || '',
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ford API error [${response.status}]: ${errorText}`);
  }

  return response.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Ford connection
    const { data: connection, error: connError } = await supabase
      .from('data_connections')
      .select('*')
      .eq('user_id', user_id)
      .eq('connection_type', 'ford')
      .eq('is_active', true)
      .single();

    if (connError || !connection) {
      return new Response(
        JSON.stringify({ error: 'No active Ford connection found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if token needs refresh
    let accessToken = connection.access_token;
    if (connection.token_expires_at && new Date(connection.token_expires_at) < new Date()) {
      const refreshedToken = await refreshFordToken(supabase, connection);
      if (!refreshedToken) {
        return new Response(
          JSON.stringify({ error: 'Failed to refresh Ford token. Please reconnect.' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      accessToken = refreshedToken;
    }

    // Fetch vehicles list
    const vehiclesData = await fordApiCall(accessToken, '/vehicles');
    const vehicles = vehiclesData?.vehicles || [];

    if (vehicles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No vehicles found on this account', vehicles: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const allVehicleData = [];

    for (const vehicle of vehicles) {
      const vehicleId = vehicle.vehicleId;

      // Fetch all telemetry categories in parallel
      const [
        locationResult,
        vehicleInfoResult,
        statusResult,
      ] = await Promise.allSettled([
        fordApiCall(accessToken, `/vehicles/${vehicleId}/location`),
        fordApiCall(accessToken, `/vehicles/${vehicleId}`),
        fordApiCall(accessToken, `/vehicles/${vehicleId}/status`),
      ]);

      const vehicleTelemetry: Record<string, any> = {
        vehicleId,
        make: vehicle.make,
        modelName: vehicle.modelName,
        modelYear: vehicle.modelYear,
        vin: vehicle.vin,
        color: vehicle.color,
        nickName: vehicle.nickName,
      };

      // Location & Movement
      if (locationResult.status === 'fulfilled') {
        vehicleTelemetry.location = locationResult.value;
      }

      // Vehicle info (includes EV data, fuel, etc.)
      if (vehicleInfoResult.status === 'fulfilled') {
        vehicleTelemetry.vehicleInfo = vehicleInfoResult.value;
      }

      // Full status (doors, tires, battery, diagnostics)
      if (statusResult.status === 'fulfilled') {
        const status = statusResult.value;
        vehicleTelemetry.status = {
          // Driving Dynamics
          speed: status?.vehiclestatus?.speed,
          gearLeverPosition: status?.vehiclestatus?.gearLeverPosition,
          engineRpm: status?.vehiclestatus?.engineRpm,
          acceleratorPedalPosition: status?.vehiclestatus?.acceleratorPedalPosition,

          // EV / PHEV
          batteryStateOfCharge: status?.vehiclestatus?.batteryStateOfCharge,
          elVehChargeStatus: status?.vehiclestatus?.elVehChargeStatus,
          plugStatus: status?.vehiclestatus?.plugStatus,
          chargingVoltage: status?.vehiclestatus?.chargingVoltage,
          estimatedRange: status?.vehiclestatus?.elVehDTE,

          // Vehicle Health & Diagnostics
          odometer: status?.vehiclestatus?.odometer,
          battery12V: status?.vehiclestatus?.battery,
          oilLifeRemaining: status?.vehiclestatus?.oilLifeRemaining,
          tirePressure: status?.vehiclestatus?.tirePressure,
          engineCoolantTemp: status?.vehiclestatus?.engineCoolantTemp,
          diagnosticTroubleCodes: status?.vehiclestatus?.dtcs,
          fuelLevel: status?.vehiclestatus?.fuel,

          // Security & Cabin State
          doors: status?.vehiclestatus?.doorStatus,
          windows: status?.vehiclestatus?.windowStatus,
          alarm: status?.vehiclestatus?.alarm,
          ignitionStatus: status?.vehiclestatus?.ignitionStatus,
          deepSleepMode: status?.vehiclestatus?.deepSleepInProgress,

          // Climate
          cabinTemperature: status?.vehiclestatus?.cabinTemperature,
          exteriorTemperature: status?.vehiclestatus?.outsideTemperature,
        };
      }

      // Store raw telemetry in raw_health_data for pipeline processing
      const { error: insertError } = await supabase
        .from('raw_health_data')
        .insert({
          user_id,
          device_type: 'ford_vehicle',
          activity_type: 'vehicle_telemetry',
          raw_payload: vehicleTelemetry,
          processing_status: 'pending',
          step_count: Math.round(vehicleTelemetry.status?.odometer?.value || 0),
          recorded_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Error storing Ford vehicle data:', insertError);
      }

      allVehicleData.push(vehicleTelemetry);
    }

    // Update last sync time
    await supabase
      .from('data_connections')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synced ${allVehicleData.length} vehicle(s)`,
        vehicles: allVehicleData,
        sync_timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Ford Vehicle Data Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message, success: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
})
