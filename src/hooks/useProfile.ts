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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error loading profile:', profileError);
      } else if (profileData) {
        setProfile(profileData as unknown as Profile);
      }

      // Load preferences
      const { data: preferencesData, error: preferencesError } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (preferencesError && preferencesError.code !== 'PGRST116') {
        console.error('Error loading preferences:', preferencesError);
      } else if (preferencesData) {
        setPreferences(preferencesData as UserPreferences);
      }

    } catch (error) {
      console.error('Error loading profile data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await (supabase
        .from('profiles') as any)
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setProfile(data as unknown as Profile);
      toast({
        title: "Success",
        description: "Profile updated successfully"
      });

    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
    }
  };

  const updatePreferences = async (updates: Partial<UserPreferences>) => {
    setUpdating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No user found');

      const { data, error } = await (supabase
        .from('user_preferences') as any)
        .update(updates)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setPreferences(data as UserPreferences);
      toast({
        title: "Success",
        description: "Preferences updated successfully"
      });

    } catch (error) {
      console.error('Error updating preferences:', error);
      toast({
        title: "Error",
        description: "Failed to update preferences",
        variant: "destructive"
      });
    } finally {
      setUpdating(false);
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