// Index page — straight to MainApp after auth
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import FlashingSplashScreen from '@/components/FlashingSplashScreen';
import LandingScreen from '@/components/LandingScreen';
import MainApp from '@/components/MainApp';

const Index = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showFlashingSplash, setShowFlashingSplash] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      setIsAuthenticated(!!user);
      // AoR gate: if user accepted ToS but hasn't decided AoR, route them there.
      if (user) {
        const meta: any = user.user_metadata || {};
        if (meta.tos_accepted_at && !meta.aor_decision) {
          navigate('/authority-of-record', { replace: true });
        }
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSignUp = () => {
    navigate('/auth');
  };

  const handleFlashingSplashComplete = () => {
    setShowFlashingSplash(false);
  };

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

  return <MainApp />;
};

export default Index;
