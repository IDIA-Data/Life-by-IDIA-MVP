import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Smartphone, 
  Wifi, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Zap,
  Shield
} from 'lucide-react';

interface NFCPayrollModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const NFCPayrollModal: React.FC<NFCPayrollModalProps> = ({ isOpen, onClose }) => {
  const [connectionStep, setConnectionStep] = useState<'syncing' | 'connecting' | 'connected' | 'error'>('syncing');
  const [peerToken, setPeerToken] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    console.log("📱 [NFC_MODAL_LOG] START: Initializing live hardware NFC Syncing sequence");
    setConnectionStep('syncing');
    setPeerToken(null);
    setErrorMessage(null);

    // 1. Define global callbacks for the Swift Native Bridge to hit
    (window as any).onNfcHandshakeComplete = (token: string) => {
      console.log(`📱 [NFC_MODAL_LOG] SUCCESS: Hardware returned peer token: ${token}`);
      setPeerToken(token);
      setConnectionStep('connected');
    };

    (window as any).onNfcHandshakeError = (error: string) => {
      console.error(`🚨 [NFC_MODAL_ERROR] Hardware reported Syncing failure: ${error}`);
      setErrorMessage(error);
      setConnectionStep('error');
    };

    // 2. Trigger the Native Swift Bridge
    console.log("📱 [NFC_MODAL_LOG] ACTION: Firing initiateNfcHandshake across IPC bridge");
    try {
      const payload = { handshake_token: "IDIA_PAYROLL_SYNC_REQUEST" };
      
      // Target the specific WKScriptMessageHandler we built in ContentView.swift
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.initiateNfcHandshake) {
         window.webkit.messageHandlers.initiateNfcHandshake.postMessage(payload);
      } else {
         // Fallback for standard postMessage interception
         window.postMessage({ type: 'initiateNfcHandshake', ...payload }, '*');
      }
    } catch (err: any) {
      console.error("🚨 [NFC_MODAL_ERROR] IPC Bridge failure:", err);
      setErrorMessage(err.message || "Failed to trigger hardware bridge");
      setConnectionStep('error');
    }

    // 3. Cleanup global listeners when modal closes to prevent memory leaks
    return () => {
      console.log("🧹 [NFC_MODAL_LOG] END: Cleaning up global NFC listeners");
      delete (window as any).onNfcHandshakeComplete;
      delete (window as any).onNfcHandshakeError;
    };
  }, [isOpen]);

  const handleRetry = () => {
    // Re-triggering the useEffect logic by resetting the state
    setConnectionStep('syncing');
    setErrorMessage(null);
    
    console.log("📱 [NFC_MODAL_LOG] ACTION: Retrying NFC Handshake");
    try {
      const payload = { handshake_token: "IDIA_PAYROLL_SYNC_REQUEST_RETRY" };
      if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.initiateNfcHandshake) {
         window.webkit.messageHandlers.initiateNfcHandshake.postMessage(payload);
      } else {
         window.postMessage({ type: 'initiateNfcHandshake', ...payload }, '*');
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to trigger hardware bridge");
      setConnectionStep('error');
    }
  };

  const getStepContent = () => {
    switch (connectionStep) {
      case 'syncing':
        return (
          <div className="text-center space-y-6">
            <div className="relative mx-auto w-32 h-32">
              <div className="absolute inset-0 border-4 border-primary border-dashed rounded-full animate-pulse"></div>
              <div className="absolute inset-4 bg-primary/10 rounded-full flex items-center justify-center">
                <Smartphone className="w-12 h-12 text-primary animate-bounce" />
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Syncing with IDIA Pay</h3>
              <p className="text-muted-foreground">
                Hold your device near the IDIA POS terminal or peer device
              </p>
              <Badge variant="outline" className="animate-pulse">
                Hardware Active...
              </Badge>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Wifi className="w-5 h-5 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">Hardware Instructions:</p>
                  <ul className="mt-1 space-y-1 text-xs text-left">
                    <li>• Keep devices within 4cm of each other</li>
                    <li>• Wait for the native iOS haptic confirmation</li>
                    <li>• Do not pull away until the Connection is verified</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        );

      case 'connected':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-32 h-32 relative">
              <div className="absolute inset-0 border-4 border-green-500 rounded-full"></div>
              <div className="absolute inset-4 bg-green-50 rounded-full flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-green-600" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-green-700">Connection Established!</h3>
                <p className="text-muted-foreground">
                  Cryptographic handshake complete.
                </p>
              </div>

              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-green-800">Connection Details</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      <Shield className="w-3 h-3 mr-1" />
                      Encrypted
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm text-green-700">
                    <div className="flex justify-between">
                      <span>Peer Token:</span>
                      <span className="font-mono">{peerToken ? `${peerToken.substring(0, 8)}...` : 'Verified'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Protocol:</span>
                      <span>IDIA NFC Secure</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className="flex items-center">
                        <Zap className="w-3 h-3 mr-1" />
                        Active
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="flex space-x-3">
                <Button onClick={onClose} className="flex-1">
                  Process Payroll
                </Button>
              </div>
            </div>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-6">
            <div className="mx-auto w-32 h-32 relative">
              <div className="absolute inset-0 border-4 border-red-500 rounded-full"></div>
              <div className="absolute inset-4 bg-red-50 rounded-full flex items-center justify-center">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-red-700">Syncing Failed</h3>
                <p className="text-muted-foreground">
                  Hardware handshake interrupted or denied.
                </p>
                {errorMessage && (
                   <p className="text-xs text-red-500 mt-2 font-mono bg-red-50 p-2 rounded border border-red-100">
                     {errorMessage}
                   </p>
                )}
              </div>

              <div className="flex space-x-3">
                <Button onClick={handleRetry} className="flex-1">
                  Retry Handshake
                </Button>
                <Button variant="outline" onClick={onClose}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Smartphone className="w-5 h-5" />
            <span>NFC Payroll Protocol</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-6">
          {getStepContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NFCPayrollModal;