
/// <reference types="node" />
import { CapacitorConfig } from "@capacitor/cli";

// Try to load .env for per-machine overrides. If anything goes wrong
// (missing file, dotenv not installed, parse error), fall back to defaults silently.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config();
} catch {
  // dotenv missing or .env load failed — defaults will be used
}

console.log("[INFO] Loading Capacitor Configuration");

const USE_LOVABLE = process.env.CAPACITOR_USE_LOVABLE !== "false";

console.log(`[INFO] Capacitor server source: ${USE_LOVABLE ? "Lovable preview URL" : "Local dist/ build"}`);

const config: CapacitorConfig = {
  appId: "com.idia.life",
  appName: "IDIA Life",
  webDir: "dist",
  server: {
    androidScheme: "https",
    allowNavigation: [
      "*.coinbase.com",
      "*.base.org",
      "106c540d-44fd-41bf-9be1-771a4d91effc.lovableproject.com",
    ],
    ...(USE_LOVABLE
      ? {
          url: "https://106c540d-44fd-41bf-9be1-771a4d91effc.lovableproject.com?forceHideBadge=true",
          cleartext: true,
        }
      : {}),
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#1a1a2e",
    },
  bundledWebRuntime: false,
};

export default config;