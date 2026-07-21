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
let prefsCache: {
  in_app_alerts: boolean;
  in_app_sounds: boolean;
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
} = {
  in_app_alerts: true,
  in_app_sounds: true,
  quiet_hours_enabled: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
};

function applyPrefs(row: any) {
  prefsCache = {
    in_app_alerts: row.in_app_alerts !== false,
    in_app_sounds: row.in_app_sounds !== false,
    quiet_hours_enabled: row.quiet_hours_enabled === true,
    quiet_hours_start: row.quiet_hours_start || "22:00",
    quiet_hours_end: row.quiet_hours_end || "08:00",
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((n) => parseInt(n, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
}

export function isInQuietHours(now: Date = new Date()): boolean {
  if (!prefsCache.quiet_hours_enabled) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(prefsCache.quiet_hours_start);
  const end = toMinutes(prefsCache.quiet_hours_end);
  if (start === end) return false;
  if (start < end) return cur >= start && cur < end;
  // Wrap-around window (e.g. 22:00 → 08:00)
  return cur >= start || cur < end;
}

async function hydratePrefs() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase.from("user_preferences") as any)
      .select("in_app_alerts,in_app_sounds,quiet_hours_enabled,quiet_hours_start,quiet_hours_end")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) applyPrefs(data);
    supabase
      .channel(`notify-prefs-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_preferences", filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new) applyPrefs(payload.new);
        },
      )
      .subscribe();
  } catch {
    // best-effort
  }
}
hydratePrefs();

function fire(level: NotificationLevel, title: string, opts?: NotifyOptions) {
  const quiet = isInQuietHours();

  if (prefsCache.in_app_alerts) {
    notificationStore.add(level, title, opts?.description);
  }

  // Focus Mode: suppress transient toast + chime, but keep history above.
  if (quiet) return;

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
