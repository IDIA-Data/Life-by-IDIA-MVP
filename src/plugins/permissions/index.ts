// IDIA Hardware Permissions — unified request bridge.
// Web implementation uses standard Web APIs where possible (camera/mic/bluetooth).
// On native, the Swift/Kotlin bridges intercept WKWebView/WebView capture prompts
// and route them to the OS permission dialogs declared in Info.plist / AndroidManifest.
//
// For Health and NFC we delegate to the existing IDIAHealth / IDIANFC plugins.

import { Capacitor } from "@capacitor/core";

export type HardwareKey = "motion" | "camera" | "health" | "bluetooth" | "microphone" | "nfc";
export type PermissionState = "granted" | "denied" | "prompt" | "unsupported";

export interface PermissionResult {
  key: HardwareKey;
  state: PermissionState;
  message?: string;
}

const platform = () => Capacitor.getPlatform();

async function probeMedia(kind: "audio" | "video"): Promise<PermissionResult> {
  const key: HardwareKey = kind === "audio" ? "microphone" : "camera";
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return { key, state: "unsupported", message: "MediaDevices API not available" };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true } as MediaStreamConstraints);
    stream.getTracks().forEach((t) => t.stop());
    return { key, state: "granted" };
  } catch (err: any) {
    const denied = err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError";
    return { key, state: denied ? "denied" : "prompt", message: err?.message };
  }
}

async function probeMotion(): Promise<PermissionResult> {
  const anyDME: any = (typeof window !== "undefined" ? (window as any).DeviceMotionEvent : null);
  if (!anyDME) return { key: "motion", state: "unsupported" };
  // iOS 13+ Safari/WKWebView requires explicit user-gesture permission request
  if (typeof anyDME.requestPermission === "function") {
    try {
      const res = await anyDME.requestPermission();
      return { key: "motion", state: res === "granted" ? "granted" : "denied" };
    } catch (err: any) {
      return { key: "motion", state: "denied", message: err?.message };
    }
  }
  // Android & desktop browsers expose motion without an explicit prompt
  return { key: "motion", state: "granted" };
}

async function probeBluetooth(): Promise<PermissionResult> {
  const nav: any = typeof navigator !== "undefined" ? navigator : null;
  if (!nav?.bluetooth?.requestDevice) {
    // iOS WKWebView lacks Web Bluetooth — native bridge required for real prompt.
    // Treat as "prompt" so UI can suggest opening Settings on native.
    return { key: "bluetooth", state: Capacitor.isNativePlatform() ? "prompt" : "unsupported" };
  }
  try {
    const device = await nav.bluetooth.requestDevice({ acceptAllDevices: true });
    return { key: "bluetooth", state: device ? "granted" : "denied" };
  } catch (err: any) {
    const denied = err?.name === "NotAllowedError";
    return { key: "bluetooth", state: denied ? "denied" : "prompt", message: err?.message };
  }
}

async function probeHealth(): Promise<PermissionResult> {
  try {
    const { healthService } = await import("@/services/healthService");
    const granted = await healthService.requestPermissions();
    return { key: "health", state: granted ? "granted" : "denied" };
  } catch (err: any) {
    return { key: "health", state: "unsupported", message: err?.message };
  }
}

async function probeNfc(): Promise<PermissionResult> {
  // NFC on iOS is request-on-use (per CoreNFC). No upfront prompt is possible.
  // On Android NDEF Reader has navigator.nfc — not available in WKWebView.
  if (Capacitor.isNativePlatform()) {
    return { key: "nfc", state: "granted", message: "NFC will prompt when a scan starts." };
  }
  return { key: "nfc", state: "unsupported" };
}

export async function requestHardwarePermission(key: HardwareKey): Promise<PermissionResult> {
  console.log(`[HW_PERMISSION:REQUEST] ${key} on ${platform()}`);
  switch (key) {
    case "microphone": return probeMedia("audio");
    case "camera":     return probeMedia("video");
    case "motion":     return probeMotion();
    case "bluetooth":  return probeBluetooth();
    case "health":     return probeHealth();
    case "nfc":        return probeNfc();
  }
}

export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    // @capacitor/app has openUrl; deep-link to the app's settings page.
    const { App } = await import("@capacitor/app");
    // iOS app-settings: scheme opens this app's own Settings pane.
    await (App as any).openUrl?.({ url: platform() === "ios" ? "app-settings:" : "package:com.idia.life" });
  } catch (err) {
    console.warn("[HW_PERMISSION:openAppSettings] failed", err);
  }
}
