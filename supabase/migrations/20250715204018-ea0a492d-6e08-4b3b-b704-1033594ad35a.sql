-- Update profiles table to replace full_name with separate name fields
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS full_name;

ALTER TABLE public.profiles 
ADD COLUMN first_name TEXT,
ADD COLUMN last_name TEXT,
ADD COLUMN middle_name TEXT,
ADD COLUMN suffix TEXT;

-- Add missing high_contrast column to user_preferences
ALTER TABLE public.user_preferences 
ADD COLUMN IF NOT EXISTS high_contrast BOOLEAN DEFAULT false;

-- Update the handle_new_user function to use first_name instead of full_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'first_name',
    NEW.raw_user_meta_data ->> 'last_name'
  );
  
  INSERT INTO public.user_preferences (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;