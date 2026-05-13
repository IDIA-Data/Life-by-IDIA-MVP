/**
 * Payment ACA (Auditable Consent Artifact) Generator
 *
 * Generates a cryptographic consent hash for USDC payment transactions.
 * The ACA is computed ON-DEVICE before the payment is submitted,
 * following Eddie's architecture: "The ACA Key exists on the phone."
 *
 * The ACA hash encodes:
 *   - Sender wallet address
 *   - Recipient wallet address
 *   - Amount (USDC, raw units)
 *   - Timestamp (unix seconds)
 *   - Device entropy (random nonce for uniqueness)
 *   - Intent type ("usdc_payment")
 *
 * This hash is:
 *   1. Stored in aca_consent_artifacts table BEFORE the payment
 *   2. Included in the relay request alongside the EIP-3009 signature
 *   3. Recorded in usdc_payments alongside the tx hash
 *   4. Optionally included in an IDIALiabilityReceipt mint
 *
 * The ACA serves as immutable proof that the user explicitly consented
 * to this specific transaction at this specific time.
 */

import { ethers } from 'ethers';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentACA {
  hash: string;        // bytes32 hex string (the ACA hash itself)
  timestamp: number;   // Unix seconds when consent was given
  sender: string;      // Sender wallet address
  recipient: string;   // Recipient wallet address
  amount: string;      // USDC amount in raw units (6 decimals)
  nonce: string;       // Random entropy for uniqueness
  intent: string;      // Always "usdc_payment" for payment ACAs
}

/**
 * Generate a payment ACA hash on-device.
 *
 * The hash is a keccak256 of the packed consent data. This mirrors
 * Eddie's ACA formula: hardware + timestamp + intent + additional context.
 * In our case, "hardware" is represented by the random nonce (device entropy)
 * and the wallet address (device-bound key).
 */
export function generatePaymentACA(
  senderAddress: string,
  recipientAddress: string,
  amountRaw: string,
): PaymentACA {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = ethers.hexlify(ethers.randomBytes(16));
  const intent = 'usdc_payment';

  // Pack and hash: keccak256(sender, recipient, amount, timestamp, nonce, intent)
  const packed = ethers.solidityPacked(
    ['address', 'address', 'uint256', 'uint256', 'bytes16', 'string'],
    [senderAddress, recipientAddress, amountRaw, timestamp, nonce, intent],
  );
  const hash = ethers.keccak256(packed);

  return {
    hash,
    timestamp,
    sender: senderAddress,
    recipient: recipientAddress,
    amount: amountRaw,
    nonce,
    intent,
  };
}

/**
 * Store a payment ACA in the aca_consent_artifacts table.
 *
 * This MUST be called BEFORE the payment relay is submitted.
 * The ACA record proves consent existed before the money moved.
 *
 * The ACA is stored with status 'active' and expires after 10 minutes
 * (matching the EIP-3009 authorization validity window with buffer).
 *
 * Returns true if stored successfully, false if storage failed.
 * A storage failure should NOT block the payment — the ACA hash
 * is still included in the relay request for on-chain recording.
 */
export async function storePaymentACA(aca: PaymentACA): Promise<boolean> {
  try {
    const expiresAt = new Date((aca.timestamp + 600) * 1000).toISOString(); // 10 min expiry

    const { error } = await supabase
      .from('aca_consent_artifacts')
      .insert({
        hash: aca.hash,
        status: 'active',
        expires_at: expiresAt,
        metadata: {
          type: aca.intent,
          sender: aca.sender,
          recipient: aca.recipient,
          amount: aca.amount,
          nonce: aca.nonce,
          timestamp: aca.timestamp,
          generated_on: 'device',
        },
      });

    if (error) {
      // Don't throw — ACA storage failure shouldn't block payment
      console.error('[PaymentACA] Failed to store ACA:', error.message);
      return false;
    }

    console.log(`[PaymentACA] ACA stored: ${aca.hash.slice(0, 16)}...`);
    return true;
  } catch (e: any) {
    console.error('[PaymentACA] Storage error:', e.message);
    return false;
  }
}

/**
 * Mark an ACA as consumed after successful payment.
 * This prevents the same consent artifact from being reused.
 */
export async function markACAConsumed(acaHash: string, txHash: string): Promise<void> {
  try {
    await supabase
      .from('aca_consent_artifacts')
      .update({
        status: 'consumed',
        metadata: supabase.rpc ? undefined : { consumed_by_tx: txHash },
      })
      .eq('hash', acaHash);

    console.log(`[PaymentACA] ACA marked consumed: ${acaHash.slice(0, 16)}...`);
  } catch (e: any) {
    console.error('[PaymentACA] Failed to mark consumed:', e.message);
  }
}
