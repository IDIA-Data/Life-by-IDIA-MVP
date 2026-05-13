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

interface NotifyOptions {
  description?: string;
}

function fire(level: NotificationLevel, title: string, opts?: NotifyOptions) {
  notificationStore.add(level, title, opts?.description);

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
