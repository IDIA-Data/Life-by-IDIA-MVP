import { useCallback, useEffect, useState } from "react";
import { useProfile } from "@/hooks/useProfile";
import { useToast } from "@/hooks/use-toast";
import {
  HardwareKey,
  PermissionResult,
  PermissionState,
  requestHardwarePermission,
  openAppSettings,
} from "@/plugins/permissions";

const PREF_KEY: Record<HardwareKey, string> = {
  motion: "privacy_motion",
  camera: "privacy_camera",
  health: "privacy_health",
  bluetooth: "privacy_bluetooth",
  microphone: "privacy_microphone",
  nfc: "privacy_nfc",
};

const LS_GRANT_KEY = (k: HardwareKey) => `idia_hw_grant_${k}`;

export function useHardwarePermission() {
  const { preferences, updatePreferences } = useProfile();
  const { toast } = useToast();
  const [grantState, setGrantState] = useState<Record<HardwareKey, PermissionState>>({
    motion: "prompt", camera: "prompt", health: "prompt",
    bluetooth: "prompt", microphone: "prompt", nfc: "prompt",
  });

  // Hydrate cached OS grant state on mount
  useEffect(() => {
    try {
      const hasMedia = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
      const next: any = {};
      (Object.keys(PREF_KEY) as HardwareKey[]).forEach((k) => {
        const cached = localStorage.getItem(LS_GRANT_KEY(k));
        if (!cached) return;
        // Discard stale 'unsupported' for camera/mic — native bridge or a
        // now-available web API means we should re-prompt instead of blocking.
        if (cached === "unsupported" && (k === "camera" || k === "microphone") && hasMedia) {
          try { localStorage.removeItem(LS_GRANT_KEY(k)); } catch { /* no-op */ }
          return;
        }
        next[k] = cached as PermissionState;
      });
      if (Object.keys(next).length) setGrantState((s) => ({ ...s, ...next }));
    } catch { /* sandboxed */ }
  }, []);

  const persistGrant = (k: HardwareKey, state: PermissionState) => {
    setGrantState((s) => ({ ...s, [k]: state }));
    try { localStorage.setItem(LS_GRANT_KEY(k), state); } catch { /* no-op */ }
  };

  const setToggle = useCallback(
    async (key: HardwareKey, enabled: boolean): Promise<PermissionResult | null> => {
      const prefKey = PREF_KEY[key];
      console.log(`[HW_PERMISSION:TOGGLE] key=${key} enabled=${enabled}`);

      if (!enabled) {
        // User-disabled in app — no OS revocation possible.
        await updatePreferences({ [prefKey]: false });
        return null;
      }

      // Enabling → request OS permission first
      const result = await requestHardwarePermission(key);
      persistGrant(key, result.state);

      if (result.state === "granted") {
        await updatePreferences({ [prefKey]: true });
        toast({ title: "Permission granted", description: `${labelFor(key)} is now active.` });
      } else if (result.state === "denied") {
        // Keep the preference off and surface a recovery path
        await updatePreferences({ [prefKey]: false });
        toast({
          title: `${labelFor(key)} denied`,
          description: "Enable it in your device Settings, then toggle here again.",
          variant: "destructive",
        });
      } else if (result.state === "unsupported") {
        await updatePreferences({ [prefKey]: false });
        toast({
          title: `${labelFor(key)} unavailable`,
          description: "This hardware isn't accessible on the current platform.",
        });
      } else {
        // 'prompt' — user dismissed without deciding
        await updatePreferences({ [prefKey]: false });
      }
      return result;
    },
    [updatePreferences, toast],
  );

  const isEnabled = useCallback(
    (key: HardwareKey): boolean => {
      const pref = (preferences as any)?.[PREF_KEY[key]];
      // Default-on for backwards compat with existing UI, except when OS denied
      const grant = grantState[key];
      if (grant === "denied" || grant === "unsupported") return false;
      return pref !== false;
    },
    [preferences, grantState],
  );

  return {
    isEnabled,
    grantState,
    setToggle,
    openAppSettings,
  };
}

function labelFor(k: HardwareKey): string {
  switch (k) {
    case "motion": return "Device Motion";
    case "camera": return "Camera";
    case "health": return "Health Kit";
    case "bluetooth": return "Bluetooth";
    case "microphone": return "Microphone";
    case "nfc": return "NFC";
  }
}
