/**
 * Push notification bootstrap.
 *
 * Mounted once from App.tsx. Attaches listeners for tokens delivered by
 * either the iOS raw-WKWebView shell (via `push:token-received` /
 * `push:permission-denied` window CustomEvents) or the Android Capacitor
 * shell (via `@capacitor/push-notifications` events). Persists any token
 * that arrives while a user is authenticated so pushes work even if
 * Settings is never opened.
 *
 * Foreground push receipt on Android surfaces via `notify.info(...)`
 * which respects Focus Mode / quiet hours.
 */

import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

let started = false;

async function persistToken(token: string, platform: "ios" | "android") {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !token) return;
    await (supabase.from("push_tokens" as any) as any).upsert(
      { user_id: user.id, token, platform },
      { onConflict: "user_id,token" },
    );
    console.log(`🔔 [PUSH_BOOT] Registered ${platform} token`);
  } catch (err) {
    console.error("🔔 [PUSH_BOOT] Failed to persist token:", err);
  }
}

export function startPushBootstrap() {
  if (started || typeof window === "undefined") return;
  started = true;

  // ── iOS: raw WKWebView shell events ──
  window.addEventListener("push:token-received", (e: Event) => {
    const token = (e as CustomEvent).detail?.token as string | undefined;
    if (token) void persistToken(token, "ios");
  });
  window.addEventListener("push:permission-denied", (e: Event) => {
    console.warn("🔔 [PUSH_BOOT] iOS permission denied:", (e as CustomEvent).detail?.error);
  });

  // Swift may set this if the token arrived before JS attached its listener.
  const pending = window.__idiaPendingPushToken;
  if (pending) {
    void persistToken(pending, "ios");
    delete window.__idiaPendingPushToken;
  }

  // ── Android: Capacitor plugin ──
  (async () => {
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

      const { PushNotifications } = await import("@capacitor/push-notifications");

      await PushNotifications.addListener("registration", (t) => {
        void persistToken(t.value, "android");
      });
      await PushNotifications.addListener("registrationError", (err) => {
        console.error("🔔 [PUSH_BOOT] Android registration error:", err);
      });
      await PushNotifications.addListener("pushNotificationReceived", (n) => {
        notify.info(n.title || "Notification", { description: n.body || undefined });
      });
    } catch (err) {
      console.warn("🔔 [PUSH_BOOT] Android bootstrap unavailable:", err);
    }
  })();
}
