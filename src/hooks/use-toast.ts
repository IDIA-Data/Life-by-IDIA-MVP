/**
 * Legacy useToast / toast shim.
 *
 * Forwards all calls to the centralized notification system (notify),
 * which records them in the bell dropdown history AND emits a minimalist
 * sonner pill. Preserves the original `toast({ title, description, variant })`
 * call signature so existing call sites keep working without changes.
 */
import * as React from "react";
import { notify } from "@/lib/notify";

type Variant = "default" | "destructive" | "success" | "warning" | undefined;

export interface LegacyToastInput {
  title?: React.ReactNode;
  description?: React.ReactNode;
  variant?: Variant;
  // any other props are accepted but ignored
  [key: string]: unknown;
}

function asText(node: React.ReactNode): string {
  if (node == null) return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  // Fallback for ReactElements: best-effort to string
  try {
    return String(node);
  } catch {
    return "";
  }
}

function dispatch(input: LegacyToastInput | string) {
  const normalized: LegacyToastInput =
    typeof input === "string" ? { title: input } : input || {};
  const title = asText(normalized.title) || asText(normalized.description) || "Notification";
  const description =
    normalized.title && normalized.description ? asText(normalized.description) : undefined;

  const level =
    normalized.variant === "destructive"
      ? "error"
      : normalized.variant === "success"
      ? "success"
      : normalized.variant === "warning"
      ? "warning"
      : "info";

  notify[level](title, description ? { description } : undefined);

  return {
    id: `${Date.now()}`,
    dismiss: () => undefined,
    update: () => undefined,
  };
}

function toast(input: LegacyToastInput | string) {
  return dispatch(input);
}

function useToast() {
  return {
    toast,
    dismiss: (_toastId?: string) => undefined,
    toasts: [] as Array<{ id: string }>,
  };
}

export { useToast, toast };
