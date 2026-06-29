/**
 * PaymentTrigger (NFC Tap-to-Pay & Payroll)
 *
 * Dedicated NFC interface for in-person transfers and tap-to-payroll.
 * Routes through the custom Swift WKWebView bridge (`initiateNfcHandshake`) or Capacitor.
 */

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Nfc, Loader2, AlertTriangle, Smartphone } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { isAndroid, isIOS } from "@/services/platform";
import { parsePaymentRequest, type PaymentRequest } from "@/config/usdc";
import IDIANFC from "@/plugins/nfc";
import USDCPaymentModal from "./USDCPaymentModal";

const PaymentTrigger: React.FC = () => {
  const [isNfcListening, setIsNfcListening] = useState(false);
  const [nfcError, setNfcError] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  // Clean up global iOS callbacks on unmount
  useEffect(() => {
    return () => {
      if ((window as any).onNfcHandshakeComplete) delete (window as any).onNfcHandshakeComplete;
      if ((window as any).onNfcHandshakeError) delete (window as any).onNfcHandshakeError;
    };
  }, []);

  // ─── NFC Tap Handler (iOS & Android) ─────────────────────────────

  const handleNfcTap = useCallback(async () => {
    console.log("[PaymentTrigger][handleNfcTap][START] Activating NFC hardware polling");
    setNfcError(null);
    setIsNfcListening(true);

    const payloadConfig = { aca_hash: "PAYMENT_INTENT", base_signature: "pending_payment" };

    // --- iOS WEBKIT BRIDGE PATH ---
    if (isIOS()) {
      console.log("[PaymentTrigger][handleNfcTap][iOS] Routing to custom WebKit bridge");

      if (!(window as any).webkit?.messageHandlers?.initiateNfcHandshake) {
        console.error("[PaymentTrigger][handleNfcTap][iOS_FAIL] WebKit message handler not found");
        setNfcError("iOS NFC Bridge not found. Please ensure you are running the IDIA Native App.");
        setIsNfcListening(false);
        return;
      }

      (window as any).onNfcHandshakeComplete = (response: any) => {
        console.log("[PaymentTrigger][handleNfcTap][iOS_SUCCESS] Received payload from CoreNFC");
        processRawNfcPayload(response);
      };

      (window as any).onNfcHandshakeError = (errorMsg: string) => {
        console.error(`[PaymentTrigger][handleNfcTap][iOS_ERROR] CoreNFC failed: ${errorMsg}`);
        if (!errorMsg.toLowerCase().includes("cancel")) {
          setNfcError(errorMsg || "Failed to read NFC tag");
        }
        setIsNfcListening(false);
      };

      (window as any).webkit.messageHandlers.initiateNfcHandshake.postMessage(payloadConfig);
      return;
    }

    // --- ANDROID CAPACITOR PATH ---
    if (isAndroid() && Capacitor.isNativePlatform()) {
      console.log("[PaymentTrigger][handleNfcTap][Android] Routing to Capacitor plugin");
      try {
        const result = await IDIANFC.beginHandshake({ config: payloadConfig });
        console.log("[PaymentTrigger][handleNfcTap][Android_SUCCESS] Received payload from Capacitor");
        processRawNfcPayload(result.payload);
      } catch (e: any) {
        console.error(`[PaymentTrigger][handleNfcTap][Android_ERROR] Hardware read aborted: ${e.message}`);
        if (e.message?.includes("cancelled") || e.message?.includes("cancel")) {
          setNfcError(null);
        } else if (e.message?.includes("unsupported") || e.message?.includes("disabled")) {
          setNfcError("NFC is not available or disabled. Check your device settings.");
        } else {
          setNfcError(e.message || "Failed to read NFC tag");
        }
        setIsNfcListening(false);
      }
      return;
    }

    // --- FALLBACK ---
    console.error("[PaymentTrigger][handleNfcTap][FATAL_FAIL] Execution blocked: Unsupported platform");
    setNfcError("NFC is only available on iOS and Android mobile devices.");
    setIsNfcListening(false);
  }, []);

  const processRawNfcPayload = (rawPayload: any) => {
    console.log("[PaymentTrigger][processRawNfcPayload][START] Processing incoming NFC data block");
    try {
      const payloadStr = typeof rawPayload === "string" ? rawPayload : JSON.stringify(rawPayload);

      let extractedIntent: string;
      try {
        const nfcResult = JSON.parse(payloadStr);
        extractedIntent = nfcResult.scanned_intent || payloadStr;
      } catch {
        extractedIntent = payloadStr;
      }

      const parsed = parsePaymentRequest(extractedIntent);

      if (!parsed) {
        console.error("[PaymentTrigger][processRawNfcPayload][FATAL_FAIL] Parsing rejected: Invalid USDC request");
        setNfcError("This NFC tag does not contain a valid USDC request.");
        setIsNfcListening(false);
        return;
      }

      console.log("[PaymentTrigger][processRawNfcPayload][END:OK] Payload parsed successfully. Hydrating modal.");
      setPaymentRequest(parsed);
      setShowPaymentModal(true);
    } catch (err: any) {
      console.error(`[PaymentTrigger][processRawNfcPayload][FATAL_FAIL] Payload processing error: ${err.message}`);
      setNfcError("An error occurred while processing the NFC payload.");
    } finally {
      setIsNfcListening(false);
    }
  };

  const handlePaymentClose = useCallback(() => {
    setShowPaymentModal(false);
    setPaymentRequest(null);
  }, []);

  // Only render if platform supports NFC, otherwise hide the card completely to keep UI clean
  if (!isIOS() && !isAndroid()) {
    return null;
  }

  return (
    <>
      <Card className="bg-white dark:bg-card border border-teal-100 dark:border-teal-900/40 shadow-sm rounded-2xl overflow-hidden mb-4">
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-black text-slate-800 dark:text-foreground flex items-center gap-2 uppercase tracking-wide">
                <Smartphone className="w-4 h-4 text-teal-600" />
                Tap-to-Pay / Payroll
              </h3>
              <p className="text-[11px] text-muted-foreground mt-1">
                Hold your device near an IDIA terminal to transact.
              </p>
            </div>
            <Button
              onClick={handleNfcTap}
              disabled={isNfcListening}
              className="shrink-0 bg-teal-600 hover:bg-teal-700 text-white rounded-full px-5 h-10 shadow-md shadow-teal-500/20"
            >
              {isNfcListening ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                  Ready
                </>
              ) : (
                <>
                  <Nfc className="w-4 h-4 mr-1.5" />
                  Tap NFC
                </>
              )}
            </Button>
          </div>
          {nfcError && (
            <div className="p-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-lg text-[10px] text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{nfcError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment confirmation modal */}
      <USDCPaymentModal isOpen={showPaymentModal} onClose={handlePaymentClose} paymentRequest={paymentRequest} />
    </>
  );
};

export default PaymentTrigger;
