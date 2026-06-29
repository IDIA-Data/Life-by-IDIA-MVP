import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Auth guard - require valid JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    {
      const userClient = createClient(
        supabaseUrl,
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: authData, error: authErr } = await userClient.auth.getUser();
      if (authErr || !authData?.user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { trigger = 'manual', force_process = false } = await req.json();
    
    console.log(`Creating comprehensive health data bundles - Trigger: ${trigger}, Force: ${force_process}`);
    
    // Get diverse staged health data to create meaningful bundles
    const { data: stagedData, error: stagedError } = await supabase
      .from('staged_health_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (stagedError) {
      throw new Error(`Failed to fetch staged data: ${stagedError.message}`);
    }

    if (!stagedData || stagedData.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No staged data available for bundle generation',
        bundles_created: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${stagedData.length} staged health records for bundle generation`);

    // Categorize data by type for diverse bundle creation
    const categorizedData = {
      cardiovascular: stagedData.filter(d => 
        d.average_heartrate || d.heart_rate_variability_ms || d.blood_oxygen_saturation || 
        d.systolic_blood_pressure || d.vo2_max
      ),
      nutrition: stagedData.filter(d => 
        d.dietary_energy_kcal || d.protein_g || d.carbohydrates_g || d.total_fat_g || 
        d.water_ml || d.vitamin_c_mg || d.calcium_mg
      ),
      sleep: stagedData.filter(d => 
        d.sleep_duration || d.time_asleep_minutes || d.rem_duration_minutes || 
        d.deep_sleep_duration_minutes || d.time_in_bed_minutes
      ),
      fitness: stagedData.filter(d => 
        d.steps_count || d.distance_meters || d.distance_walking_running_meters || 
        d.calories_burned || d.workout_intensity
      ),
      clinical: stagedData.filter(d => 
        d.clinical_medications || d.clinical_conditions || d.clinical_lab_results || 
        d.clinical_allergies || d.clinical_procedures
      ),
      reproductive: stagedData.filter(d => 
        d.menstrual_flow || d.basal_body_temperature_celsius || d.cervical_mucus_quality || 
        d.ovulation_test_result
      ),
      mental_health: stagedData.filter(d => 
        d.mindful_minutes || d.mood_score || d.emotional_state || d.stress_level
      ),
      body_composition: stagedData.filter(d => 
        d.weight_kg || d.height_cm || d.body_mass_index || d.body_fat_percentage || 
        d.lean_body_mass_kg || d.waist_circumference_cm
      )
    };

    const bundlesToCreate = [];

    // Create cardiovascular health bundle
    if (categorizedData.cardiovascular.length > 0) {
      bundlesToCreate.push({
        title: 'Cardiovascular Health Insights',
        category: 'cardiovascular',
        description: 'Comprehensive heart health data including heart rate variability, blood pressure, and oxygen saturation metrics',
        data: categorizedData.cardiovascular.slice(0, 15),
        features: ['Heart Rate Monitoring', 'Blood Pressure Tracking', 'Oxygen Saturation', 'VO2 Max Analysis'],
        key_insights: [
          'Heart rate variability trends',
          'Blood pressure patterns',
          'Cardiovascular fitness indicators',
          'Recovery metrics'
        ],
        tier: 'premium',
        price: 25,
        data_points: ['heart_rate', 'blood_pressure', 'oxygen_saturation', 'hrv', 'vo2_max']
      });
    }

    // Create comprehensive nutrition bundle
    if (categorizedData.nutrition.length > 0) {
      bundlesToCreate.push({
        title: 'Complete Nutrition Analysis',
        category: 'nutrition',
        description: 'Detailed dietary intake data including macronutrients, micronutrients, and hydration tracking',
        data: categorizedData.nutrition.slice(0, 12),
        features: ['Macro Tracking', 'Vitamin Analysis', 'Hydration Monitoring', 'Caloric Insights'],
        key_insights: [
          'Nutritional balance assessment',
          'Vitamin and mineral intake',
          'Hydration patterns',
          'Caloric distribution analysis'
        ],
        tier: 'standard',
        price: 18,
        data_points: ['calories', 'protein', 'carbs', 'fats', 'vitamins', 'minerals', 'water']
      });
    }

    // Create sleep analysis bundle
    if (categorizedData.sleep.length > 0) {
      bundlesToCreate.push({
        title: 'Advanced Sleep Analytics',
        category: 'sleep',
        description: 'Comprehensive sleep data with stage analysis, quality metrics, and recovery insights',
        data: categorizedData.sleep.slice(0, 10),
        features: ['Sleep Stage Analysis', 'Recovery Tracking', 'Sleep Quality Scoring', 'Circadian Rhythm'],
        key_insights: [
          'Sleep stage distribution',
          'Sleep quality trends',
          'Recovery optimization',
          'Circadian rhythm patterns'
        ],
        tier: 'premium',
        price: 22,
        data_points: ['sleep_duration', 'sleep_stages', 'sleep_quality', 'recovery_score']
      });
    }

    // Create fitness performance bundle
    if (categorizedData.fitness.length > 0) {
      bundlesToCreate.push({
        title: 'Fitness Performance Metrics',
        category: 'fitness',
        description: 'Activity tracking data including steps, distance, workouts, and performance analytics',
        data: categorizedData.fitness.slice(0, 20),
        features: ['Activity Tracking', 'Workout Analysis', 'Performance Trends', 'Calorie Burn'],
        key_insights: [
          'Activity level patterns',
          'Workout performance trends',
          'Calorie burn efficiency',
          'Fitness progression metrics'
        ],
        tier: 'basic',
        price: 12,
        data_points: ['steps', 'distance', 'workouts', 'calories_burned', 'activity_zones']
      });
    }

    // Create clinical health bundle
    if (categorizedData.clinical.length > 0) {
      bundlesToCreate.push({
        title: 'Clinical Health Records',
        category: 'clinical',
        description: 'Medical data including lab results, medications, conditions, and clinical assessments',
        data: categorizedData.clinical.slice(0, 8),
        features: ['Lab Results', 'Medication Tracking', 'Health Conditions', 'Clinical Assessments'],
        key_insights: [
          'Lab result trends',
          'Medication adherence',
          'Health condition monitoring',
          'Clinical risk factors'
        ],
        tier: 'premium',
        price: 35,
        data_points: ['lab_results', 'medications', 'conditions', 'allergies', 'procedures']
      });
    }

    // Create reproductive health bundle
    if (categorizedData.reproductive.length > 0) {
      bundlesToCreate.push({
        title: 'Reproductive Health Tracking',
        category: 'reproductive',
        description: 'Menstrual cycle data, fertility tracking, and reproductive health metrics',
        data: categorizedData.reproductive.slice(0, 6),
        features: ['Cycle Tracking', 'Fertility Monitoring', 'Symptom Analysis', 'Hormonal Insights'],
        key_insights: [
          'Menstrual cycle patterns',
          'Fertility window predictions',
          'Hormonal fluctuations',
          'Reproductive health trends'
        ],
        tier: 'standard',
        price: 16,
        data_points: ['menstrual_cycle', 'fertility_tracking', 'basal_temperature', 'symptoms']
      });
    }

    // Create mental health bundle
    if (categorizedData.mental_health.length > 0) {
      bundlesToCreate.push({
        title: 'Mental Wellness Analytics',
        category: 'mental_health',
        description: 'Mindfulness data, mood tracking, and mental wellness indicators',
        data: categorizedData.mental_health.slice(0, 8),
        features: ['Mood Tracking', 'Mindfulness Sessions', 'Stress Analysis', 'Wellness Scoring'],
        key_insights: [
          'Mood pattern analysis',
          'Mindfulness practice trends',
          'Stress level indicators',
          'Mental wellness scoring'
        ],
        tier: 'standard',
        price: 14,
        data_points: ['mood_tracking', 'mindfulness', 'stress_levels', 'wellness_score']
      });
    }

    // Create body composition bundle
    if (categorizedData.body_composition.length > 0) {
      bundlesToCreate.push({
        title: 'Body Composition Analysis',
        category: 'body_composition',
        description: 'Comprehensive body metrics including weight, body fat, lean mass, and measurements',
        data: categorizedData.body_composition.slice(0, 8),
        features: ['Weight Tracking', 'Body Fat Analysis', 'Lean Mass Monitoring', 'Measurement Tracking'],
        key_insights: [
          'Weight change patterns',
          'Body composition trends',
          'Lean mass progression',
          'Health ratio analysis'
        ],
        tier: 'basic',
        price: 10,
        data_points: ['weight', 'body_fat', 'lean_mass', 'bmi', 'measurements']
      });
    }

    const createdBundles = [];

    // Create each bundle
    for (const bundleData of bundlesToCreate) {
      try {
        const bundleId = crypto.randomUUID();
        
        const { data: bundle, error: bundleError } = await supabase
          .from('marketplace_bundles')
          .insert({
            bundle_id: bundleId,
            title: bundleData.title,
            category: bundleData.category,
            description: bundleData.description,
            tier: bundleData.tier,
            price: bundleData.price,
            features: bundleData.features,
            key_insights: bundleData.key_insights,
            data_points: bundleData.data_points,
            contacts_count: bundleData.data.length,
            match_percentage: Math.floor(Math.random() * 15) + 85, // 85-100%
            data_json: {
              health_data: bundleData.data.map(d => ({
                id: d.id,
                activity_type: d.activity_type,
                data_quality_score: d.data_quality_score,
                data_completeness_score: d.data_completeness_score,
                processed_at: d.processed_at,
                key_metrics: extractKeyMetrics(d, bundleData.category)
              })),
              bundle_metadata: {
                category: bundleData.category,
                generation_timestamp: new Date().toISOString(),
                data_variety: 'comprehensive',
                source: 'apple_health_comprehensive'
              }
            },
            is_active: true,
            bundle_version: 1
          })
          .select()
          .single();

        if (bundleError) {
          console.error(`Error creating ${bundleData.category} bundle:`, bundleError);
        } else {
          createdBundles.push({
            bundle_id: bundleId,
            category: bundleData.category,
            title: bundleData.title,
            records: bundleData.data.length
          });
          
          // Log bundle generation
          await supabase
            .from('bundle_generation_logs')
            .insert({
              bundle_id: bundleId,
              generation_type: 'comprehensive_health',
              data_source_count: bundleData.data.length,
              quality_metrics: {
                data_variety: bundleData.category,
                avg_completeness: bundleData.data.reduce((sum, d) => sum + (d.data_completeness_score || 0), 0) / bundleData.data.length,
                avg_quality: bundleData.data.reduce((sum, d) => sum + (d.data_quality_score || 0), 0) / bundleData.data.length
              }
            });
        }
      } catch (error) {
        console.error(`Error creating ${bundleData.category} bundle:`, error);
      }
    }

    console.log(`Successfully created ${createdBundles.length} comprehensive health data bundles`);
    console.log('Bundle categories:', createdBundles.map(b => b.category).join(', '));

    return new Response(JSON.stringify({
      success: true,
      message: 'Comprehensive health data bundles created successfully',
      bundles_created: createdBundles.length,
      bundles: createdBundles,
      data_categories: Object.keys(categorizedData).filter(key => categorizedData[key].length > 0)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Health Data Bundle Creation Error:', error.message);
    return new Response(JSON.stringify({
      error: error.message,
      success: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    });
  }
});

function extractKeyMetrics(data: any, category: string): any {
  const metrics: any = {};
  
  switch (category) {
    case 'cardiovascular':
      if (data.average_heartrate) metrics.heart_rate = data.average_heartrate;
      if (data.heart_rate_variability_ms) metrics.hrv = data.heart_rate_variability_ms;
      if (data.blood_oxygen_saturation) metrics.oxygen_saturation = data.blood_oxygen_saturation;
      if (data.systolic_blood_pressure) metrics.blood_pressure_systolic = data.systolic_blood_pressure;
      if (data.vo2_max) metrics.vo2_max = data.vo2_max;
      break;
      
    case 'nutrition':
      if (data.dietary_energy_kcal) metrics.calories = data.dietary_energy_kcal;
      if (data.protein_g) metrics.protein = data.protein_g;
      if (data.carbohydrates_g) metrics.carbs = data.carbohydrates_g;
      if (data.total_fat_g) metrics.fat = data.total_fat_g;
      if (data.water_ml) metrics.water = data.water_ml;
      break;
      
    case 'sleep':
      if (data.time_asleep_minutes) metrics.sleep_duration = data.time_asleep_minutes;
      if (data.rem_duration_minutes) metrics.rem_sleep = data.rem_duration_minutes;
      if (data.deep_sleep_duration_minutes) metrics.deep_sleep = data.deep_sleep_duration_minutes;
      if (data.sleep_quality_score) metrics.sleep_quality = data.sleep_quality_score;
      break;
      
    case 'fitness':
      if (data.steps_count) metrics.steps = data.steps_count;
      if (data.distance_meters) metrics.distance = data.distance_meters;
      if (data.calories_burned) metrics.calories_burned = data.calories_burned;
      if (data.workout_intensity) metrics.intensity = data.workout_intensity;
      break;
      
    case 'clinical':
      if (data.clinical_medications) metrics.medications = data.clinical_medications;
      if (data.clinical_lab_results) metrics.lab_results = data.clinical_lab_results;
      if (data.clinical_conditions) metrics.conditions = data.clinical_conditions;
      break;
      
    default:
      metrics.data_quality = data.data_quality_score;
      metrics.completeness = data.data_completeness_score;
  }
  
  return metrics;
}