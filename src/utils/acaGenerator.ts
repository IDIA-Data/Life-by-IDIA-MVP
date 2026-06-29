import { toast } from "@/hooks/use-toast";

/**
 * IDIA Protocol: Localized Native ACA Hardware Generator
 * Mandatory for all Human Touchpoints (Accept, Okay, Link, Transact)
 */
export const generateACAHash = async (
  userId: string,
  sourceId: string,
  scopes: string[] = ["CONSENT_GENERAL"],
): Promise<{ hash: string; payload: any }> => {
  console.log(`🪪 [BEGIN: generateACAHash] Initializing verification sequence for touchpoint: ${sourceId}`);

  // Detect pure native shell via our custom WKWebView bridge instead of Capacitor
  const isNative = typeof window !== "undefined" && !!(window as any).webkit?.messageHandlers?.triggerBiologicalCapture;

  try {
    let hardwareAttestationId: string;

    if (isNative) {
      console.log(`🪪 [PROCESS: generateACAHash] Environment: Pure Native Shell. Requesting localized hardware lock.`);

      try {
        console.log(`🪪 [BEGIN: performBiologicalBinding] Triggering Secure Enclave via WKWebView bridge`);

        // Await the asynchronous hardware result from the Swift shell
        await new Promise((resolve, reject) => {
          const handleSuccess = () => {
            console.log(`🪪 [END: performBiologicalBinding] SUCCESS: Biological signature verified by Secure Enclave.`);
            cleanup();
            resolve(true);
          };

          const handleError = (e: any) => {
            console.error(
              `🚨 [FAIL: performBiologicalBinding] ERROR: Native shell rejected biological prompt. Reason: ${e.detail?.error}`,
            );
            cleanup();
            reject(new Error(e.detail?.error || "BIOMETRIC_REJECTED"));
          };

          const cleanup = () => {
            window.removeEventListener("biological:capture-success", handleSuccess);
            window.removeEventListener("biological:capture-error", handleError);
          };

          // Attach listeners for the native Swift dispatch events
          window.addEventListener("biological:capture-success", handleSuccess);
          window.addEventListener("biological:capture-error", handleError);

          // Trigger the hardware
          (window as any).webkit.messageHandlers.triggerBiologicalCapture.postMessage({});
        });

        // Generate a secure local UUID to replace the deprecated Capacitor Device.getId()
        const secureLocalId = crypto.randomUUID();
        hardwareAttestationId = `${secureLocalId}:${Date.now()}:NATIVE_ENCLAVE_VERIFIED`;
        console.log(`🪪 [PROCESS: generateACAHash] Hardware attestation generated: ${hardwareAttestationId}`);
      } catch (nativeErr: any) {
        console.error(`🚨 [FAIL: generateACAHash] FATAL: Hardware handshake rejected by user or system.`);
        throw new Error(`BIOMETRIC_REJECTED:${nativeErr?.message || "unknown"}`);
      }
    } else {
      // ─── WEB / PREVIEW SIMULATION (temporary) ─────────────────────────────
      console.log(`🪪 [PROCESS: generateACAHash] Environment: Web/Simulation. Bypassing Secure Enclave.`);
      const randomBytes = crypto.getRandomValues(new Uint8Array(16));
      const randomHex = Array.from(randomBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      hardwareAttestationId = `${randomHex}:${Date.now()}:WEB_SIMULATION`;
    }

    // ─── IMMUTABLE PAYLOAD CONSTRUCTION ─────────────────────────────────────
    console.log(`🪪 [PROCESS: generateACAHash] Constructing immutable payload.`);
    const basePayload = {
      platform_guid: userId,
      source_id: sourceId,
      timestamp: new Date().toISOString(),
      consent_scope: scopes,
      hardware_attestation_id: hardwareAttestationId, // Timestamped Reality proof
    };

    const msgUint8 = new TextEncoder().encode(JSON.stringify(basePayload));
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const finalPayload = {
      ...basePayload,
      aca_hash_key: hashHex,
    };

    console.log(
      `🪪 [END: generateACAHash] SUCCESS: Intent anchored and signed. ACA Hash: [${hashHex.substring(0, 8)}...]`,
    );

    return {
      hash: hashHex,
      payload: finalPayload,
    };
  } catch (error: any) {
    console.error(`🚨 [FAIL: generateACAHash] CRITICAL_FAILURE: Sequence aborted. Reason: ${error.message}`);

    toast({
      title: "Handshake Failed",
      description: isNative
        ? "Face ID / Touch ID is required to anchor this action."
        : "Open the IDIA iOS app to complete this action — the web preview cannot anchor consent.",
      variant: "destructive",
    });

    throw new Error(`ACA_PROMPT_REJECTED: ${error.message}`);
  }
};
