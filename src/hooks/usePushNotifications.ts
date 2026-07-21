import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

export type PushEnableResult = {
  ok: boolean;
  platform: "ios" | "android" | "web" | "unknown";
  reason?: string;
};

// Push registration bridged to the native entitlements:
//   • iOS  — raw WKWebView shell, `window.webkit.messageHandlers.nativePush`
//            + `push:token-received` / `push:permission-denied` window events
//   • Android — Capacitor `@capacitor/push-notifications` (FCM)
//   • Web    — standard Notification API fallback
//
// The App-level `startPushBootstrap()` also persists tokens on cold boot; this
// hook is the user-initiated path (Settings toggle).
export function usePushNotifications() {
  const enable = useCallback(async (): Promise<PushEnableResult> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, platform: "unknown", reason: "Not signed in" };

    // 1. iOS raw-WKWebView shell
    const nativeHandler = window.webkit?.messageHandlers?.nativePush;
    if (nativeHandler) {
      return new Promise<PushEnableResult>((resolve) => {
        let settled = false;

        const cleanup = () => {
          window.removeEventListener("push:token-received", handleSuccess as EventListener);
          window.removeEventListener("push:permission-denied", handleError as EventListener);
        };

        const handleSuccess = async (e: Event) => {
          if (settled) return;
          settled = true;
          cleanup();
          const token = (e as CustomEvent).detail?.token as string | undefined;
          if (!token) {
            resolve({ ok: false, platform: "ios", reason: "No device token returned" });
            return;
          }
          try {
            await (supabase.from("push_tokens" as any) as any).upsert(
              { user_id: user.id, token, platform: "ios" },
              { onConflict: "user_id,token" },
            );
            resolve({ ok: true, platform: "ios" });
          } catch (err: any) {
            resolve({ ok: false, platform: "ios", reason: err?.message || "Persist failed" });
          }
        };

        const handleError = (e: Event) => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({
            ok: false,
            platform: "ios",
            reason: (e as CustomEvent).detail?.error || "Permission denied",
          });
        };

        window.addEventListener("push:token-received", handleSuccess as EventListener);
        window.addEventListener("push:permission-denied", handleError as EventListener);

        // Handoff token if Swift already delivered it
        const pending = window.__idiaPendingPushToken;
        if (pending) {
          delete window.__idiaPendingPushToken;
          const ev = new CustomEvent("push:token-received", { detail: { token: pending } });
          handleSuccess(ev);
          return;
        }

        try {
          nativeHandler.postMessage({});
        } catch (err: any) {
          if (!settled) {
            settled = true;
            cleanup();
            resolve({ ok: false, platform: "ios", reason: err?.message || "Bridge invocation failed" });
          }
          return;
        }

        setTimeout(() => {
          if (settled) return;
          settled = true;
          cleanup();
          resolve({ ok: false, platform: "ios", reason: "Timed out waiting for iOS response" });
        }, 15000);
      });
    }

    // 2. Android Capacitor shell
    try {
      const { Capacitor } = await import("@capacitor/core");
      if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = await PushNotifications.requestPermissions();
        if (perm.receive !== "granted") {
          return { ok: false, platform: "android", reason: "Permission denied" };
        }

        return new Promise<PushEnableResult>((resolve) => {
          let settled = false;
          const finish = (r: PushEnableResult) => {
            if (settled) return;
            settled = true;
            resolve(r);
          };

          PushNotifications.addListener("registration", async (t) => {
            try {
              await (supabase.from("push_tokens" as any) as any).upsert(
                { user_id: user.id, token: t.value, platform: "android" },
                { onConflict: "user_id,token" },
              );
              finish({ ok: true, platform: "android" });
            } catch (err: any) {
              finish({ ok: false, platform: "android", reason: err?.message || "Persist failed" });
            }
          });
          PushNotifications.addListener("registrationError", (err) => {
            finish({ ok: false, platform: "android", reason: err?.error || "FCM registration failed" });
          });

          PushNotifications.register().catch((err) => {
            finish({ ok: false, platform: "android", reason: err?.message || "register() failed" });
          });

          setTimeout(() => finish({ ok: false, platform: "android", reason: "Timed out waiting for FCM token" }), 15000);
        });
      }
    } catch (err) {
      // Capacitor unavailable — fall through to web
      console.warn("[push] Capacitor unavailable, falling back to web:", err);
    }

    // 3. Web fallback
    try {
      if (typeof Notification !== "undefined") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          return { ok: false, platform: "web", reason: "Browser permission denied" };
        }
        const token = `web-${user.id}-${Date.now()}`;
        await (supabase.from("push_tokens" as any) as any).upsert(
          { user_id: user.id, token, platform: "web" },
          { onConflict: "user_id,token" },
        );
        return { ok: true, platform: "web" };
      }
    } catch (err: any) {
      return { ok: false, platform: "web", reason: err?.message || "Notification API failed" };
    }

    return { ok: false, platform: "unknown", reason: "No push transport available on this device" };
  }, []);

  const disable = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("push_tokens" as any) as any).delete().eq("user_id", user.id);
    // Fire and forget: notify user via unified notify to keep behavior consistent
    notify.info("Push notifications disabled");
  }, []);

  return { enable, disable };
}
