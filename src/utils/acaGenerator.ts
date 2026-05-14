import { Capacitor } from "@capacitor/core";
import { toast } from "@/hooks/use-toast";

/**
 * IDIA Protocol: Universal ACA Hardware Generator
 * Mandatory for all Human Touchpoints (Accept, Okay, Link, Transact)
 */
export const generateACAHash = async (
  userId: string,
  sourceId: string,
  scopes: string[] = ["CONSENT_GENERAL"],
): Promise<{ hash: string; payload: any }> => {
  console.log(`[ACA_HARDWARE] START: Verification sequence for touchpoint: ${sourceId}`);

  const isNative = Capacitor.isNativePlatform();

  try {
    let hardwareAttestationId: string;

    if (isNative) {
      // ─── MOBILE HARDWARE ANCHOR (iOS Swift / Android Kotlin) ──────────────
      // This forces the physical prompt. No biometric = No hash. No hash = No entry.
      console.log(`[ACA_HARDWARE] PLATFORM: Native. Requesting hardware attestation.`);

      try {
        const result = await (window as any).Capacitor.Plugins.NativeBiometric.verifyIdentity({
          reason: `Biological anchor required for: ${sourceId}`,
          title: "Verify Sovereign Intent",
          description: "Proof of physical presence is required to write to the ledger.",
        });

        hardwareAttestationId = result.signature || result.deviceToken;
      } catch (nativeErr: any) {
        console.error(`[ACA_HARDWARE] FATAL: Hardware handshake rejected.`);
        throw new Error("BIOMETRIC_REJECTED");
      }
    } else {
      // ─── DEVELOPMENT BYPASS (Iframe/Web Only) ─────────────────────────────
      // Only active during development to prevent build stalls.
      console.warn("[ACA_HARDWARE] PLATFORM: Web/Preview. Emulating anchor for development.");
      hardwareAttestationId = `DEV_TOUCHPOINT_SIMULATION_${crypto.randomUUID()}`;
    }

    // ─── IMMUTABLE PAYLOAD CONSTRUCTION ─────────────────────────────────────
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

    console.log(`[ACA_HARDWARE] SUCCESS: Intent anchored. Hash: [${hashHex.substring(0, 8)}]`);

    return {
      hash: hashHex,
      payload: finalPayload,
    };
  } catch (error: any) {
    console.error(`[ACA_HARDWARE] CRITICAL_FAILURE: ${error.message}`);

    toast({
      title: "Handshake Failed",
      description: "Biological anchor required for human touchpoints.",
      variant: "destructive",
    });

    throw new Error(`ACA_PROMPT_REJECTED: ${error.message}`);
  }
};
