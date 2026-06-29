/**
 * paymentUriService.ts
 *
 * Parses payment request URIs from NFC tags, QR codes, or deep links.
 * Supports two formats:
 *
 *   1. IDIA custom:  idialife://pay?token=0x...&to=0x...&amount=1&decimals=6&chainId=84532&symbol=USDC
 *   2. EIP-681:      ethereum:0x<contract>@<chainId>/transfer?address=0x<recipient>&uint256=<atomicAmount>
 *
 * Both resolve to the same NfcPaymentRequest object consumed by the UI.
 *
 * NOTE: This type is named NfcPaymentRequest (not PaymentRequest) to avoid
 * collision with the PaymentRequest type exported by @/config/usdc, which
 * is used by the gasless EIP-3009 relay system.
 */

export interface NfcPaymentRequest {
  /** 'native' for ETH/gas-token sends, 'erc20' for token transfers */
  type: 'native' | 'erc20';
  /** For erc20: the token contract address. For native: same as recipient */
  tokenContract: string;
  /** The actual recipient of funds */
  recipient: string;
  /** Human-readable amount (e.g. "1") */
  amount: string;
  /** Token decimals (default 18 for native, varies for erc20) */
  decimals: number;
  /** Chain ID — determines which network to use */
  chainId: number;
  /** Token symbol for display (e.g. "USDC", "ETH") */
  symbol: string;
  /** Optional merchant ID (from idialife:// tags) */
  merchantId?: string;
  /** Optional merchant name (from idialife:// tags) */
  merchantName?: string;
  /** Optional reference/invoice ID (from idialife:// tags) */
  reference?: string;
  /** Original raw URI for debugging / logging */
  rawUri: string;
}

/**
 * Primary entry point — accepts any URI string and attempts to parse it.
 * Returns null if the URI doesn't match either supported format.
 */
export function parsePaymentUri(uri: string): NfcPaymentRequest | null {
  const trimmed = uri.trim();

  if (trimmed.startsWith('idialife://pay')) {
    return parseIdiaLifeUri(trimmed);
  }
  if (trimmed.startsWith('ethereum:')) {
    return parseEip681Uri(trimmed);
  }

  return null;
}

/**
 * Returns true if this NFC payment should use the gasless EIP-3009 relay.
 * Currently: any USDC transfer on Base (8453) or Base Sepolia (84532).
 */
export function isGaslessUSDC(req: NfcPaymentRequest): boolean {
  if (req.type !== 'erc20') return false;
  const contractLower = req.tokenContract.toLowerCase();
  // Circle's official USDC contracts on Base chains
  const USDC_CONTRACTS: Record<number, string> = {
    84532: '0x036cbd53842c5426634e7929541ec2318f3dcf7e',
    8453: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  };
  return USDC_CONTRACTS[req.chainId] === contractLower;
}

/* ─────────────────────────────────────────────
 *  idialife://pay  parser
 * ───────────────────────────────────────────── */

function parseIdiaLifeUri(uri: string): NfcPaymentRequest | null {
  try {
    const url = new URL(uri);
    const params = url.searchParams;

    const to = params.get('to');
    if (!to || !isValidAddress(to)) return null;

    const token = params.get('token');
    const amount = params.get('amount') || '0';
    const decimals = parseInt(params.get('decimals') || '18', 10);
    const chainId = parseInt(params.get('chainId') || '0', 10);
    const symbol = params.get('symbol') || (token ? 'TOKEN' : 'ETH');

    if (chainId === 0) return null;

    // Optional merchant/reference fields
    const merchantId = params.get('merchant_id') || undefined;
    const merchantName = params.get('merchant_name') || undefined;
    const reference = params.get('reference') || undefined;

    if (token && isValidAddress(token)) {
      return {
        type: 'erc20',
        tokenContract: token,
        recipient: to,
        amount,
        decimals,
        chainId,
        symbol,
        merchantId,
        merchantName,
        reference,
        rawUri: uri,
      };
    }

    return {
      type: 'native',
      tokenContract: to,
      recipient: to,
      amount,
      decimals,
      chainId,
      symbol,
      merchantId,
      merchantName,
      reference,
      rawUri: uri,
    };
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────
 *  EIP-681  ethereum:  parser
 * ───────────────────────────────────────────── */

function parseEip681Uri(uri: string): NfcPaymentRequest | null {
  try {
    const stripped = uri.replace(/^ethereum:/, '');

    const qIdx = stripped.indexOf('?');
    const pathPart = qIdx >= 0 ? stripped.substring(0, qIdx) : stripped;
    const queryStr = qIdx >= 0 ? stripped.substring(qIdx + 1) : '';

    const params = new URLSearchParams(queryStr);

    let rest = pathPart;
    let functionName: string | null = null;

    const slashIdx = rest.indexOf('/');
    if (slashIdx >= 0) {
      functionName = rest.substring(slashIdx + 1);
      rest = rest.substring(0, slashIdx);
    }

    let chainId = 1;
    const atIdx = rest.indexOf('@');
    if (atIdx >= 0) {
      chainId = parseInt(rest.substring(atIdx + 1), 10) || 1;
      rest = rest.substring(0, atIdx);
    }

    const targetAddress = rest.replace(/^pay-/, '');
    if (!isValidAddress(targetAddress)) return null;

    // ── ERC-20 transfer ──
    if (functionName === 'transfer') {
      const recipient = params.get('address');
      if (!recipient || !isValidAddress(recipient)) return null;

      const rawAmount = params.get('uint256') || '0';
      const { amount, decimals } = parseScientificAmount(rawAmount);
      const symbol = inferTokenSymbol(targetAddress, chainId);

      return {
        type: 'erc20',
        tokenContract: targetAddress,
        recipient,
        amount,
        decimals,
        chainId,
        symbol,
        rawUri: uri,
      };
    }

    // ── Native ETH/gas-token send ──
    if (!functionName) {
      const rawValue = params.get('value') || '0';
      const { amount } = parseScientificAmount(rawValue);
      const symbol = inferNativeSymbol(chainId);

      return {
        type: 'native',
        tokenContract: targetAddress,
        recipient: targetAddress,
        amount,
        decimals: 18,
        chainId,
        symbol,
        rawUri: uri,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/* ─────────────────────────────────────────────
 *  Helpers
 * ───────────────────────────────────────────── */

function isValidAddress(addr: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

function parseScientificAmount(raw: string): { amount: string; decimals: number } {
  const sciMatch = raw.match(/^([0-9]*\.?[0-9]+)[eE]([0-9]+)$/);
  if (sciMatch) {
    const mantissa = parseFloat(sciMatch[1]);
    const exponent = parseInt(sciMatch[2], 10);
    return { amount: mantissa.toString(), decimals: exponent };
  }
  const num = parseFloat(raw);
  if (isNaN(num)) return { amount: '0', decimals: 18 };
  return { amount: raw, decimals: 18 };
}

const KNOWN_TOKENS: Record<string, Record<string, { symbol: string; decimals: number }>> = {
  '84532': {
    '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 },
  },
  '8453': {
    '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  },
  '1': {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { symbol: 'USDT', decimals: 6 },
  },
};

function inferTokenSymbol(contractAddress: string, chainId: number): string {
  const chainTokens = KNOWN_TOKENS[chainId.toString()];
  if (!chainTokens) return 'TOKEN';
  const info = chainTokens[contractAddress.toLowerCase()];
  return info?.symbol || 'TOKEN';
}

const NATIVE_SYMBOLS: Record<number, string> = {
  1: 'ETH', 14: 'FLR', 56: 'BNB', 137: 'MATIC',
  8453: 'ETH', 10: 'ETH', 42161: 'ETH', 43114: 'AVAX',
  84532: 'ETH', 11155111: 'ETH',
};

function inferNativeSymbol(chainId: number): string {
  return NATIVE_SYMBOLS[chainId] || 'ETH';
}