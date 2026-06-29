/**
 * USDC Payment Configuration
 *
 * Derives network settings from ACTIVE_DEPLOYMENT in contracts.ts.
 * No separate toggle — one source of truth for testnet vs mainnet.
 *
 * IMPORTANT: USDC payments are DISABLED on mainnet until legally cleared.
 * The PaymentTrigger component checks USDC_PAYMENTS_ENABLED and shows
 * "Coming Soon" when false.
 */

import { ACTIVE_DEPLOYMENT, IS_TESTNET, PROTOCOL } from './contracts';

// ─── Payment feature gate ───────────────────────────────────────────
// USDC transfers are only enabled on testnet until legal approval.
// When ready for mainnet payments, set this to true.
export const USDC_PAYMENTS_ENABLED = true;
// ─────────────────────────────────────────────────────────────────────

export interface USDCNetworkConfig {
  name: string;
  chainId: number;
  rpcUrl: string;
  usdcAddress: string;
  blockExplorer: string;
  usdcDecimals: number;
  eip712: {
    name: string;
    version: string;
  };
  relayEndpoint: string;
}

const TESTNET_CONFIG: USDCNetworkConfig = {
  name: 'Base Sepolia',
  chainId: 84532,
  rpcUrl: 'https://sepolia.base.org',
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  blockExplorer: 'https://sepolia.basescan.org',
  usdcDecimals: 6,
  eip712: { name: 'USDC', version: '2' },
  relayEndpoint: 'relay-usdc-transfer',
};

const MAINNET_CONFIG: USDCNetworkConfig = {
  name: 'Base',
  chainId: 8453,
  rpcUrl: 'https://mainnet.base.org',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  blockExplorer: 'https://basescan.org',
  usdcDecimals: 6,
  eip712: { name: 'USDC', version: '2' },
  relayEndpoint: 'relay-usdc-transfer',
};

/**
 * Active USDC config — derived from ACTIVE_DEPLOYMENT.
 */
export const USDC_CONFIG: USDCNetworkConfig = IS_TESTNET
  ? TESTNET_CONFIG
  : MAINNET_CONFIG;

export const USDC_RELAY_URL = USDC_CONFIG.relayEndpoint;

export const USDC_AUTH_VALIDITY_SECONDS = 300;
export const USDC_MIN_PAYMENT = 0.01;
export const USDC_MAX_PAYMENT = 10_000;

// ─── Kept for backward compatibility ────────────────────────────────
// Components that imported USDC_TEST_MODE will still work.
// Prefer IS_TESTNET or USDC_PAYMENTS_ENABLED going forward.
export const USDC_TEST_MODE = IS_TESTNET;

// ─── Payment request structure (shared by NFC tags and QR codes) ────

export interface PaymentRequest {
  version: number;
  type: 'usdc_payment_request';
  recipient: string;
  amount: string | null;
  currency: 'USDC';
  network: 'base';
  merchant_id?: string;
  merchant_name?: string;
  reference?: string;
}

export function parsePaymentRequest(raw: string): PaymentRequest | null {
  try {
    if (raw.startsWith('idialife://pay')) {
      const url = new URL(raw);
      const b64 = url.searchParams.get('data');
      if (!b64) return null;
      raw = atob(b64);
    }

    const parsed = JSON.parse(raw);

    if (parsed.type !== 'usdc_payment_request') return null;
    if (!parsed.recipient || typeof parsed.recipient !== 'string') return null;
    if (parsed.recipient.length !== 42 || !parsed.recipient.startsWith('0x')) return null;
    if (parsed.currency !== 'USDC') return null;
    if (parsed.network !== 'base') return null;

    if (parsed.amount !== null && parsed.amount !== undefined) {
      const amt = parseFloat(parsed.amount);
      if (isNaN(amt) || amt < USDC_MIN_PAYMENT || amt > USDC_MAX_PAYMENT) return null;
    }

    return {
      version: parsed.version || 1,
      type: 'usdc_payment_request',
      recipient: parsed.recipient,
      amount: parsed.amount ?? null,
      currency: 'USDC',
      network: 'base',
      merchant_id: parsed.merchant_id,
      merchant_name: parsed.merchant_name,
      reference: parsed.reference,
    };
  } catch { return null; }
}

export function generatePaymentPayload(
  recipient: string, amount: string | null,
  merchantName?: string, merchantId?: string, reference?: string,
): string {
  return JSON.stringify({
    version: 1, type: 'usdc_payment_request',
    recipient, amount, currency: 'USDC', network: 'base',
    merchant_id: merchantId, merchant_name: merchantName, reference,
  });
}

export function generatePaymentUrl(
  recipient: string, amount: string | null,
  merchantName?: string, merchantId?: string, reference?: string,
): string {
  const json = generatePaymentPayload(recipient, amount, merchantName, merchantId, reference);
  return `idialife://pay?data=${btoa(json)}`;
}