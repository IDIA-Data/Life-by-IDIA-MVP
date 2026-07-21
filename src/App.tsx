import { useState, useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

// PAGE IMPORTS
import Auth from "./pages/Auth";
import Index from "./pages/Index";

import Settings from "./pages/Settings";
import IdentityLedger from "./pages/IdentityLedger";
import NotFound from "./pages/NotFound";
import SecureVault from "./pages/SecureVault";
import RecoveryPhrase from "./pages/RecoveryPhrase";
import TermsOfService from "./pages/TermsOfService";

// NFC PAYMENT IMPORTS
import { usePaymentDeepLink } from "@/hooks/usePaymentDeepLink";
import NfcPaymentModal from "@/components/NfcPaymentModal";
import { startPushBootstrap } from "@/utils/pushBootstrap";
// Architectural Note: Defined outside to prevent re-instantiation on re-renders
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [isFetched, setIsFetched] = useState(false);

  // ── NFC Payment Deep Link ──
  const { paymentRequest, clearPayment } = usePaymentDeepLink();
  const [showNfcPaymentModal, setShowNfcPaymentModal] = useState(false);

  // Auto-open the NFC payment modal when a deep link arrives
  useEffect(() => {
    if (paymentRequest) {
      setShowNfcPaymentModal(true);
    }
  }, [paymentRequest]);

  useEffect(() => {
    console.log("[START] App Lifecycle: Initializing Sovereign Routing & Auth Manifest...");
    startPushBootstrap();

    // ── One-shot stale-session guard (post legacy-JWT rotation) ──
    console.log("[AUTH_SESSION_GUARD][CHECK][START] Validating current user session keys against rotated JWT secrets.");
    supabase.auth.getSession().then(({ data: { session: guardSession }, error: guardError }) => {
      const looksLegacy = !!guardSession?.access_token?.startsWith("eyJhbGciOiJIUzI1NiI");
      if (guardError || looksLegacy) {
        console.warn("🚨 [AUTH_SESSION_GUARD][INVALID_KEY]: Stale or compromised token detected from legacy platform configuration. Initiating local state purge.");
        supabase.auth.signOut({ scope: 'local' }).then(() => {
          console.log("[AUTH_SESSION_GUARD][PURGE][END:OK] Compromised local storage markers cleared safely. Redirecting client to authentication gate.");
          window.location.reload();
        });
        return;
      }
      console.log("[AUTH_SESSION_GUARD][CHECK][END:OK] Session keys authenticated successfully under current perimeter.");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log(`[INFO] Session Sync: ${session ? "Active Session Detected" : "No Session Found"}`);
      setSession(session);
      setIsFetched(true);
    });


    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log(`[EVENT] Auth State Change: ${_event}`);
      setSession(session);
    });

    // Deep link handler for OAuth callbacks on native (Android/iOS)
    // Supabase redirects to idialife://auth-callback#access_token=...
    // The MainActivity intent-filter routes that URL to our app.
    let deepLinkListener: any = null;
    const setupDeepLinks = async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        const { App: CapacitorApp } = await import("@capacitor/app");
        deepLinkListener = await CapacitorApp.addListener("appUrlOpen", async (event: any) => {
          console.log("[DeepLink] Received URL:", event.url);

          const url = event.url;

          // ── Payment URIs: handled by usePaymentDeepLink hook ──
          // Don't process these in the OAuth flow
          if (url.startsWith("idialife://pay") || url.startsWith("ethereum:")) {
            console.log("[DeepLink] Payment URI detected, deferring to usePaymentDeepLink");
            return;
          }

          const fragmentIndex = url.indexOf("#");
          if (fragmentIndex === -1) {
            console.log("[DeepLink] No URL fragment, ignoring");
            return;
          }

          const fragment = url.substring(fragmentIndex + 1);
          const params = new URLSearchParams(fragment);
          const access_token = params.get("access_token");
          const refresh_token = params.get("refresh_token");

          if (access_token && refresh_token) {
            console.log("[DeepLink] Setting Supabase session from OAuth callback");
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });

            if (error) console.error("[DeepLink] Failed to set session:", error);
            else console.log("[DeepLink] Session established:", data.session?.user.email);
          }
        });
      } catch (e) {
        console.error("[DeepLink] Setup failed:", e);
      }
    };
    setupDeepLinks();

    return () => {
      subscription.unsubscribe();
      if (deepLinkListener) deepLinkListener.remove();
    };
  }, []);

  if (!isFetched) return null;

  // MARK: - IDIA Protocol: Unified Entry Point (Hydrated)
  // Stripped Wagmi/RainbowKit to route logic natively through the secure wallet architecture
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem={false}
        themes={["light", "dark"]}
        disableTransitionOnChange
      >
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
              <Route path="/" element={<Index />} />
              <Route path="/dashboard" element={session ? <Index /> : <Navigate to="/auth" replace />} />
              
              <Route path="/terms" element={session ? <TermsOfService /> : <Navigate to="/auth" replace />} />
              <Route path="/recovery-phrase" element={session ? <RecoveryPhrase /> : <Navigate to="/auth" replace />} />
              <Route path="/settings" element={session ? <Settings /> : <Navigate to="/auth" replace />} />
              <Route path="/settings/ledger" element={session ? <IdentityLedger /> : <Navigate to="/auth" replace />} />
              <Route path="/secure-vault" element={session ? <SecureVault /> : <Navigate to="/auth" replace />} />
              <Route path="/secure_vault" element={<Navigate to="/secure-vault" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>

          {/* ── NFC Payment Modal (root level — catches deep links regardless of route) ── */}
          <NfcPaymentModal
            isOpen={showNfcPaymentModal}
            onClose={() => setShowNfcPaymentModal(false)}
            paymentRequest={paymentRequest}
            onClearPayment={clearPayment}
          />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;