// Edge-function mirror of src/utils/acaLedger.ts.
// Strict INSERT to user_aca_records. No hash generation. No upsert.
// Caller must pass a hash+payload that was generated client-side by
// src/utils/acaGenerator.ts and forwarded in the request body.

import { SupabaseClient } from "npm:@supabase/supabase-js@2";

export interface ACARecordInput {
  userId: string;
  sourceId: string;
  consentType?: string | null;
  hash: string;
  payload: {
    consent_scope?: string[];
    timestamp?: string;
  } & Record<string, unknown>;
  txHash?: string | null;
}

export async function recordACA(
  admin: SupabaseClient,
  input: ACARecordInput,
): Promise<void> {
  const row = {
    platform_guid: input.userId,
    aca_hash_key: input.hash,
    source_id: input.sourceId,
    consent_type: input.consentType ?? null,
    consent_scope: Array.isArray(input.payload?.consent_scope) && input.payload.consent_scope.length > 0
      ? input.payload.consent_scope
      : ["GENERAL_CONSENT"],
    created_at: input.payload?.timestamp ?? new Date().toISOString(),
    tx_hash: input.txHash ?? null,
  };

  console.log(
    `[ACA_LEDGER:EDGE] INSERT source=${input.sourceId} hash=${input.hash.substring(0, 8)}…`,
  );

  const { error } = await admin.from("user_aca_records").insert(row);
  if (error) {
    console.error(`[ACA_LEDGER:EDGE] INSERT_FAILED source=${input.sourceId}`, error);
    throw new Error(`ACA mirror failed: ${error.message}`);
  }
}
