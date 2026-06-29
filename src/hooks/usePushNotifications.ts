import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { notify } from "@/lib/notify";

// Lightweight web + Capacitor push registration. On web we fall back to the
// Notification permission API and store a synthetic token so the toggle reflects
// real OS state. On native (Capacitor) we attempt to load @capacitor/push-notifications
// dynamically so the web bundle stays slim.
export function usePushNotifications() {
  const enable = useCallback(async (): Promise<boolean> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    let token: string | null = null;
    let platform = "web";

    try {
      // Try Capacitor first (native). Use variable + vite-ignore so the web bundle
      // doesn't fail when the optional native dep is absent.
      const pkg = "@capacitor/push-notifications";
      const mod = await import(/* @vite-ignore */ pkg).catch(() => null);
      if (mod?.PushNotifications) {
        const perm = await mod.PushNotifications.requestPermissions();
        if (perm.receive !== "granted") {
          notify.warning("Push permission denied", { description: "Enable notifications in system settings." });
          return false;
        }
        await mod.PushNotifications.register();
        token = await new Promise<string | null>((resolve) => {
          const handle = mod.PushNotifications.addListener("registration", (t: any) => {
            resolve(t.value);
            handle.then((h: any) => h.remove?.());
          });
          setTimeout(() => resolve(null), 8000);
        });
        platform = "native";
      } else if (typeof Notification !== "undefined") {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") {
          notify.warning("Push permission denied");
          return false;
        }
        token = `web-${user.id}-${Date.now()}`;
      }
    } catch (err) {
      console.error("[push] registration failed", err);
    }

    if (!token) return false;

    await (supabase.from("push_tokens" as any) as any)
      .upsert({ user_id: user.id, token, platform }, { onConflict: "user_id,token" });
    return true;
  }, []);

  const disable = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("push_tokens" as any) as any).delete().eq("user_id", user.id);
  }, []);

  return { enable, disable };
}
