-- Fix database functions to use sha256 instead of digest
-- This resolves the "function digest(bytea, text) does not exist" error

-- Update generate_pseudonym function to use sha256 directly
CREATE OR REPLACE FUNCTION public.generate_pseudonym(input_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT encode(sha256((input_text || 'IDIA_SALT_2024')::bytea), 'hex');
$function$;

-- Update anonymize_location function to use sha256 directly  
CREATE OR REPLACE FUNCTION public.anonymize_location(lat numeric, lng numeric)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT 'ZONE_' || encode(sha256((ROUND(lat, 1)::TEXT || '_' || ROUND(lng, 1)::TEXT)::bytea), 'hex')::CHAR(8);
$function$;