/**
 * NfcPaymentModal.tsx
 *
 * Payment confirmation modal triggered by NFC tag scans or deep links.
 * Also serves as the NFC Payroll entry point (replacing Coming Soon).
 *
 * Payment routing:
 *   USDC on Base/Base Sepolia → gasless EIP-3009 relay via useUSDCPayment
 *   Everything else            → direct on-chain via walletService.sendToken
 *
 * States:
 *   idle       → waiting for NFC tap (shows instructions)
 *   confirming → payment parsed, user reviews details
 *   sending    → transaction in flight
 *   success    → tx confirmed, shows hash + explorer link
 *   error      → something failed, shows retry
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Smartphone,
  CheckCircle2,
  XCircle,
  Loader2,
  ArrowRight,
  ExternalLink,
  Nfc,
  Zap,
} from 'lucide-react';
import { walletService, NETWORKS, type NetworkConfig } from '@/services/walletService';
import { useUSDCPayment } from '@/hooks/useUSDCPayment';
import { USDC_CONFIG } from '@/config/usdc';
import type { PaymentRequest as USDCPaymentRequest } from '@/config/usdc';
import type { NfcPaymentRequest } from '@/services/paymentUriService';
import { isGaslessUSDC } from '@/services/paymentUriService';

interface NfcPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** If provided, skips the idle state and goes straight to confirming */
  paymentRequest?: NfcPaymentRequest | null;
  /** Called when modal wants to clear the payment request */
  onClearPayment?: () => void;
}

type ModalState = 'idle' | 'confirming' | 'sending' | 'success' | 'error';

const NfcPaymentModal: React.FC<NfcPaymentModalProps> = ({
  isOpen,
  onClose,
  paymentRequest,
  onClearPayment,
}) => {
  const [state, setState] = useState<ModalState>('idle');
  const [txHash, setTxHash] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [useGasless, setUseGasless] = useState(false);

  // Gasless USDC payment hook
  const { pay: payUSDC, isPaymentPending } = useUSDCPayment();

  // When a paymentRequest arrives, determine routing and move to confirming
  useEffect(() => {
    if (paymentRequest && isOpen) {
      setUseGasless(isGaslessUSDC(paymentRequest));
      setState('confirming');
    } else if (isOpen && !paymentRequest) {
      setState('idle');
    }
  }, [paymentRequest, isOpen]);

  const getNetworkForChainId = (
    chainId: number,
  ): { key: string; config: NetworkConfig } | null => {
    for (const [key, config] of Object.entries(NETWORKS)) {
      if (config.chainId === chainId) return { key, config };
    }
    return null;
  };

  const handleConfirm = useCallback(async () => {
    if (!paymentRequest) return;

    setState('sending');
    setErrorMsg(null);

    try {
      if (useGasless) {
        // ── Gasless EIP-3009 relay for USDC ──
        // Convert NfcPaymentRequest → @/config/usdc PaymentRequest
        const usdcReq: USDCPaymentRequest = {
          recipient: paymentRequest.recipient,
          amount: paymentRequest.amount,
          merchant_id: paymentRequest.merchantId,
          merchant_name: paymentRequest.merchantName,
          reference: paymentRequest.reference,
        };

        const result = await payUSDC(usdcReq);

        if (result.success && result.txHash) {
          setTxHash(result.txHash);
          setExplorerUrl(
            result.blockExplorerUrl ||
              `${USDC_CONFIG.blockExplorer}/tx/${result.txHash}`,
          );
          setState('success');
        } else {
          throw new Error(result.error || 'Gasless payment failed');
        }
      } else {
        // ── Direct on-chain transfer ──
        const network = getNetworkForChainId(paymentRequest.chainId);
        if (!network) {
          throw new Error(
            `Unsupported network (Chain ID: ${paymentRequest.chainId}). Add it to your wallet's network list.`,
          );
        }

        // Switch to the correct network if needed
        const currentKey = walletService.getActiveNetworkKey();
        if (currentKey !== network.key) {
          await walletService.switchNetwork(network.key);
        }

        let result;

        if (paymentRequest.type === 'erc20') {
          result = await walletService.sendToken(
            paymentRequest.tokenContract,
            paymentRequest.recipient,
            paymentRequest.amount,
          );
        } else {
          result = await walletService.sendNative(
            paymentRequest.recipient,
            paymentRequest.amount,
          );
        }

        setTxHash(result.hash);
        setExplorerUrl(
          result.blockExplorerUrl ||
            `${network.config.blockExplorer}/tx/${result.hash}`,
        );
        setState('success');
      }
    } catch (err: any) {
      console.error('[NfcPayment] Transaction failed:', err);
      setErrorMsg(err?.message || 'Transaction failed. Please try again.');
      setState('error');
    }
  }, [paymentRequest, useGasless, payUSDC]);

  const handleClose = () => {
    setState('idle');
    setTxHash(null);
    setErrorMsg(null);
    setExplorerUrl(null);
    setUseGasless(false);
    onClearPayment?.();
    onClose();
  };

  const handleRetry = () => {
    setState('confirming');
    setErrorMsg(null);
  };

  const truncateAddress = (addr: string) =>
    `${addr.slice(0, 8)}...${addr.slice(-6)}`;

  const networkInfo = paymentRequest
    ? getNetworkForChainId(paymentRequest.chainId)
    : null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Nfc className="w-5 h-5 text-teal-600" />
            NFC Pay
          </DialogTitle>
          <DialogDescription>
            {state === 'idle' && 'Tap an NFC payment tag to begin.'}
            {state === 'confirming' && 'Review the payment details below.'}
            {state === 'sending' && 'Processing your transaction...'}
            {state === 'success' && 'Payment sent successfully!'}
            {state === 'error' && 'Something went wrong.'}
          </DialogDescription>
        </DialogHeader>

        {/* ── IDLE: Waiting for NFC tap ── */}
        {state === 'idle' && (
          <div className="text-center py-8 px-4">
            <div className="w-20 h-20 bg-teal-50 dark:bg-teal-950 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <Smartphone className="w-10 h-10 text-teal-500" />
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Hold your phone near an NFC payment tag.
            </p>
            <p className="text-xs text-muted-foreground/60">
              The tag will open a payment confirmation screen automatically.
            </p>
          </div>
        )}

        {/* ── CONFIRMING: Review payment ── */}
        {state === 'confirming' && paymentRequest && (
          <div className="space-y-4 py-2">
            {/* Amount */}
            <div className="text-center py-4 bg-secondary/50 rounded-lg">
              <p className="text-3xl font-bold">
                {paymentRequest.symbol === 'USDC' && '$'}
                {paymentRequest.amount} {paymentRequest.symbol}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentRequest.type === 'erc20'
                  ? 'Token Transfer'
                  : 'Native Transfer'}
              </p>
            </div>

            {/* Gasless badge */}
            {useGasless && (
              <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-full mx-auto w-fit">
                <Zap className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-700 dark:text-green-300">
                  Gasless — no ETH needed
                </span>
              </div>
            )}

            {/* Details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">To</span>
                <span className="font-mono text-xs">
                  {truncateAddress(paymentRequest.recipient)}
                </span>
              </div>

              {paymentRequest.type === 'erc20' && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Token Contract</span>
                  <span className="font-mono text-xs">
                    {truncateAddress(paymentRequest.tokenContract)}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Network</span>
                <span>
                  {networkInfo?.config.name || `Chain ${paymentRequest.chainId}`}
                </span>
              </div>

              {paymentRequest.merchantName && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Merchant</span>
                  <span>{paymentRequest.merchantName}</span>
                </div>
              )}

              {paymentRequest.reference && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs">
                    {paymentRequest.reference}
                  </span>
                </div>
              )}

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Method</span>
                <span className="text-xs">
                  {useGasless ? 'EIP-3009 Relay (Gasless)' : 'Direct On-Chain'}
                </span>
              </div>
            </div>

            {/* Warning */}
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-200">
                {networkInfo?.config.isTestnet
                  ? 'This is a testnet transaction — tokens have no real value.'
                  : 'This will send real tokens. Verify the recipient before confirming.'}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleConfirm}
              >
                Confirm
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── SENDING: In-flight ── */}
        {state === 'sending' && (
          <div className="text-center py-8">
            <Loader2 className="w-12 h-12 text-teal-500 mx-auto mb-4 animate-spin" />
            <p className="text-sm text-muted-foreground">
              Sending {paymentRequest?.amount} {paymentRequest?.symbol}...
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {useGasless
                ? 'Signing authorization and submitting to relay...'
                : 'Waiting for blockchain confirmation.'}
            </p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {state === 'success' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-green-50 dark:bg-green-950 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <div>
              <p className="text-lg font-semibold">Payment Sent!</p>
              <p className="text-sm text-muted-foreground mt-1">
                {paymentRequest?.symbol === 'USDC' && '$'}
                {paymentRequest?.amount} {paymentRequest?.symbol} sent
                successfully.
              </p>
            </div>

            {txHash && (
              <div className="bg-secondary/50 rounded-lg p-3">
                <p className="text-xs text-muted-foreground mb-1">
                  Transaction Hash
                </p>
                <p className="font-mono text-xs break-all">{txHash}</p>
              </div>
            )}

            <div className="flex gap-3">
              {explorerUrl && (
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => window.open(explorerUrl, '_blank')}
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Explorer
                </Button>
              )}
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleClose}
              >
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {state === 'error' && (
          <div className="text-center py-6 space-y-4">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-950 rounded-full flex items-center justify-center mx-auto">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <p className="text-lg font-semibold">Payment Failed</p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2 max-w-xs mx-auto">
                {errorMsg}
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="flex-1 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleRetry}
              >
                Retry
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default NfcPaymentModal;