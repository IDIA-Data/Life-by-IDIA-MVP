/**
 * Unified notification API.
 *
 * Every call:
 *   1. Appends to the persistent notification store (history → bell dropdown).
 *   2. Fires a minimalist sonner pill for transient feedback.
 *
 * Existing call sites using `toast(...)` from sonner or `useToast()` from
 * `@/hooks/use-toast` are routed here via thin shims so behavior is uniform
 * across the entire app without a mass codemod.
 */

import { toast as sonnerToast } from "sonner";
import { notificationStore, type NotificationLevel } from "@/stores/notificationStore";
import { playChime } from "@/lib/chime";
import { supabase } from "@/integrations/supabase/client";

interface NotifyOptions {
  description?: string;
}

// In-memory cache of the current user's notification preferences. Refreshed
// whenever the user's preference row changes via realtime.
let prefsCache: { in_app_alerts: boolean; in_app_sounds: boolean } = {
  in_app_alerts: true,
  in_app_sounds: true,
};

async function hydratePrefs() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase.from("user_preferences") as any)
      .select("in_app_alerts,in_app_sounds")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      prefsCache = {
        in_app_alerts: data.in_app_alerts !== false,
        in_app_sounds: data.in_app_sounds !== false,
      };
    }
    supabase
      .channel(`notify-prefs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new) {
            prefsCache = {
              in_app_alerts: payload.new.in_app_alerts !== false,
              in_app_sounds: payload.new.in_app_sounds !== false,
            };
          }
        },
      )
      .subscribe();
  } catch {
    // best-effort
  }
}
hydratePrefs();

function fire(level: NotificationLevel, title: string, opts?: NotifyOptions) {
  if (prefsCache.in_app_alerts) {
    notificationStore.add(level, title, opts?.description);
  }
  if (prefsCache.in_app_sounds) {
    playChime(level === "error" ? 440 : level === "warning" ? 660 : 880);
  }

  const payload = opts?.description ? { description: opts.description } : undefined;
  switch (level) {
    case "success":
      sonnerToast.success(title, payload);
      break;
    case "error":
      sonnerToast.error(title, payload);
      break;
    case "warning":
      sonnerToast.warning(title, payload);
      break;
    default:
      sonnerToast(title, payload);
  }
}

export const notify = {
  info: (title: string, opts?: NotifyOptions) => fire("info", title, opts),
  success: (title: string, opts?: NotifyOptions) => fire("success", title, opts),
  warning: (title: string, opts?: NotifyOptions) => fire("warning", title, opts),
  error: (title: string, opts?: NotifyOptions) => fire("error", title, opts),
};
