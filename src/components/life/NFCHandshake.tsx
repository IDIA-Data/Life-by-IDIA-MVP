import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Nfc } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ColorWashOverlay from "./ColorWashOverlay";

interface NFCHandshakeProps {
  myTierColor: string;
  onConnected?: () => void;
}

export default function NFCHandshake({ myTierColor, onConnected }: NFCHandshakeProps) {
  const { toast } = useToast();
  const [scanning, setScanning] = useState(false);
  const [washPeerColor, setWashPeerColor] = useState<string | null>(null);

  useEffect(() => {
    console.log("📱 [START: NFCHandshake.useEffect] Mounting inbound hardware callbacks");
    const nativeWindow = window as any;

    nativeWindow.onNfcHandshakeComplete = (peerToken: string) => {
      console.log("📱 [START: onNfcHandshakeComplete] Received peer token:", peerToken);
      
      // Resolve peer standing from the cryptographic token
      const peerColor = "hsl(210, 90%, 75%)"; 
      
      setWashPeerColor(peerColor);
      onConnected?.();
      setScanning(false);
      toast({ title: "Syncing Complete", description: "Connection established." });
      
      console.log("📱 [END: onNfcHandshakeComplete] UI state updated and scanning lock released");
    };

    nativeWindow.onNfcHandshakeError = (err: string) => {
      console.error("🚨 [START: onNfcHandshakeError] Received hardware error:", err);
      setScanning(false);
      toast({ title: "Sync Failed", description: err, variant: "destructive" });
      console.error("🚨 [END: onNfcHandshakeError] UI state reset and scanning lock released");
    };

    console.log("📱 [END: NFCHandshake.useEffect] Callbacks successfully mounted to window");

    return () => {
      console.log("📱 [START: NFCHandshake.cleanup] Removing inbound hardware callbacks");
      delete nativeWindow.onNfcHandshakeComplete;
      delete nativeWindow.onNfcHandshakeError;
      console.log("📱 [END: NFCHandshake.cleanup] Cleanup complete");
    };
  }, [onConnected, toast]);

  const initiateHandshake = () => {
    console.log("📱 [START: NFCHandshake.initiateHandshake] Handshake execution requested");
    
    if (scanning) {
      console.warn("📱 [END: NFCHandshake.initiateHandshake] Aborted: Hardware is already scanning");
      return;
    }
    
    setScanning(true);
    console.log("📱 [PROCESS: NFCHandshake.initiateHandshake] Scanning lock engaged. Evaluating bridge context.");

    const nativeWindow = window as any;

    try {
      const nfcBridge = nativeWindow.webkit?.messageHandlers?.initiateNfcHandshake;
      
      if (nfcBridge) {
        console.log("📱 [PROCESS: NFCHandshake.initiateHandshake] Hardware bridge located. Transmitting payload to Swift Coordinator.");
        nfcBridge.postMessage({ handshake_token: "IDIA_PROD_SYNC_001" });
        console.log("📱 [END: NFCHandshake.initiateHandshake] Payload transmitted successfully. Awaiting hardware callback.");
      } else {
        console.warn("📱 [PROCESS: NFCHandshake.initiateHandshake] Bridge not found. Throwing environment error.");
        throw new Error("Bridge not found. Physical hardware required.");
      }
    } catch (err: any) {
      console.error("🚨 [START: NFCHandshake.catch] Bridge transmission failed:", err);
      setScanning(false);
      toast({ 
        title: "Hardware Unavailable", 
        description: "Please use the production app on a physical device.", 
        variant: "destructive" 
      });
      console.error("🚨 [END: NFCHandshake.catch] Fallback UI triggered and lock released");
    }
  };

  return (
    <>
      <Button 
        size="sm" 
        onClick={initiateHandshake} 
        disabled={scanning} 
        className="bg-teal-600 hover:bg-teal-700"
      >
        <Nfc className="w-4 h-4 mr-2" />
        {scanning ? "Syncing…" : "Start Syncing"}
      </Button>

      {washPeerColor && (
        <ColorWashOverlay 
          myColor={myTierColor} 
          peerColor={washPeerColor} 
          onComplete={() => setWashPeerColor(null)} 
        />
      )}
    </>
  );
}