// Canonical ingestion path: apple-health-sync → raw_health_data → (trigger) → synapse-controller → staged_health_data → best-friend-ai
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Map Apple HealthKit identifiers to internal schema keys
// Expanded to include the High-Fidelity Discovery labels from Swift
const healthKitKeyMapping: Record<string, string> = {
  HKQuantityTypeIdentifierStepCount: "steps",
  HKQuantityTypeIdentifierDistanceWalkingRunning: "distanceWalkingRunning",
  HKQuantityTypeIdentifierDistanceCycling: "distanceCycling",
  HKQuantityTypeIdentifierFlightsClimbed: "flightsClimbed",
  HKQuantityTypeIdentifierActiveEnergyBurned: "calories",
  HKQuantityTypeIdentifierBasalEnergyBurned: "basalEnergy",
  HKQuantityTypeIdentifierAppleExerciseTime: "exerciseTime",
  HKQuantityTypeIdentifierHeartRate: "heartRate",
  HKQuantityTypeIdentifierHeartRateVariabilitySDNN: "hrv",
  HKQuantityTypeIdentifierOxygenSaturation: "bloodOxygen",
  HKQuantityTypeIdentifierBloodPressureSystolic: "bpSystolic",
  HKQuantityTypeIdentifierBloodPressureDiastolic: "bpDiastolic",
  HKQuantityTypeIdentifierRespiratoryRate: "respiratoryRate",
  HKQuantityTypeIdentifierBodyTemperature: "bodyTemp",
  HKQuantityTypeIdentifierVO2Max: "vo2max",
  HKQuantityTypeIdentifierHeight: "height",
  HKQuantityTypeIdentifierBodyMass: "weight",
  HKQuantityTypeIdentifierBodyMassIndex: "bodyMassIndex",
  HKQuantityTypeIdentifierBodyFatPercentage: "bodyFatPercentage",
  HKQuantityTypeIdentifierLeanBodyMass: "leanBodyMass",
  HKQuantityTypeIdentifierWaistCircumference: "waistCircumference",
  HKQuantityTypeIdentifierDietaryEnergyConsumed: "dietaryEnergyConsumed",
  HKQuantityTypeIdentifierDietaryFatTotal: "totalFat",
  HKQuantityTypeIdentifierDietaryFatSaturated: "saturatedFat",
  HKQuantityTypeIdentifierDietaryCarbohydrates: "carbohydrates",
  HKQuantityTypeIdentifierDietaryFiber: "fiber",
  HKQuantityTypeIdentifierDietarySugar: "sugar",
  HKQuantityTypeIdentifierDietaryProtein: "protein",
  HKQuantityTypeIdentifierDietaryWater: "water",
  HKQuantityTypeIdentifierDietaryCaffeine: "caffeine",
  HKQuantityTypeIdentifierWalkingSpeed: "walkingSpeed",
  HKQuantityTypeIdentifierWalkingStepLength: "stepLength",
  HKQuantityTypeIdentifierWalkingAsymmetryPercentage: "walkingAsymmetry",
  HKQuantityTypeIdentifierWalkingDoubleSupportPercentage: "doubleSupport",
  HKQuantityTypeIdentifierAppleWalkingSteadiness: "steadiness",
  HKQuantityTypeIdentifierEnvironmentalAudioExposure: "noiseLevel",
  HKQuantityTypeIdentifierUVExposure: "uvExposure",
  HKCategoryTypeIdentifierSleepAnalysis: "sleep",
  HKCategoryTypeIdentifierMindfulSession: "mindfulSession",
  HKCategoryTypeIdentifierMenstrualFlow: "menstrualFlow",
  HKQuantityTypeIdentifierBasalBodyTemperature: "basalBodyTemperature",
  HKWorkoutTypeIdentifier: "workouts",
  // Direct Bridge Mapping for Tactical Labels
  steps: "steps",
  heartRate: "heartRate",
  hrv: "hrv",
  restingHR: "restingHR",
  bloodOxygen: "bloodOxygen",
  respiratoryRate: "respiratoryRate",
  walkingSpeed: "walkingSpeed",
  stepLength: "stepLength",
  walkingAsymmetry: "walkingAsymmetry",
  doubleSupport: "doubleSupport",
  steadiness: "steadiness",
  calories: "calories",
  basalEnergy: "basalEnergy",
  noiseLevel: "noiseLevel",
  uvExposure: "uvExposure",
  bodyTemp: "bodyTemp",
  vo2max: "vo2max",
  bpSystolic: "bpSystolic",
  bpDiastolic: "bpDiastolic",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseKey) throw new Error("Missing Supabase configuration");

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${supabaseKey}` } },
    });

    const rawBody = await req.json().catch(() => ({}));

    // Parse query params (aligned to aca_hash_key schema)
    const url = new URL(req.url);
    const queryAcaHash = url.searchParams.get("aca_hash_key");

    // Fuzzy key matching — prioritizing aca_hash_key for DELT verification
    const userId = rawBody.user_id || rawBody.userId || rawBody.config?.user_id;
    const acaHash = queryAcaHash || rawBody.aca_hash_key || rawBody.aca_hash || rawBody.acaHash;

    // Broad extraction: Supports both the structured object and the raw Firehose array
    let healthData =
      rawBody.data ||
      rawBody.apple_health_data ||
      rawBody.healthData ||
      rawBody.health_data ||
      rawBody.samples ||
      rawBody.config?.apple_health_data ||
      rawBody.config?.healthData ||
      rawBody.config?.health_data;

    // Root-level check for flat structures
    if (
      !healthData ||
      (typeof healthData === "object" && !Array.isArray(healthData) && Object.keys(healthData).length === 0)
    ) {
      const knownHealthKeys = Object.values(healthKitKeyMapping);
      const allKnownKeys = [...Object.keys(healthKitKeyMapping), ...knownHealthKeys];
      const rootHealthData: Record<string, any> = {};
      for (const key of Object.keys(rawBody)) {
        if (allKnownKeys.includes(key)) {
          rootHealthData[key] = rawBody[key];
        }
      }
      if (Object.keys(rootHealthData).length > 0) {
        healthData = rootHealthData;
      }
    }

    console.log("Raw body keys:", Object.keys(rawBody));
    console.log(
      "Ingression source resolved:",
      Array.isArray(healthData)
        ? healthData.length + " firehose records"
        : healthData
          ? Object.keys(healthData).length + " grouped keys"
          : "null",
    );

    const automatedSync = rawBody.automated_sync || false;
    const forceRealDataOnly = rawBody.force_real_data_only || false;

    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Missing required field: user_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!acaHash) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required field: aca_hash_key. DELT Protocol requires a valid audit anchor.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // DELT/ACA Verification: Verification of platform_guid to establish lineage proof
    const { data: profile } = await supabase
      .from("profiles")
      .select("platform_guid")
      .eq("user_id", userId)
      .maybeSingle();

    const platformGuid = profile?.platform_guid;
    if (!platformGuid) {
      return new Response(JSON.stringify({ success: false, error: "No profile/platform_guid found for user" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: acaRecord } = await supabase
      .from("user_aca_records")
      .select("id")
      .eq("aca_hash_key", acaHash)
      .eq("platform_guid", platformGuid)
      .maybeSingle();

    if (!acaRecord) {
      return new Response(
        JSON.stringify({ success: false, error: "DELT Protocol Verification Failed. No matching audit record found." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    console.log("✅ DELT Protocol verified for user:", userId);

    // Normalize incoming payload keys
    let processableData: any = {};
    if (healthData && typeof healthData === "object" && !Array.isArray(healthData)) {
      Object.keys(healthData).forEach((key: string) => {
        const normalizedKey = healthKitKeyMapping[key] || key;
        processableData[normalizedKey] = healthData[key];
      });
    }

    // EXPANDED WHITELIST: The complete 22-metric Discovery Set from Swift
    const healthDataTypes = [
      "steps",
      "heartRate",
      "hrv",
      "restingHR",
      "bloodOxygen",
      "respiratoryRate",
      "walkingSpeed",
      "stepLength",
      "walkingAsymmetry",
      "doubleSupport",
      "steadiness",
      "calories",
      "basalEnergy",
      "noiseLevel",
      "uvExposure",
      "bodyTemp",
      "vo2max",
      "bpSystolic",
      "bpDiastolic",
      "sleep",
      "sleepAnalysis",
      "distanceWalkingRunning",
      "distanceCycling",
      "flightsClimbed",
      "exerciseTime",
      "bloodOxygenSaturation",
    ];

    const recordsToInsert: any[] = [];

    // --- CASE 1: NATIVE FIREHOSE ARRAY ---
    if (Array.isArray(healthData)) {
      console.log("Processing direct firehose array...");
      for (const item of healthData) {
        const rawType = item.dataType || item.type || item.typeIdentifier;
        const dataType = healthKitKeyMapping[rawType] || rawType;

        if (!healthDataTypes.includes(dataType)) continue;

        const actualValue = typeof item === "object" && item !== null && item.value !== undefined ? item.value : item;

        recordsToInsert.push({
          user_id: userId,
          aca_hash_key: acaHash, // Aligned to aca_hash_key
          device_type: "Apple Health",
          raw_payload: {
            dataType,
            value: actualValue,
            metadata: item.metadata || {},
            src_v: item.metadata?.src_v || "Native-PureAlpha",
          },
          recorded_at: item.startDate || item.date || new Date().toISOString(),
          processing_status: "pending",
          processed: false,
          step_count: dataType === "steps" ? parseInt(String(actualValue)) : null,
        });
      }
    }
    // --- CASE 2: STRUCTURED OBJECT (LEGACY/WEB) ---
    else {
      for (const dataType of healthDataTypes) {
        if (!processableData[dataType]) continue;
        const dataArray = Array.isArray(processableData[dataType])
          ? processableData[dataType]
          : [processableData[dataType]];
        for (const record of dataArray) {
          const actualValue =
            typeof record === "object" && record !== null && record.value !== undefined ? record.value : record;

          const healthRecord: any = {
            user_id: userId,
            aca_hash_key: acaHash,
            device_type: "Apple Health",
            raw_payload: {
              dataType,
              value: actualValue,
              unit: typeof record === "object" && record !== null ? record.unit || null : null,
              startDate: typeof record === "object" && record !== null ? record.startDate || record.date : null,
              endDate: typeof record === "object" && record !== null ? record.endDate || record.date : null,
              sourceBundle:
                typeof record === "object" && record !== null
                  ? record.sourceBundle || "com.apple.health"
                  : "com.apple.health",
              sourceName:
                typeof record === "object" && record !== null ? record.sourceName || "Apple Health" : "Apple Health",
              metadata: typeof record === "object" && record !== null ? record.metadata || {} : {},
              originalRecord: typeof record === "object" ? record : { value: actualValue },
            },
            recorded_at:
              typeof record === "object" && record !== null
                ? record.startDate || record.date || new Date().toISOString()
                : new Date().toISOString(),
            processing_status: "pending",
            processed: false,
          };

          if (dataType === "steps" && actualValue !== undefined && actualValue !== null) {
            const parsed = parseInt(String(actualValue));
            if (!isNaN(parsed)) healthRecord.step_count = parsed;
          }

          recordsToInsert.push({
            __dataType: dataType,
            __actualValue: actualValue,
            __recordedAt: healthRecord.recorded_at,
            ...healthRecord,
          });
        }
      }
    }

    // Process workouts separately to maintain original logic
    if (processableData.workouts && Array.isArray(processableData.workouts)) {
      for (const workout of processableData.workouts) {
        const rec = {
          user_id: userId,
          aca_hash_key: acaHash,
          device_type: "Apple Health",
          raw_payload: {
            dataType: "workout",
            workoutActivityType: workout.workoutActivityType,
            duration: workout.duration,
            totalEnergyBurned: workout.totalEnergyBurned,
            totalDistance: workout.totalDistance,
            startDate: workout.startDate,
            endDate: workout.endDate,
            sourceBundle: workout.sourceBundle || "com.apple.health",
            heartRateSamples: workout.heartRateSamples || [],
            route: workout.route || null,
            metadata: workout.metadata || {},
            originalRecord: workout,
          },
          recorded_at: workout.startDate,
          processing_status: "pending",
          processed: false,
        };
        recordsToInsert.push({
          __dataType: "workout",
          __actualValue: workout.workoutActivityType,
          __recordedAt: workout.startDate,
          ...rec,
        });
      }
    }

    if (recordsToInsert.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No actionable health data found", processed_count: 0 }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Update synchronization status in data_connections
    await supabase.from("data_connections").upsert(
      {
        user_id: userId,
        connection_type: "apple_health",
        connection_name: "Apple Health",
        is_active: true,
        last_sync_at: new Date().toISOString(),
      },
      { onConflict: "user_id,connection_type" },
    );

    // CHUNKED BATCH INSERT: Maintaining your procedural select("id") and metadata reconstruction
    const processedData: any[] = [];
    const CHUNK_SIZE = 100; // Adjusted for massive firehose efficiency

    for (let i = 0; i < recordsToInsert.length; i += CHUNK_SIZE) {
      const chunk = recordsToInsert.slice(i, i + CHUNK_SIZE);
      const cleanChunk = chunk.map(({ __dataType, __actualValue, __recordedAt, ...rest }) => rest);

      try {
        const { data: inserted, error: insertError } = await supabase
          .from("raw_health_data")
          .insert(cleanChunk)
          .select("id");

        if (insertError) {
          console.error(`Batch insert error (chunk ${i / CHUNK_SIZE}):`, insertError);
          continue;
        }

        if (inserted) {
          inserted.forEach((row: any, idx: number) => {
            const meta = chunk[idx];
            processedData.push({
              type: meta.__dataType || meta.raw_payload.dataType,
              id: row.id,
              value: meta.__actualValue || meta.raw_payload.value,
              recordedAt: meta.__recordedAt || meta.recorded_at,
            });
          });
        }
      } catch (err) {
        console.error(`Chunk ${i / CHUNK_SIZE} threw exception:`, err);
      }
    }

    console.log(
      `✅ Sovereign Hydration Complete: ${processedData.length} records anchored with aca_hash_key: ${acaHash.substring(0, 12)}...`,
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Apple Health data synced successfully via IDIA Protocol",
        processed_data: processedData,
        processed_count: processedData.length,
        delt_anchor: acaHash.substring(0, 12),
        sync_timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("🚨 [SYSTEM_STALL] Apple Health Sync Error:", message);
    return new Response(JSON.stringify({ error: message, success: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
