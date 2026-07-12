import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff, Mail, Lock, User, KeyRound } from "lucide-react";
import { runVaultGuard } from "@/lib/vaultGuard";
import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const defaultIsLogin = searchParams.get("mode") !== "signup";

  // Standard Auth States
  const [isLogin, setIsLogin] = useState(defaultIsLogin);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // OTP Password Reset States
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isResetLoading, setIsResetLoading] = useState(false);

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const returnTo = searchParams.get("return_to");
    if (returnTo === "hub") {
      sessionStorage.setItem("return_to_hub", "true");
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && !isResetMode) {
        console.log("[START] Auth: post-auth Vault Guard handoff");
        try {
          const { isNewUser } = await runVaultGuard(session.user.id);
          console.log(`[END] Auth: routing → ${isNewUser ? "/recovery-phrase" : "/"}`);
          navigate(isNewUser ? "/recovery-phrase" : "/", { replace: true });
        } catch (e: any) {
          console.error("[ERROR] Auth: Vault Guard failed, falling back to dashboard", e);
          toast({ title: "Vault check failed", description: e.message, variant: "destructive" });
          navigate("/", { replace: true });
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, searchParams, isResetMode, toast]);

  // ── Native iOS ASWebAuthenticationSession cancellation/success bridge ──
  useEffect(() => {
    const handleNativeAuthMessage = (event: MessageEvent) => {
      const type = event?.data?.type;
      if (type === "IDIA_AUTH_CANCELLED") {
        console.log("[NATIVE_BRIDGE] Auth cancelled by user or failed.");
        setIsLoading(false);
        toast({ title: "Sign in cancelled", description: "Please try again when you're ready." });
      } else if (type === "IDIA_AUTH_COMPLETE") {
        console.log("[NATIVE_BRIDGE] Auth handshake completed.");
        setIsLoading(false);
      }
    };
    window.addEventListener("message", handleNativeAuthMessage);
    return () => window.removeEventListener("message", handleNativeAuthMessage);
  }, [toast]);


  // ==========================================
  // 1. STANDARD AUTH (LOGIN / SIGNUP / OAUTH)
  // ==========================================
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        supabase.functions.invoke("send-security-alert", { body: { event: "new_login" } }).catch(() => {});
        toast({ title: "Welcome back!", description: "You've been signed in successfully." });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          // Surgical Fix: Land on root after email confirmation
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        toast({ title: "Account created!", description: "Please check your email to verify your account." });
      }
    } catch (error: any) {
      toast({ title: "Authentication failed", description: error.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: "google" | "apple") => {
    setIsLoading(true);
    console.log(`[START] OAuth Sign-In Dispatch · provider=${provider}`);
    try {
      const { Capacitor } = await import("@capacitor/core");
      const isNative = Capacitor.isNativePlatform();
      const platform = Capacitor.getPlatform();
      console.log(`[INFO][OAUTH] platform=${platform} isNative=${isNative}`);

      if (provider === "apple" && isNative) {
        console.log("[START] Native Apple Sign-In Intercept");
        const { SignInWithApple } = await import("@capacitor-community/apple-sign-in");

        // 1. Native Apple UI — requests Name & Email (only present on first sign-in)
        const result: any = await SignInWithApple.authorize({
          clientId: "com.thebigidia.app",
          redirectURI: `${window.location.origin}/`,
          scopes: "email name",
        });

        // 2. Intercept PII on-device — seal in Secure Enclave
        if (result?.response?.email || result?.response?.givenName) {
          console.log("[APPLE_AUTH] PII detected. Sealing in local Secure Enclave.");
          const piiPayload = {
            first_name: result.response.givenName || "",
            last_name: result.response.familyName || "",
            email: result.response.email || "",
            phone: "",
          };
          await SecureStoragePlugin.set({
            key: "user_pii_profile",
            value: JSON.stringify(piiPayload),
          });
        }

        // 3. Authenticate with Supabase using only the cryptographic ID token (zero PII)
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "apple",
          token: result.response.identityToken,
        });
        if (error) throw error;
        console.log("[END] Native Apple Auth Complete.");
      } else if (provider === "google" && isNative) {
        // ============================================================
        // NATIVE GOOGLE SIGN-IN INTERCEPT (Android primarily; also iOS)
        // Mirrors the Apple flow: native UI → seal PII in Secure Enclave
        // → exchange ID token via Supabase signInWithIdToken (zero-PII DB)
        // ============================================================
        console.log("[START] Native Google Sign-In Intercept");

        console.log("[START][GOOGLE_AUTH] Dynamic import of @codetrix-studio/capacitor-google-auth");
        const { GoogleAuth } = await import("@codetrix-studio/capacitor-google-auth");
        console.log("[END][GOOGLE_AUTH] Plugin module loaded");

        console.log("[START][GOOGLE_AUTH] Plugin initialize()");
        try {
          await GoogleAuth.initialize({
            clientId:
              "349472255801-091p5a3320h0kb9636hjsd2otfs160ct.apps.googleusercontent.com",
            scopes: ["profile", "email"],
            grantOfflineAccess: false,
          });
          console.log("[END:OK][GOOGLE_AUTH] Plugin initialized");
        } catch (initErr: any) {
          console.error("[END:FAIL][GOOGLE_AUTH] initialize() threw", initErr?.message || initErr);
          throw initErr;
        }

        console.log("[START][GOOGLE_AUTH] signIn() — awaiting native consent sheet");
        const result: any = await GoogleAuth.signIn();
        console.log("[END:OK][GOOGLE_AUTH] signIn resolved", {
          hasIdToken: !!result?.authentication?.idToken,
          hasEmail: !!result?.email,
          hasName: !!(result?.givenName || result?.familyName),
        });

        // Zero-PII: seal name/email locally; never persist to Supabase public schema
        if (result?.email || result?.givenName || result?.familyName) {
          console.log("[START][GOOGLE_AUTH] Sealing PII in Secure Enclave");
          const piiPayload = {
            first_name: result.givenName || "",
            last_name: result.familyName || "",
            email: result.email || "",
            phone: "",
          };
          try {
            await SecureStoragePlugin.set({
              key: "user_pii_profile",
              value: JSON.stringify(piiPayload),
            });
            console.log("[END:OK][GOOGLE_AUTH] PII sealed in Secure Enclave");
          } catch (sealErr: any) {
            console.error(
              "[END:FAIL][GOOGLE_AUTH] Secure Enclave seal failed",
              sealErr?.message || sealErr,
            );
            // Non-fatal — continue with Supabase auth so user can still log in.
          }
        } else {
          console.log("[INFO][GOOGLE_AUTH] No PII returned (returning user) — skip seal");
        }

        const idToken: string | undefined = result?.authentication?.idToken;
        if (!idToken) {
          console.error("[END:FAIL][GOOGLE_AUTH] No idToken on plugin result");
          throw new Error("Google Sign-In returned no ID token.");
        }

        console.log("[START][GOOGLE_AUTH] supabase.auth.signInWithIdToken");
        const { error } = await supabase.auth.signInWithIdToken({
          provider: "google",
          token: idToken,
        });
        if (error) {
          console.error("[END:FAIL][GOOGLE_AUTH] Supabase token exchange failed", error.message);
          throw error;
        }
        console.log("[END:OK][GOOGLE_AUTH] Supabase session established");
        console.log("[END] Native Google Auth Complete.");
      } else {
        console.log(`[INFO][OAUTH] Falling back to web signInWithOAuth · provider=${provider}`);
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: isNative ? "idialife://auth-callback" : `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        console.log("[END][OAUTH] Web OAuth redirect dispatched");
      }
      console.log(`[END] OAuth Sign-In Dispatch · provider=${provider}`);
    } catch (error: any) {
      console.error(`[END:FAIL] OAuth Sign-In · provider=${provider}`, error?.message || error);
      toast({ title: `${provider} Sign In failed`, description: error.message, variant: "destructive" });
      setIsLoading(false);
    }
  };

  // ==========================================
  // 2. OTP PASSWORD RESET FLOW
  // ==========================================

  // Step 1: Request the 6-Digit Code
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetLoading(true);

    try {
      // DISCUSSION: Route through the God-Mode Edge Function instead of the client SDK.
      // This forces the email to send even if the account is shadowed by Apple Sign-In.
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { email: resetEmail },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Code Sent!",
        description: "Check your email for the 6-digit recovery code.",
      });
      setResetStep("verify");
    } catch (error: any) {
      toast({ title: "Failed to send code", description: error.message, variant: "destructive" });
    } finally {
      setIsResetLoading(false);
    }
  };

  // Step 2: Verify Code and Set New Password
  const handleVerifyAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetLoading(true);

    try {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        email: resetEmail,
        token: otpCode,
        type: "recovery",
      });
      if (verifyError) throw verifyError;

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;

      supabase.functions.invoke("send-security-alert", { body: { event: "password_changed" } }).catch(() => {});

      toast({
        title: "Password Updated!",
        description: "Your password has been successfully changed. You can now log into IDIA Hub.",
      });

      setResetStep("request");
      setResetEmail("");
      setOtpCode("");
      setNewPassword("");
      setIsResetMode(false);
      // Surgical Fix: Land on root after reset
      navigate("/");
    } catch (error: any) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } finally {
      setIsResetLoading(false);
    }
  };

  // ==========================================
  // RENDER: PASSWORD RESET UI
  // ==========================================
  if (isResetMode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Reset Password</CardTitle>
            <p className="text-sm text-gray-600 text-center">
              {resetStep === "request"
                ? "Enter your email address and we'll send you a 6-digit code."
                : "Enter the 6-digit code sent to your email and your new password."}
            </p>
          </CardHeader>
          <CardContent>
            {resetStep === "request" ? (
              <form onSubmit={handleRequestOTP} className="space-y-4">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="email"
                    placeholder="Enter your email"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isResetLoading}>
                  {isResetLoading ? "Sending Code..." : "Send Reset Code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerifyAndReset} className="space-y-4">
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="6-Digit Code"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    className="pl-10 tracking-widest font-mono text-center"
                    maxLength={6}
                    required
                  />
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="New Password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                </div>
                <Button type="submit" className="w-full" disabled={isResetLoading}>
                  {isResetLoading ? "Updating..." : "Update Password"}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Button
                variant="link"
                onClick={() => {
                  setIsResetMode(false);
                  setResetStep("request");
                }}
                className="text-sm"
              >
                Back to sign in
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ==========================================
  // RENDER: STANDARD AUTH UI
  // ==========================================
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <p className="text-sm text-gray-600 text-center">
            {isLogin ? "Sign in to your account to continue" : "Sign up to get started with IDIA"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 h-4 w-4 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff /> : <Eye />}
              </button>
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              <User className="mr-2 h-4 w-4" />
              {isLoading ? (isLogin ? "Signing in..." : "Creating account...") : isLogin ? "Sign In" : "Sign Up"}
            </Button>
          </form>

          <div className="my-4 text-center">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn("apple")}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              Sign in with Apple
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn("google")}
              disabled={isLoading}
            >
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Sign in with Google
            </Button>
          </div>

          {isLogin && (
            <div className="mt-4 text-center">
              <Button variant="link" onClick={() => setIsResetMode(true)} className="text-sm">
                Forgot your password?
              </Button>
            </div>
          )}

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              {isLogin ? "Don't have an account? " : "Already have an account? "}
              <Button variant="link" onClick={() => setIsLogin(!isLogin)} className="text-sm p-0 font-semibold">
                {isLogin ? "Sign up" : "Sign in"}
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
