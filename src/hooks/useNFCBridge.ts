import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "@/components/ui/sonner";
import { useProfile } from "@/hooks/useProfile";

/**
 * useNFCBridge — IDIA Sovereign Handshake Bridge
 * Standardized to match the working NFCPayrollModal implementation.
 */

export type NFCBridgeMode = "STANDARD" | "PACE";

interface NFCWindow extends Window {
  webkit?: {
    messageHandlers?: {
      initiateNfcHandshake?: { postMessage: (msg: unknown) => void };
    };
  };
  onNfcHandshakeComplete?: (peerToken: string) => void;
  onNfcHandshakeError?: (error: string) => void;
}

const detectBridge = (): boolean => {
  if (typeof window === "undefined") return false;
  const w = window as NFCWindow;
  // Button availability check: true if named handler exists OR if on a mobile user-agent
  const hasNamedHandler = Boolean(w.webkit?.messageHandlers?.initiateNfcHandshake?.postMessage);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  return hasNamedHandler || isMobile;
};

export function useNFCBridge() {
  const [isBridgeAvailable, setIsBridgeAvailable] = useState<boolean>(() => detectBridge());
  const [isScanning, setIsScanning] = useState(false);
  const scanningRef = useRef(false);
  const { preferences } = useProfile();
  const nfcAllowed = (preferences as any)?.privacy_nfc !== false;

  // ---- Listener installation ---------------------------------------------
  useEffect(() => {
    console.log("[BRIDGE_INIT_START]");
    setIsBridgeAvailable(detectBridge());

    console.log("[BRIDGE_LISTENER_INIT_START]");
    const w = window as NFCWindow;

    const completeHandler = (peerPayload: string | Record<string, unknown>) => {
      console.log("[BRIDGE_NATIVE_CALLBACK_RECEIVED_START]");
      // Native may send a JSON object (initiateNfcHandshake) OR a raw token string (legacy NFCBridge).
      const peerToken =
        typeof peerPayload === "string"
          ? peerPayload
          : (peerPayload as any)?.scanned_intent ?? JSON.stringify(peerPayload);
      console.log("[BRIDGE_HANDSHAKE_RESOLVED]", { token: String(peerToken).substring(0, 8) + "..." });
      scanningRef.current = false;
      setIsScanning(false);

      window.dispatchEvent(
        new CustomEvent("nfc:scan-complete", { detail: { peerToken, raw: peerPayload } })
      );
      console.log("[BRIDGE_NATIVE_CALLBACK_RECEIVED_END]");
    };

    const errorHandler = (error: string) => {
      console.log("[BRIDGE_NATIVE_ERROR_RECEIVED_START]");
      console.log("[BRIDGE_HANDSHAKE_ERROR]", { error });
      scanningRef.current = false;
      setIsScanning(false);
      
      window.dispatchEvent(
        new CustomEvent("nfc:scan-error", { detail: { error } })
      );
      console.log("[BRIDGE_NATIVE_ERROR_RECEIVED_END]");
    };

    // Attach to the specific window globals expected by the IDIA Swift Coordinator
    w.onNfcHandshakeComplete = completeHandler;
    w.onNfcHandshakeError = errorHandler;

    console.log("[BRIDGE_LISTENER_INIT_END]");

    return () => {
      console.log("[BRIDGE_LISTENER_TEARDOWN_START]");
      const cleanup = window as NFCWindow;
      delete cleanup.onNfcHandshakeComplete;
      delete cleanup.onNfcHandshakeError;
      console.log("[BRIDGE_LISTENER_TEARDOWN_END]");
      console.log("[BRIDGE_INIT_END]");
    };
  }, []);

  // ---- Outbound: initiate handshake ---------------------------------------
  const initiateSovereignHandshake = useCallback(
    (mode: NFCBridgeMode = "STANDARD") => {
      console.log("[BRIDGE_HANDSHAKE_START]", { mode });

      if (!nfcAllowed) {
        console.warn("[BRIDGE_HANDSHAKE_BLOCKED] NFC disabled in Privacy Settings");
        toast("NFC is turned off", {
          description: "Enable NFC Scan under Settings → Privacy to use the Sovereign Handshake.",
        });
        return;
      }

      if (scanningRef.current) {
        console.warn("[BRIDGE_HANDSHAKE_ABORTED] Scanning already in progress");
        return;
      }

      const w = window as NFCWindow;
      const handler = w.webkit?.messageHandlers?.initiateNfcHandshake;
      
      // Standardize payload to match Payroll logic (using handshake_token)
      const payload = { 
        action: "start_scan", 
        mode, 
        handshake_token: mode === "STANDARD" ? "IDIA_LIFE_SYNC_001" : "IDIA_PACE_SYNC_001" 
      };

      try {
        scanningRef.current = true;
        setIsScanning(true);
        
        console.log("[BRIDGE_IPC_DISPATCH_START]");
        
        if (handler?.postMessage) {
          console.log("[BRIDGE_IPC_DISPATCH_PROCESS] Dispatching via WKScriptMessageHandler");
          handler.postMessage(payload);
        } else {
          // This fallback is why Payroll works; it catches cases where the named handler 
          // is proxied through a generic message event listener.
          console.log("[BRIDGE_IPC_DISPATCH_PROCESS] WKHandler missing, firing window.postMessage fallback");
          window.postMessage({ type: 'initiateNfcHandshake', ...payload }, '*');
        }
        
        console.log("[BRIDGE_IPC_DISPATCH_END]");
      } catch (err) {
        scanningRef.current = false;
        setIsScanning(false);
        console.error("[BRIDGE_HANDSHAKE_CRASH]", { error: String(err) });
        toast("Hardware Interface Error", {
          description: "The secure bridge failed to initialize. Please ensure you are in the native app.",
        });
      }
      
      console.log("[BRIDGE_HANDSHAKE_END]");
    },
    [nfcAllowed]
  );

  return { isBridgeAvailable, isScanning, initiateSovereignHandshake };
}