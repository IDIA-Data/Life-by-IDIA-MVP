import { useEffect, useState } from 'react';
import { useTheme as useNextTheme } from 'next-themes';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type Theme = 'light' | 'dark';
type AccessibilityMode = 'normal' | 'colorblind';

interface ThemeConfig {
  theme: Theme;
  accessibilityMode: AccessibilityMode;
}

export const useTheme = () => {
  const { theme: nextTheme, setTheme: setNextTheme } = useNextTheme();
  const [accessibilityMode, setAccessibilityMode] = useState<AccessibilityMode>('normal');
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Load accessibility mode from localStorage on mount
  useEffect(() => {
    const savedAccessibility = localStorage.getItem('accessibility-mode') as AccessibilityMode || 'normal';
    setAccessibilityMode(savedAccessibility);
    applyAccessibilityMode(savedAccessibility);
    
    // Set loading to false after a brief delay to prevent flash
    setTimeout(() => setLoading(false), 100);
  }, []);

  // Load preferences from database for authenticated users
  useEffect(() => {
    const loadUserPreferences = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('theme_preference, colorblind_mode, high_contrast, font_size')
        .eq('user_id', user.id)
        .maybeSingle();

      if (preferences) {
        if (preferences.theme_preference) {
          setNextTheme(preferences.theme_preference);
        }
        if (preferences.colorblind_mode !== null) {
          const newAccessibilityMode = preferences.colorblind_mode ? 'colorblind' : 'normal';
          setAccessibilityMode(newAccessibilityMode);
          applyAccessibilityMode(newAccessibilityMode);
          localStorage.setItem('accessibility-mode', newAccessibilityMode);
        }
        // Apply high contrast and font size
        applyHighContrast(preferences.high_contrast || false);
        applyFontSize((preferences.font_size as 'small' | 'medium' | 'large') || 'medium');
      }
    };

    loadUserPreferences();
  }, [setNextTheme]);

  const applyAccessibilityMode = (mode: AccessibilityMode) => {
    const root = document.documentElement;
    root.classList.remove('colorblind');
    if (mode === 'colorblind') {
      root.classList.add('colorblind');
    }
  };

  const applyHighContrast = (enabled: boolean) => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }
  };

  const applyFontSize = (size: 'small' | 'medium' | 'large') => {
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${size}`);
    
    // Also apply to body for immediate effect
    const sizeMap = { small: '0.875rem', medium: '1rem', large: '1.125rem' };
    document.body.style.fontSize = sizeMap[size];
  };

  const updateTheme = async (newTheme: Theme) => {
    // Apply theme immediately for instant feedback
    setNextTheme(newTheme);
    
    // Save to database in background without blocking UI
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        supabase
          .from('user_preferences')
          .update({ theme_preference: newTheme })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating theme preference:', error);
    }
  };

  const updateAccessibilityMode = async (newMode: AccessibilityMode) => {
    setAccessibilityMode(newMode);
    applyAccessibilityMode(newMode);
    
    // Save to localStorage
    localStorage.setItem('accessibility-mode', newMode);
    
    // Save to database if user is authenticated
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_preferences')
          .update({ colorblind_mode: newMode === 'colorblind' })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating accessibility preference:', error);
      toast({
        title: "Error",
        description: "Failed to save accessibility preferences",
        variant: "destructive"
      });
    }
  };

  const toggleTheme = () => {
    updateTheme(nextTheme === 'light' ? 'dark' : 'light');
  };

  const toggleAccessibilityMode = () => {
    updateAccessibilityMode(accessibilityMode === 'normal' ? 'colorblind' : 'normal');
  };

  const updateHighContrast = async (enabled: boolean) => {
    applyHighContrast(enabled);
    
    // Save to database if user is authenticated
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_preferences')
          .update({ high_contrast: enabled })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating high contrast preference:', error);
      toast({
        title: "Error",
        description: "Failed to save high contrast preference",
        variant: "destructive"
      });
    }
  };

  const updateFontSize = async (size: 'small' | 'medium' | 'large') => {
    applyFontSize(size);
    
    // Save to database if user is authenticated
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('user_preferences')
          .update({ font_size: size })
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error updating font size preference:', error);
      toast({
        title: "Error",
        description: "Failed to save font size preference",
        variant: "destructive"
      });
    }
  };

  return {
    theme: nextTheme as Theme,
    accessibilityMode,
    loading,
    updateTheme,
    updateAccessibilityMode,
    updateHighContrast,
    updateFontSize,
    toggleTheme,
    toggleAccessibilityMode
  };
};