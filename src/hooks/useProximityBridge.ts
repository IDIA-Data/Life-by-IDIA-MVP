import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useProximityBridge — IDIA Proximity Awareness Bridge
 *
 * Bridges the React UI to the native iOS WebKit message handler responsible
 * for passive proximity discovery (BLE / Ultra-Wideband). The native layer
 * emits anonymous, rotating peer tokens — never PII — and a relative signal
 * strength estimate. The web fallback surfaces a simulated empty list so the
 * UI can render its empty state without breaking on desktop browsers.
 *
 * Tokens are short-lived and rotate per the Sovereign Identity Protocol, so
 * the same physical device may appear under different tokens across days.
 */

export interface ProximityPeer {
  /** Opaque, rotating token. Never a stable identity. */
  token: string;
  /** Relative signal strength: 0 (far) → 1 (touching distance). */
  proximity: number;
  /** Wall-clock timestamp of the last sighting (ms). */
  lastSeenAt: number;
}

interface ProximityWindow extends Window {
  webkit?: {
    messageHandlers?: {
      proximityScan?: { postMessage: (msg: unknown) => void };
    };
  };
  onProximityUpdate?: (peers: ProximityPeer[]) => void;
  onProximityError?: (error: string) => void;
}

const detectBridge = (): boolean => {
  if (typeof window === "undefined") return false;
  const w = window as ProximityWindow;
  return Boolean(w.webkit?.messageHandlers?.proximityScan?.postMessage);
};

// Peers older than this are considered stale and removed from the list.
const STALE_AFTER_MS = 12_000;

export function useProximityBridge() {
  const [isBridgeAvailable, setIsBridgeAvailable] = useState<boolean>(() => detectBridge());
  const [isWatching, setIsWatching] = useState(false);
  const [peers, setPeers] = useState<ProximityPeer[]>([]);
  const watchingRef = useRef(false);

  // ---- Listener installation (paired logging) -----------------------------
  useEffect(() => {
    console.log("[PROXIMITY_BRIDGE_INIT_START]");
    setIsBridgeAvailable(detectBridge());

    const w = window as ProximityWindow;

    const updateHandler = (incoming: ProximityPeer[]) => {
      console.log("[PROXIMITY_UPDATE_START]", { count: incoming?.length ?? 0 });
      const now = Date.now();
      const fresh = (incoming || []).filter(
        (p) => p && typeof p.token === "string" && now - (p.lastSeenAt || now) < STALE_AFTER_MS,
      );
      setPeers(fresh);
      console.log("[PROXIMITY_UPDATE_END]", { kept: fresh.length });
    };

    const errorHandler = (error: string) => {
      console.log("[PROXIMITY_BRIDGE_ERROR]", { error });
      watchingRef.current = false;
      setIsWatching(false);
    };

    w.onProximityUpdate = updateHandler;
    w.onProximityError = errorHandler;

    console.log("[PROXIMITY_BRIDGE_INIT_END]");

    return () => {
      const cleanup = window as ProximityWindow;
      if (cleanup.onProximityUpdate === updateHandler) cleanup.onProximityUpdate = undefined;
      if (cleanup.onProximityError === errorHandler) cleanup.onProximityError = undefined;
    };
  }, []);

  // Periodically prune stale peers even if the native side stops emitting.
  useEffect(() => {
    const id = window.setInterval(() => {
      const now = Date.now();
      setPeers((prev) => prev.filter((p) => now - p.lastSeenAt < STALE_AFTER_MS));
    }, 3000);
    return () => window.clearInterval(id);
  }, []);

  const startWatching = useCallback(() => {
    console.log("[PROXIMITY_WATCH_START]");
    if (watchingRef.current) {
      console.log("[PROXIMITY_WATCH_END]", { reason: "already_watching" });
      return;
    }
    const w = window as ProximityWindow;
    const handler = w.webkit?.messageHandlers?.proximityScan;
    if (!handler?.postMessage) {
      console.log("[PROXIMITY_WATCH_END]", { reason: "bridge_missing" });
      return;
    }
    try {
      watchingRef.current = true;
      setIsWatching(true);
      handler.postMessage({ action: "start" });
      console.log("[PROXIMITY_WATCH_END]", { dispatched: true });
    } catch (err) {
      watchingRef.current = false;
      setIsWatching(false);
      console.log("[PROXIMITY_WATCH_END]", { error: String(err) });
    }
  }, []);

  const stopWatching = useCallback(() => {
    console.log("[PROXIMITY_STOP_START]");
    const w = window as ProximityWindow;
    const handler = w.webkit?.messageHandlers?.proximityScan;
    if (handler?.postMessage) {
      try {
        handler.postMessage({ action: "stop" });
      } catch (err) {
        console.log("[PROXIMITY_STOP_END]", { error: String(err) });
        return;
      }
    }
    watchingRef.current = false;
    setIsWatching(false);
    console.log("[PROXIMITY_STOP_END]", { stopped: true });
  }, []);

  return { isBridgeAvailable, isWatching, peers, startWatching, stopWatching };
}
