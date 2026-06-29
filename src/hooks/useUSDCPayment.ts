/**
 * useUSDCPayment — handles EIP-3009 signing and relay for gasless USDC payments.
 *
 * Balance display is now handled by useWallet().balances.usdc — this hook
 * only manages the payment signing + relay submission flow.
 */

import { useState, useCallback } from 'react';
import { walletService } from '@/services/walletService';
import {
  executePayment,
  type PaymentResult,
} from '@/services/usdcService';
import { USDC_CONFIG, USDC_TEST_MODE, type PaymentRequest } from '@/config/usdc';

export function useUSDCPayment() {
  const [isPaymentPending, setIsPaymentPending] = useState(false);
  const [lastPaymentResult, setLastPaymentResult] = useState<PaymentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usdcBalance, setUsdcBalance] = useState<{ formatted: string; raw: string } | null>(null);

  const refreshUSDCBalance = useCallback(async () => {
    try {
      if (!walletService.getAddress()) { setUsdcBalance(null); return; }
      const b = await walletService.getUSDCBalance();
      setUsdcBalance({ formatted: b.balanceFormatted, raw: b.balance });
    } catch (e) {
      console.error('USDC balance refresh failed:', e);
      setUsdcBalance(null);
    }
  }, []);

  const pay = useCallback(async (
    paymentRequest: PaymentRequest,
    amountOverride?: string,
  ): Promise<PaymentResult> => {
    setError(null);
    setIsPaymentPending(true);
    setLastPaymentResult(null);

    try {
      const rawWallet = walletService.getRawWallet();
      if (!rawWallet) throw new Error('No wallet available. Please create or import a wallet first.');

      const result = await executePayment(rawWallet, paymentRequest, amountOverride);
      setLastPaymentResult(result);
      refreshUSDCBalance();
      return result;
    } catch (e: any) {
      const errMsg = e.message || 'Payment failed';
      setError(errMsg);
      const failResult: PaymentResult = {
        success: false,
        error: errMsg,
        from: walletService.getAddress() || '',
        to: paymentRequest.recipient,
        amountFormatted: amountOverride || paymentRequest.amount || '0',
        network: USDC_CONFIG.name,
      };
      setLastPaymentResult(failResult);
      return failResult;
    } finally {
      setIsPaymentPending(false);
    }
  }, [refreshUSDCBalance]);

  return {
    pay,
    isPaymentPending,
    lastPaymentResult,
    usdcBalance,
    refreshUSDCBalance,
    clearLastResult: useCallback(() => setLastPaymentResult(null), []),
    error,
    clearError: useCallback(() => setError(null), []),
    isTestMode: USDC_TEST_MODE,
    networkName: USDC_CONFIG.name,
    blockExplorer: USDC_CONFIG.blockExplorer,
  };
}