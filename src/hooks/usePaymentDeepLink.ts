/**
 * usePaymentDeepLink.ts
 *
 * Listens for payment deep links from NFC tags, QR scans, or external links.
 * Returns a parsed NfcPaymentRequest when one arrives.
 *
 * Integrates with:
 *   - Capacitor's App.addListener('appUrlOpen') for native deep links
 *   - window CustomEvent('nfc-payment') dispatched by MainActivity.kt
 *   - URL query param ?paymentUri= for web testing
 *
 * Usage in App.tsx:
 *   const { paymentRequest, clearPayment } = usePaymentDeepLink();
 */

import { useState, useEffect, useCallback } from 'react';
import { parsePaymentUri, type NfcPaymentRequest } from '@/services/paymentUriService';

export function usePaymentDeepLink() {
  const [paymentRequest, setPaymentRequest] = useState<NfcPaymentRequest | null>(null);

  const handleUri = useCallback((uri: string) => {
    console.log('[PaymentDeepLink] Received URI:', uri);
    const parsed = parsePaymentUri(uri);
    if (parsed) {
      console.log('[PaymentDeepLink] Parsed payment:', JSON.stringify(parsed, null, 2));
      setPaymentRequest(parsed);
    } else {
      console.log('[PaymentDeepLink] URI did not match payment format, ignoring.');
    }
  }, []);

  const clearPayment = useCallback(() => {
    setPaymentRequest(null);
  }, []);

  useEffect(() => {
    // ── Native deep links via Capacitor ──
    let capListener: any = null;

    const setupCapacitorListener = async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        const { App: CapApp } = await import('@capacitor/app');
        capListener = await CapApp.addListener('appUrlOpen', (event: any) => {
          const url = event.url;
          if (!url) return;

          // Direct matches
          if (url.startsWith('idialife://pay') || url.startsWith('ethereum:')) {
            handleUri(url);
            return;
          }

          // Encoded ethereum: inside an intent URL
          if (url.includes('ethereum%3A') || url.includes('ethereum:')) {
            const decoded = decodeURIComponent(url);
            const ethIdx = decoded.indexOf('ethereum:');
            if (ethIdx >= 0) {
              handleUri(decoded.substring(ethIdx));
              return;
            }
          }
        });
      } catch (e) {
        console.log('[PaymentDeepLink] Capacitor listener setup skipped:', e);
      }
    };
    setupCapacitorListener();

    // ── Web: check for ?paymentUri= query param (testing convenience) ──
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const payUri = urlParams.get('paymentUri');
      if (payUri) {
        handleUri(decodeURIComponent(payUri));
      }
    } catch { /* ignore on non-browser */ }

    // ── CustomEvent from MainActivity.kt ──
    const handleNfcEvent = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail;
      if (detail) handleUri(detail);
    };

    window.addEventListener('nfc-payment', handleNfcEvent);

    return () => {
      if (capListener) capListener.remove();
      window.removeEventListener('nfc-payment', handleNfcEvent);
    };
  }, [handleUri]);

  return { paymentRequest, clearPayment };
}