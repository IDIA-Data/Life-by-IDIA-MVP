import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  middle_name: string | null;
  suffix: string | null;
  date_of_birth: string | null;
  gender: string | null;
  location: string | null;
  phone_number: string | null;
  full_legal_address: Record<string, string> | null;
  occupation: string | null;
  bio: string | null;
  interests: string[];
  health_goals: string[];
  activity_preferences: string[];
  created_at: string;
  updated_at: string;
  display_name?: string | null;
  ai_assistant_name?: string | null;
  avatar_url?: string | null;
  kyc_status?: string | null;
  account_type?: string | null;
  ai_context?: any;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  theme_preference: 'light' | 'dark';
  colorblind_mode: boolean;
  high_contrast: boolean;
  font_size: 'small' | 'medium' | 'large';
  data_sharing_consent: boolean;
  marketing_emails: boolean;
  push_notifications: boolean;
  created_at: string;
  updated_at: string;
  in_app_alerts?: boolean;
  in_app_sounds?: boolean;
  push_activity?: boolean;
  push_insights?: boolean;
  quiet_hours_enabled?: boolean;
  quiet_hours_start?: string;
  quiet_hours_end?: string;
  email_reports?: boolean;
  privacy_motion?: boolean;
  privacy_camera?: boolean;
  privacy_health?: boolean;
  privacy_bluetooth?: boolean;
  privacy_microphone?: boolean;
  privacy_nfc?: boolean;
}

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    console.log("[useProfile] loadProfile START: Fetching user profile and preferences");
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) {
        console.error("[useProfile] loadProfile ERROR: Auth fetch failed", authError);
        setLoading(false);
        return;
      }
      if (!user) {
        console.log("[useProfile] loadProfile WARN: No authenticated user session found");
        setLoading(false);
        return;
      }

      console.log(`[useProfile] loadProfile: Executing profile query for user_id: ${user.id}`);
      // Use maybeSingle() to prevent PGRST116 if the row doesn't exist yet
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (profileError) {
        console.error('[useProfile] loadProfile ERROR: Failed to load profile', profileError);
      } else if (profileData) {
        console.log('[useProfile] loadProfile SUCCESS: Profile payload retrieved');
        setProfile(profileData as unknown as Profile);
      } else {
        console.log('[useProfile] loadProfile INFO: Profile row currently absent');
      }

      console.log(`[useProfile] loadProfile: Executing preferences query for user_id: ${user.id}`);
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (preferencesError) {
        console.error('[useProfile] loadProfile ERROR: Failed to load preferences', preferencesError);
      } else if (preferencesData) {
        console.log('[useProfile] loadProfile SUCCESS: Preferences payload retrieved');
        setPreferences(preferencesData as UserPreferences);
      } else {
        console.log('[useProfile] loadProfile INFO: Preferences row currently absent');
      }

    } catch (error) {
      console.error('[useProfile] loadProfile ERROR: Unexpected exception caught during fetch', error);
    } finally {
      setLoading(false);
      console.log("[useProfile] loadProfile END: Execution block complete");
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    console.log("[useProfile] updateProfile START: Processing profile update command", updates);
    setUpdating(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("[useProfile] updateProfile ERROR: Auth validation failed", authError);
        throw authError;
      }
      if (!user) {
        console.error("[useProfile] updateProfile ERROR: No authenticated user found for operation");
        throw new Error('No user found');
      }

      let response;
      
      if (profile?.id) {
        console.log(`[useProfile] updateProfile: Emitting UPDATE for existing profile ID: ${profile.id}`);
        response = await (supabase.from('profiles') as any)
          .update(updates)
          .eq('id', profile.id)
          .select()
          .single();
      } else {
        console.log(`[useProfile] updateProfile: Emitting UPDATE by user_id check: ${user.id}`);
        response = await (supabase.from('profiles') as any)
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .maybeSingle();

        // Fallback: If no rows were updated, tunnel a new record
        if (!response.data && !response.error) {
          console.log(`[useProfile] updateProfile WARN: Update target absent. Pivoting to INSERT for user_id: ${user.id}`);
          response = await (supabase.from('profiles') as any)
            .insert({ user_id: user.id, ...updates })
            .select()
            .single();
        }
      }

      if (response.error) {
        console.error(`[useProfile] updateProfile ERROR: Supabase mutation failed`, response.error);
        throw response.error;
      }

      console.log(`[useProfile] updateProfile SUCCESS: Profile database record successfully hydrated`, response.data);
      setProfile(response.data as unknown as Profile);

    } catch (error) {
      console.error('[useProfile] updateProfile ERROR: Exception caught in execution block', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
      console.log("[useProfile] updateProfile END: Command release");
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    console.log("[useProfile] updatePreferences START: Processing preferences update command", updates);
    setUpdating(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) {
        console.error("[useProfile] updatePreferences ERROR: Auth validation failed", authError);
        throw authError;
      }
      if (!user) {
        console.error("[useProfile] updatePreferences ERROR: No authenticated user found for operation");
        throw new Error('No user found');
      }

      let response;

      if (preferences?.id) {
        console.log(`[useProfile] updatePreferences: Emitting UPDATE for existing preferences ID: ${preferences.id}`);
        response = await (supabase.from('user_preferences') as any)
          .update(updates)
          .eq('id', preferences.id)
          .select()
          .single();
      } else {
        console.log(`[useProfile] updatePreferences: Emitting UPDATE by user_id check: ${user.id}`);
        response = await (supabase.from('user_preferences') as any)
          .update(updates)
          .eq('user_id', user.id)
          .select()
          .maybeSingle();

        // Fallback: If no rows were updated, tunnel a new record
        if (!response.data && !response.error) {
          console.log(`[useProfile] updatePreferences WARN: Update target absent. Pivoting to INSERT for user_id: ${user.id}`);
          response = await (supabase.from('user_preferences') as any)
            .insert({ user_id: user.id, ...updates })
            .select()
            .single();
        }
      }

      if (response.error) {
        console.error(`[useProfile] updatePreferences ERROR: Supabase mutation failed`, response.error);
        throw response.error;
      }

      console.log(`[useProfile] updatePreferences SUCCESS: Preferences database record successfully hydrated`, response.data);
      setPreferences(response.data as UserPreferences);

    } catch (error) {
      console.error('[useProfile] updatePreferences ERROR: Exception caught in execution block', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
      console.log("[useProfile] updatePreferences END: Command release");
    }
  };

  return {
    profile,
    preferences,
    loading,
    updating,
    updateProfile,
    updatePreferences,
    reload: loadProfile
  };
};