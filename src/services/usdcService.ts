/**
 * USDC Payment Service for IDIA Life
 *
 * Handles gasless USDC payments via EIP-3009 transferWithAuthorization.
 * Uses acaGenerator.ts for all Auditable Consent Artifacts.
 */

import { ethers } from 'ethers';
import {
  USDC_CONFIG,
  USDC_AUTH_VALIDITY_SECONDS,
  USDC_MIN_PAYMENT,
  USDC_MAX_PAYMENT,
  type PaymentRequest,
} from '@/config/usdc';
import { generateACAHash } from "../utils/acaGenerator";
import { recordACA } from "../utils/acaLedger";
import { supabase } from '@/integrations/supabase/client';

// ─── Minimal ERC-20 ABI ─────────────────────────────────────────────

const ERC20_BALANCE_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

// ─── Types ───────────────────────────────────────────────────────────

export interface USDCBalance {
  raw: string;
  formatted: string;
  decimals: number;
}

export interface SignedAuthorization {
  from: string;
  to: string;
  value: string;
  validAfter: number;
  validBefore: number;
  nonce: string;
  v: number;
  r: string;
  s: string;
}

export interface PaymentResult {
  success: boolean;
  txHash?: string;
  blockExplorerUrl?: string;
  acaHash?: string;
  error?: string;
  from: string;
  to: string;
  amountFormatted: string;
  network: string;
}

// ─── Database Helpers ────────────────────────────────────────────────
// ACA writes go through the canonical ledger helper (strict INSERT into
// user_aca_records). No upsert, no fallback to the deleted artifact tables.

async function storePaymentACA(aca: { hash: string; payload: any }): Promise<boolean> {
  try {
    await recordACA({
      userId: aca.payload.platform_guid,
      sourceId: aca.payload.source_id,
      consentType: "USDC_PAYMENT_V1",
      hash: aca.hash,
      payload: aca.payload,
    });
    return true;
  } catch (e) {
    console.error('[USDCService] CRITICAL: Failed to mirror ACA:', e);
    return false;
  }
}

async function markACAConsumed(hash: string, txHash: string) {
  // Append-only ledger: the row already exists from storePaymentACA. We only
  // stamp the settlement reference + consumed_at, never re-insert.
  try {
    const { error } = await (supabase as any)
      .from('user_aca_records')
      .update({ tx_hash: txHash, consumed_at: new Date().toISOString() })
      .eq('aca_hash_key', hash);
    if (error) throw error;
    console.log(`[USDCService] ACA ${hash.substring(0, 8)}… stamped with tx ${txHash.substring(0, 10)}…`);
  } catch (e: any) {
    console.warn(`[USDCService] markACAConsumed failed (non-fatal): ${e.message}`);
  }
}

// ─── Provider & Signing ──────────────────────────────────────────────

function getProvider(): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(USDC_CONFIG.rpcUrl);
}

function buildEIP712TypedData(from: string, to: string, value: bigint, validAfter: number, validBefore: number, nonce: string) {
  return {
    domain: {
      name: USDC_CONFIG.eip712.name,
      version: USDC_CONFIG.eip712.version,
      chainId: USDC_CONFIG.chainId,
      verifyingContract: USDC_CONFIG.usdcAddress,
    },
    types: {
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    message: { from, to, value: value.toString(), validAfter, validBefore, nonce },
  };
}

export async function getUSDCBalance(address: string): Promise<USDCBalance | null> {
  try {
    const provider = getProvider();
    const usdc = new ethers.Contract(USDC_CONFIG.usdcAddress, ERC20_BALANCE_ABI, provider);
    const raw: bigint = await usdc.balanceOf(address);
    return { raw: raw.toString(), formatted: ethers.formatUnits(raw, USDC_CONFIG.usdcDecimals), decimals: USDC_CONFIG.usdcDecimals };
  } catch (e) { console.error('[USDCService] Balance fetch failed:', e); return null; }
}

export async function signTransferAuthorization(
  wallet: ethers.HDNodeWallet,
  to: string,
  amountHuman: string,
): Promise<SignedAuthorization> {
  if (!ethers.isAddress(to)) throw new Error('Invalid recipient address');
  const amount = parseFloat(amountHuman);
  if (isNaN(amount) || amount < USDC_MIN_PAYMENT) throw new Error(`Amount must be at least $${USDC_MIN_PAYMENT}`);
  if (amount > USDC_MAX_PAYMENT) throw new Error(`Amount exceeds maximum of $${USDC_MAX_PAYMENT}`);

  const valueRaw = ethers.parseUnits(amountHuman, USDC_CONFIG.usdcDecimals);
  const nonce = ethers.hexlify(ethers.randomBytes(32));
  const now = Math.floor(Date.now() / 1000);
  const validAfter = 0;
  const validBefore = now + USDC_AUTH_VALIDITY_SECONDS;

  const { domain, types, message } = buildEIP712TypedData(wallet.address, to, valueRaw, validAfter, validBefore, nonce);
  const signature = await wallet.signTypedData(domain, types, message);
  const sig = ethers.Signature.from(signature);

  return { from: wallet.address, to, value: valueRaw.toString(), validAfter, validBefore, nonce, v: sig.v, r: sig.r, s: sig.s };
}

// ─── Relay Submission ────────────────────────────────────────────────

async function submitToRelay(
  authorization: SignedAuthorization,
  acaHash: string,
  merchantId?: string,
  merchantName?: string,
  reference?: string,
): Promise<PaymentResult> {
  const baseResult = {
    from: authorization.from,
    to: authorization.to,
    amountFormatted: ethers.formatUnits(authorization.value, USDC_CONFIG.usdcDecimals),
    network: USDC_CONFIG.name,
  };

  try {
    const { data, error } = await supabase.functions.invoke(USDC_CONFIG.relayEndpoint, {
      body: {
        authorization: {
          from: authorization.from, to: authorization.to, value: authorization.value,
          validAfter: authorization.validAfter, validBefore: authorization.validBefore,
          nonce: authorization.nonce, v: authorization.v, r: authorization.r, s: authorization.s,
        },
        aca_hash: acaHash,
        merchant_id: merchantId,
        merchant_name: merchantName,
        reference,
        network: USDC_CONFIG.name,
        chainId: USDC_CONFIG.chainId,
      },
    });

    if (error) throw new Error(error.message || 'Relay request failed');

    if (data?.tx_hash) {
      return { ...baseResult, success: true, txHash: data.tx_hash, acaHash, blockExplorerUrl: `${USDC_CONFIG.blockExplorer}/tx/${data.tx_hash}` };
    } else {
      return { ...baseResult, success: false, error: data?.error || 'No transaction hash returned' };
    }
  } catch (e: any) {
    console.error('[USDCService] Relay submission failed:', e);
    return { ...baseResult, success: false, error: e.message || 'Failed to submit payment' };
  }
}

// ─── Full Payment Flow (with ACA) ───────────────────────────────────

export async function executePayment(
  wallet: ethers.HDNodeWallet,
  paymentRequest: PaymentRequest,
  amountOverride?: string,
): Promise<PaymentResult> {
  const amount = amountOverride || paymentRequest.amount;
  if (!amount) throw new Error('Amount is required for this payment');

  // Step 1: Generate ACA on device via hardware anchor
  console.log(`[USDCService] Generating ACA for ${amount} USDC → ${paymentRequest.recipient}`);
  const aca = await generateACAHash(wallet.address, paymentRequest.recipient, ["PAYMENT_TRANSACTION"]);
  console.log(`[USDCService] ACA generated: ${aca.hash.slice(0, 16)}...`);

  // Step 2: Store ACA in Supabase (before payment)
  const stored = await storePaymentACA(aca);
  if (!stored) {
    console.warn(`[USDCService] ACA storage failed — continuing with payment (hash still sent to relay)`);
  }

  // Step 3: Sign EIP-3009 authorization
  console.log(`[USDCService] Signing authorization...`);
  const authorization = await signTransferAuthorization(wallet, paymentRequest.recipient, amount);

  // Step 4: Submit to relay with ACA hash
  const result = await submitToRelay(
    authorization,
    aca.hash,
    paymentRequest.merchant_id,
    paymentRequest.merchant_name,
    paymentRequest.reference,
  );

  // Step 5: Mark ACA as consumed on success
  if (result.success && result.txHash) {
    await markACAConsumed(aca.hash, result.txHash);
    console.log(`[USDCService] Payment complete. Tx: ${result.txHash}`);
  } else {
    console.error(`[USDCService] Payment failed: ${result.error}`);
  }

  return { ...result, acaHash: aca.hash };
}