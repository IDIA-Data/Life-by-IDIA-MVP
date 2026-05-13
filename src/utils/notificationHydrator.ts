/**
 * Edge-Hydrated Notification Utility
 *
 * Pulls PII from the device's secure storage and merges it
 * with anonymous backend notification payloads to create
 * personalized messages — without ever exposing PII server-side.
 */

import { SecureStoragePlugin } from "capacitor-secure-storage-plugin";

export interface NotificationPayload {
  amount?: string;
  buyer?: string;
  type?: string;
  [key: string]: unknown;
}

interface LocalPII {
  name: string;
  email: string;
  phone: string;
}

async function getLocalPII(): Promise<LocalPII | null> {
  try {
    const result = await SecureStoragePlugin.get({ key: "user_pii_profile" });
    return JSON.parse(result.value) as LocalPII;
  } catch {
    return null;
  }
}

export async function hydrateNotification(payload: NotificationPayload): Promise<string> {
  const pii = await getLocalPII();
  const firstName = pii?.name?.split(" ")[0] ?? "there";

  if (payload.type === "data_reward" && payload.amount) {
    return `Hey ${firstName}, you earned ${payload.amount} USDC from ${payload.buyer ?? "a data buyer"}!`;
  }

  if (payload.type === "kyc_approved") {
    return `${firstName}, your identity verification is complete. Your wallet is now active.`;
  }

  return `Hey ${firstName}, you have a new notification.`;
}
