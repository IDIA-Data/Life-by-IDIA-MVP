
// Updated Index page with sovereign onboarding gate
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { SecureStoragePlugin } from 'capacitor-secure-storage-plugin';
import FlashingSplashScreen from '@/components/FlashingSplashScreen';
import LandingScreen from '@/components/LandingScreen';
import MainApp from '@/components/MainApp';

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showFlashingSplash, setShowFlashingSplash] = useState(true);
  const [piiChecked, setPiiChecked] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session?.user);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check for on-device PII after auth is confirmed
  useEffect(() => {
    if (isAuthenticated !== true) return;

    const checkPII = async () => {
      try {
        await SecureStoragePlugin.get({ key: 'user_pii_profile' });
        setPiiChecked(true); // PII exists, proceed
      } catch {
        // No PII on device — redirect to sovereign onboarding
        navigate('/onboarding', { replace: true });
      }
    };

    checkPII();
  }, [isAuthenticated, navigate]);

  const handleSignUp = () => {
    navigate('/auth');
  };

  const handleFlashingSplashComplete = () => {
    setShowFlashingSplash(false);
  };

  // Show loading state while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-foreground text-center">
          <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showFlashingSplash) {
      return <FlashingSplashScreen onComplete={handleFlashingSplashComplete} />;
    }
    return <LandingScreen onSignUp={handleSignUp} />;
  }

  // Wait for PII check before rendering MainApp
  if (!piiChecked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-foreground border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return <MainApp />;
};

export default Index;
