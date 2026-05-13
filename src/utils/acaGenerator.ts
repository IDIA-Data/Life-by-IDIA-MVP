/**
 * IDIA Liability Shield: Mandatory ACA Hash Generator
 */
export const generateACAHash = async (
  userId: string,
  sourceId: string,
  scopes: string[] = ["KYC_VAULT", "HEALTH_DATA_READ"],
): Promise<{ hash: string; payload: any }> => {
  // 1. Create the base payload without the hash
  const basePayload = {
    platform_guid: userId,
    source_id: sourceId,
    timestamp: new Date().toISOString(),
    consent_scope: scopes,
    entropy: crypto.randomUUID(),
  };

  // 2. Cryptographically hash the base payload
  const msgUint8 = new TextEncoder().encode(JSON.stringify(basePayload));
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  // 3. Nestle the generated hash into the final payload
  const finalPayload = {
    ...basePayload,
    aca_hash_key: hashHex,
  };

  return { hash: hashHex, payload: finalPayload };
};
