/**
 * PaymentTrigger
 *
 * USDC payment initiation via NFC tap (Android only) or QR scan (both platforms).
 * Shows "Coming Soon" when on mainnet (Base), active when on testnet (Base Sepolia).
 */

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Nfc, QrCode, Loader2, AlertTriangle, Camera, Clock } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { isAndroid } from '@/services/platform';
import { parsePaymentRequest, USDC_PAYMENTS_ENABLED, type PaymentRequest } from '@/config/usdc';
import IDIANFC from '@/plugins/nfc';
import USDCPaymentModal from './USDCPaymentModal';

const PaymentTrigger: React.FC = () => {
  const [isNfcListening, setIsNfcListening] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [qrError, setQrError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Payments only enabled on testnet builds (controlled by ACTIVE_DEPLOYMENT in contracts.ts)
  const isPaymentEnabled = USDC_PAYMENTS_ENABLED;

  // ─── NFC Tap Handler (Android only) ────────────────────────────

  const handleNfcTap = useCallback(async () => {
    if (!isPaymentEnabled) return;
    setNfcError(null);
    setIsNfcListening(true);

    try {
      if (!Capacitor.isNativePlatform()) {
        setNfcError('NFC is only available on mobile devices.');
        setIsNfcListening(false);
        return;
      }

      console.log('[PaymentTrigger] Starting NFC reader...');

      const result = await IDIANFC.beginHandshake({
        config: { aca_hash: 'PAYMENT_INTENT', base_signature: 'pending_payment' },
      });

      console.log('[PaymentTrigger] NFC result:', result);

      // The plugin returns { payload: '{"scanned_intent":"...","aca_hash":"...","timestamp":"..."}' }
      const payloadStr = typeof result.payload === 'string'
        ? result.payload
        : JSON.stringify(result.payload);

      console.log('[PaymentTrigger] Raw payload string:', payloadStr);

      // Extract scanned_intent from the wrapper
      let rawPaymentData: string;
      try {
        const nfcResult = JSON.parse(payloadStr);
        rawPaymentData = nfcResult.scanned_intent || payloadStr;
        console.log('[PaymentTrigger] Extracted scanned_intent:', rawPaymentData);
      } catch {
        rawPaymentData = payloadStr;
        console.log('[PaymentTrigger] Using raw payload (no JSON wrapper):', rawPaymentData);
      }

      const parsed = parsePaymentRequest(rawPaymentData);
      console.log('[PaymentTrigger] Parsed payment request:', parsed);

      if (!parsed) {
        setNfcError('This NFC tag does not contain a valid USDC payment request.');
        setIsNfcListening(false);
        return;
      }

      setPaymentRequest(parsed);
      setShowPaymentModal(true);
    } catch (e: any) {
      console.error('[PaymentTrigger] NFC error:', e);
      if (e.message?.includes('cancelled') || e.message?.includes('cancel')) {
        setNfcError(null);
      } else if (e.message?.includes('unsupported') || e.message?.includes('disabled')) {
        setNfcError('NFC is not available or disabled. Check your device settings.');
      } else {
        setNfcError(e.message || 'Failed to read NFC tag');
      }
    } finally {
      setIsNfcListening(false);
    }
  }, [isPaymentEnabled]);

  // ─── QR Code Handler ──────────────────────────────────────────

  const handleQrSubmit = useCallback(() => {
    setQrError(null);
    const trimmed = qrInput.trim();
    if (!trimmed) { setQrError('Please paste a payment QR code or URL.'); return; }

    const parsed = parsePaymentRequest(trimmed);
    if (!parsed) { setQrError('Invalid payment code. Expected a USDC payment request.'); return; }

    setPaymentRequest(parsed);
    setShowPaymentModal(true);
    setShowQrScanner(false);
    setQrInput('');
  }, [qrInput]);

  const handlePaymentClose = useCallback(() => {
    setShowPaymentModal(false);
    setPaymentRequest(null);
  }, []);

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              Pay with USDC
            </CardTitle>
            {isPaymentEnabled ? (
              <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">Testnet</Badge>
            ) : (
              <Badge variant="secondary" className="bg-amber-100 text-amber-800 text-xs">Coming Soon</Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            {isPaymentEnabled
              ? "Send USDC payments via NFC tap or QR code. No gas fees — powered by IDIA relay."
              : "Gasless USDC payments are coming soon. This feature is currently in development."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isPaymentEnabled ? (
            <>
              {/* NFC Tap — Android only */}
              {isAndroid() && (
                <Button
                  onClick={handleNfcTap}
                  disabled={isNfcListening}
                  className="w-full bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white h-12"
                >
                  {isNfcListening ? (
                    <><Loader2 className="w-5 h-5 mr-2 animate-spin" />Waiting for NFC tap...</>
                  ) : (
                    <><Nfc className="w-5 h-5 mr-2" />Tap to Pay</>
                  )}
                </Button>
              )}

              {nfcError && (
                <div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
                  <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{nfcError}
                </div>
              )}

              {/* QR Code — both platforms */}
              <Button variant="outline" onClick={() => setShowQrScanner(true)} className="w-full h-12">
                <QrCode className="w-5 h-5 mr-2" />Scan Payment QR Code
              </Button>
            </>
          ) : (
            <div className="text-center py-4 space-y-3">
              <div className="w-14 h-14 bg-amber-100 dark:bg-amber-900 rounded-full flex items-center justify-center mx-auto">
                <Clock className="w-7 h-7 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium">USDC Payments Coming Soon</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Gasless NFC and QR code payments will be available once approved for production use.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR Input Dialog */}
      <Dialog open={showQrScanner} onOpenChange={setShowQrScanner}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Camera className="w-5 h-5" />Scan or Paste Payment Code</DialogTitle>
            <DialogDescription>Paste a payment URL or QR code content below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input placeholder='Paste payment URL or JSON...' value={qrInput} onChange={(e) => setQrInput(e.target.value)} className="font-mono text-xs" />
            {qrError && (<div className="p-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-300">{qrError}</div>)}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => { setShowQrScanner(false); setQrInput(''); setQrError(null); }}>Cancel</Button>
              <Button onClick={handleQrSubmit} disabled={!qrInput.trim()} className="bg-blue-500 hover:bg-blue-600">Process Payment</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Payment confirmation modal */}
      <USDCPaymentModal isOpen={showPaymentModal} onClose={handlePaymentClose} paymentRequest={paymentRequest} />
    </>
  );
};

export default PaymentTrigger;