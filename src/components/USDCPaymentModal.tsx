/**
 * USDCPaymentModal
 *
 * Shown after NFC tap or QR scan reads a payment request.
 * Displays: amount, recipient/merchant, user's USDC balance.
 * On confirm: signs EIP-3009 authorization off-chain → submits to relay → shows result.
 */

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle, AlertTriangle, ExternalLink, Copy, Shield, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useUSDCPayment } from '@/hooks/useUSDCPayment';
import { type PaymentRequest, USDC_TEST_MODE } from '@/config/usdc';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  paymentRequest: PaymentRequest | null;
  connectedWallet?: string | null; // Added to support MetaMask integration
}

type Phase = 'review' | 'amount-entry' | 'signing' | 'relaying' | 'success' | 'error';

const USDCPaymentModal: React.FC<Props> = ({ isOpen, onClose, paymentRequest, connectedWallet }) => {
  const { toast } = useToast();
  const { usdcBalance, refreshUSDCBalance, pay, isPaymentPending } = useUSDCPayment();

  const [phase, setPhase] = useState<Phase>('review');
  const [customAmount, setCustomAmount] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState<string>('');

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && paymentRequest) {
      setErrorMsg(null);
      setTxHash(null);
      setExplorerUrl(null);
      setCustomAmount('');
      setPaidAmount('');

      if (paymentRequest.amount) {
        setPhase('review');
      } else {
        setPhase('amount-entry');
      }

      refreshUSDCBalance();
    }
  }, [isOpen, paymentRequest, refreshUSDCBalance]);

  const effectiveAmount = paymentRequest?.amount || customAmount;

  const handleConfirm = async () => {
    if (!paymentRequest || !effectiveAmount) return;

    setPhase('signing');
    setErrorMsg(null);

    try {
      // Small delay so user sees "Signing..." before it switches to "Submitting..."
      await new Promise(r => setTimeout(r, 300));
      setPhase('relaying');

      // Note: If you need to route the payment differently when connectedWallet is present, 
      // you can pass connectedWallet into the `pay` function here depending on your hook implementation.
      const result = await pay(paymentRequest, customAmount || undefined);

      if (result.success) {
        setTxHash(result.txHash || null);
        setExplorerUrl(result.blockExplorerUrl || null);
        setPaidAmount(result.amountFormatted);
        setPhase('success');
      } else {
        setErrorMsg(result.error || 'Payment failed');
        setPhase('error');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Unexpected error');
      setPhase('error');
    }
  };

  const handleClose = () => {
    if (phase === 'signing' || phase === 'relaying') return; // Don't close during active tx
    onClose();
  };

  const truncate = (a: string) => `${a.slice(0, 8)}...${a.slice(-6)}`;
  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast({ title: 'Copied' });
  };

  const balanceFloat = usdcBalance ? parseFloat(usdcBalance.formatted) : 0;
  const amountFloat = effectiveAmount ? parseFloat(effectiveAmount) : 0;
  const hasEnoughBalance = balanceFloat >= amountFloat && amountFloat > 0;

  if (!paymentRequest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-blue-600" />
            {phase === 'success' ? 'Payment Sent' : phase === 'error' ? 'Payment Failed' : 'Confirm USDC Payment'}
          </DialogTitle>
          {USDC_TEST_MODE && (
            <div className="text-xs bg-purple-100 text-purple-800 rounded px-2 py-0.5 w-fit">
              Testnet Mode
            </div>
          )}
          <DialogDescription>
            {phase === 'review' && 'Review the payment details before signing.'}
            {phase === 'amount-entry' && 'Enter the amount to pay.'}
            {phase === 'signing' && 'Signing the payment authorization...'}
            {phase === 'relaying' && 'Submitting payment to the network...'}
            {phase === 'success' && 'Your USDC payment has been confirmed on-chain.'}
            {phase === 'error' && 'The payment could not be completed.'}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Amount Entry (open-amount payments) ─── */}
        {phase === 'amount-entry' && (
          <div className="space-y-4">
            {paymentRequest.merchant_name && (
              <div className="text-center">
                <p className="font-semibold">{paymentRequest.merchant_name}</p>
                {paymentRequest.reference && (
                  <p className="text-xs text-muted-foreground">Ref: {paymentRequest.reference}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Amount (USDC)</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                className="text-2xl text-center font-bold h-14"
              />
              {usdcBalance && (
                <p className="text-xs text-muted-foreground text-center">
                  Balance: {parseFloat(usdcBalance.formatted).toFixed(2)} USDC
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={() => setPhase('review')}
                disabled={!customAmount || parseFloat(customAmount) <= 0}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Review
              </Button>
            </div>
          </div>
        )}

        {/* ─── Review ─── */}
        {phase === 'review' && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                {/* Merchant */}
                {paymentRequest.merchant_name && (
                  <div className="text-center pb-2 border-b">
                    <p className="font-semibold text-lg">{paymentRequest.merchant_name}</p>
                    {paymentRequest.reference && (
                      <p className="text-xs text-muted-foreground">Ref: {paymentRequest.reference}</p>
                    )}
                  </div>
                )}

                {/* Amount */}
                <div className="text-center py-2">
                  <p className="text-3xl font-bold">${effectiveAmount}</p>
                  <p className="text-sm text-muted-foreground">USDC</p>
                </div>

                {/* Recipient */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">To</span>
                  <div className="flex items-center gap-1">
                    <code className="text-xs font-mono">{truncate(paymentRequest.recipient)}</code>
                    <Button size="sm" variant="ghost" className="h-5 w-5 p-0" onClick={() => copy(paymentRequest.recipient)}>
                      <Copy className="w-2.5 h-2.5" />
                    </Button>
                  </div>
                </div>

                {/* Your balance */}
                <div className="flex justify-between items-center text-sm border-t pt-2">
                  <span className="text-muted-foreground">Your Balance</span>
                  <span className={hasEnoughBalance ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                    {usdcBalance ? `${parseFloat(usdcBalance.formatted).toFixed(2)} USDC` : 'Loading...'}
                  </span>
                </div>

                {/* Connected Wallet Info */}
                {connectedWallet && (
                  <div className="flex justify-between items-center text-sm border-t pt-2">
                    <span className="text-muted-foreground">Paying With</span>
                    <span className="text-orange-600 font-mono text-xs">{truncate(connectedWallet)}</span>
                  </div>
                )}

                {/* Gas info */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Gas Fee</span>
                  <span className="text-green-600 text-xs">Free (paid by IDIA)</span>
                </div>
              </CardContent>
            </Card>

            {!hasEnoughBalance && effectiveAmount && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-xs text-red-800">
                    Insufficient USDC balance. You need {effectiveAmount} USDC but have {usdcBalance ? parseFloat(usdcBalance.formatted).toFixed(2) : '0.00'}.
                  </p>
                </div>
              </div>
            )}

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-800">
                  You'll sign a message authorizing this transfer. No gas fees will be charged to your wallet. The signature expires in 5 minutes.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={paymentRequest.amount ? handleClose : () => setPhase('amount-entry')}>
                {paymentRequest.amount ? 'Cancel' : 'Back'}
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={!hasEnoughBalance || isPaymentPending}
                className="bg-blue-500 hover:bg-blue-600"
              >
                Sign & Pay
              </Button>
            </div>
          </div>
        )}

        {/* ─── Signing / Relaying ─── */}
        {(phase === 'signing' || phase === 'relaying') && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto" />
            <p className="font-semibold">
              {phase === 'signing' ? 'Signing authorization...' : 'Submitting to network...'}
            </p>
            <p className="text-sm text-muted-foreground">
              {phase === 'signing'
                ? 'Your wallet is signing the payment message.'
                : 'The IDIA relay is submitting your payment on-chain.'}
            </p>
          </div>
        )}

        {/* ─── Success ─── */}
        {phase === 'success' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-green-700">Payment Sent!</h3>
              <p className="text-2xl font-bold mt-1">${paidAmount} USDC</p>
              {paymentRequest.merchant_name && (
                <p className="text-sm text-muted-foreground">to {paymentRequest.merchant_name}</p>
              )}
            </div>

            {txHash && (
              <Card>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Transaction Hash</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono flex-1 truncate">{txHash}</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(txHash)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-2">
              {explorerUrl && (
                <Button variant="outline" onClick={() => window.open(explorerUrl, '_blank')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  View
                </Button>
              )}
              <Button onClick={handleClose} className={`bg-blue-500 hover:bg-blue-600 ${explorerUrl ? '' : 'col-span-2'}`}>
                Done
              </Button>
            </div>
          </div>
        )}

        {/* ─── Error ─── */}
        {phase === 'error' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-semibold text-red-700">Payment Failed</h3>
              <p className="text-sm text-muted-foreground mt-2">{errorMsg}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button onClick={() => setPhase('review')} className="bg-blue-500 hover:bg-blue-600">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default USDCPaymentModal;