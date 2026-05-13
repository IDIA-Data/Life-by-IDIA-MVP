-- Expand staged_health_data table to capture comprehensive Apple HealthKit data

-- Add Body Measurements columns
ALTER TABLE staged_health_data 
ADD COLUMN height_cm NUMERIC,
ADD COLUMN weight_kg NUMERIC,
ADD COLUMN body_mass_index NUMERIC,
ADD COLUMN body_fat_percentage NUMERIC,
ADD COLUMN lean_body_mass_kg NUMERIC,
ADD COLUMN waist_circumference_cm NUMERIC;

-- Add Additional Vitals columns
ALTER TABLE staged_health_data 
ADD COLUMN heart_rate_variability_ms NUMERIC,
ADD COLUMN blood_oxygen_saturation NUMERIC,
ADD COLUMN systolic_blood_pressure NUMERIC,
ADD COLUMN diastolic_blood_pressure NUMERIC,
ADD COLUMN respiratory_rate_per_min NUMERIC,
ADD COLUMN body_temperature_celsius NUMERIC,
ADD COLUMN ecg_classification TEXT,
ADD COLUMN vo2_max NUMERIC;

-- Add Activity & Mobility columns
ALTER TABLE staged_health_data 
ADD COLUMN distance_walking_running_meters NUMERIC,
ADD COLUMN distance_cycling_meters NUMERIC,
ADD COLUMN flights_climbed INTEGER,
ADD COLUMN walking_speed_mps NUMERIC,
ADD COLUMN step_length_cm NUMERIC,
ADD COLUMN walking_asymmetry_percentage NUMERIC,
ADD COLUMN double_support_time_percentage NUMERIC;

-- Add Nutrition columns
ALTER TABLE staged_health_data 
ADD COLUMN dietary_energy_kcal NUMERIC,
ADD COLUMN total_fat_g NUMERIC,
ADD COLUMN saturated_fat_g NUMERIC,
ADD COLUMN polyunsaturated_fat_g NUMERIC,
ADD COLUMN monounsaturated_fat_g NUMERIC,
ADD COLUMN carbohydrates_g NUMERIC,
ADD COLUMN fiber_g NUMERIC,
ADD COLUMN sugar_g NUMERIC,
ADD COLUMN protein_g NUMERIC,
ADD COLUMN water_ml NUMERIC,
ADD COLUMN caffeine_mg NUMERIC,
ADD COLUMN sodium_mg NUMERIC,
ADD COLUMN potassium_mg NUMERIC,
ADD COLUMN vitamin_c_mg NUMERIC,
ADD COLUMN vitamin_d_mcg NUMERIC,
ADD COLUMN calcium_mg NUMERIC,
ADD COLUMN iron_mg NUMERIC;

-- Add Sleep columns (expand existing)
ALTER TABLE staged_health_data 
ADD COLUMN time_in_bed_minutes INTEGER,
ADD COLUMN time_asleep_minutes INTEGER,
ADD COLUMN awake_duration_minutes INTEGER,
ADD COLUMN rem_duration_minutes INTEGER,
ADD COLUMN core_sleep_duration_minutes INTEGER,
ADD COLUMN deep_sleep_duration_minutes INTEGER;

-- Add Reproductive Health columns
ALTER TABLE staged_health_data 
ADD COLUMN menstrual_flow TEXT,
ADD COLUMN cervical_mucus_quality TEXT,
ADD COLUMN ovulation_test_result TEXT,
ADD COLUMN sexual_activity BOOLEAN,
ADD COLUMN basal_body_temperature_celsius NUMERIC;

-- Add Mindfulness & Mental Well-being columns
ALTER TABLE staged_health_data 
ADD COLUMN mindful_minutes INTEGER,
ADD COLUMN mood_score INTEGER,
ADD COLUMN emotional_state TEXT;

-- Add Symptoms columns (store as JSONB for flexibility)
ALTER TABLE staged_health_data 
ADD COLUMN symptoms_logged JSONB;

-- Add Clinical Records columns (FHIR standard)
ALTER TABLE staged_health_data 
ADD COLUMN clinical_allergies JSONB,
ADD COLUMN clinical_conditions JSONB,
ADD COLUMN clinical_immunizations JSONB,
ADD COLUMN clinical_lab_results JSONB,
ADD COLUMN clinical_medications JSONB,
ADD COLUMN clinical_procedures JSONB,
ADD COLUMN clinical_vitals JSONB;

-- Add Medication Tracking columns
ALTER TABLE staged_health_data 
ADD COLUMN medication_doses JSONB,
ADD COLUMN medication_adherence_score NUMERIC;

-- Add metadata for data source tracking
ALTER TABLE staged_health_data 
ADD COLUMN healthkit_source_bundles JSONB,
ADD COLUMN data_completeness_score NUMERIC DEFAULT 0.5;

-- Update the data quality score calculation function to include new metrics
CREATE OR REPLACE FUNCTION public.calculate_comprehensive_data_quality_score(
  p_basic_metrics_count INTEGER DEFAULT 0,
  p_vitals_count INTEGER DEFAULT 0,
  p_nutrition_count INTEGER DEFAULT 0,
  p_sleep_data BOOLEAN DEFAULT FALSE,
  p_clinical_data BOOLEAN DEFAULT FALSE,
  p_symptoms_count INTEGER DEFAULT 0
) RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
AS $function$
DECLARE
  quality_score NUMERIC := 0.3; -- Base score
BEGIN
  -- Basic metrics scoring (steps, heart rate, etc.)
  quality_score := quality_score + (p_basic_metrics_count * 0.1);
  
  -- Vitals data scoring
  quality_score := quality_score + (p_vitals_count * 0.08);
  
  -- Nutrition data scoring
  quality_score := quality_score + (p_nutrition_count * 0.05);
  
  -- Sleep data bonus
  IF p_sleep_data THEN quality_score := quality_score + 0.15; END IF;
  
  -- Clinical data bonus
  IF p_clinical_data THEN quality_score := quality_score + 0.2; END IF;
  
  -- Symptoms logging bonus
  quality_score := quality_score + (p_symptoms_count * 0.02);
  
  -- Cap at 1.0
  IF quality_score > 1.0 THEN quality_score := 1.0; END IF;
  
  RETURN quality_score;
END;
$function$;