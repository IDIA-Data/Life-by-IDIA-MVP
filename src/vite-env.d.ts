/// <reference types="vite/client" />

interface Window {
  webkit?: {
    messageHandlers?: Record<string, { postMessage: (message: any) => void } | undefined>;
  };
  // IDIA Native Callbacks from the Swift Shell
  onNfcHandshakeComplete?: (payload: string | Record<string, unknown>) => void;
  onNfcHandshakeError?: (error: string) => void;
  onHealthSyncComplete?: (payload: any) => void;
  // Push token stashed by Swift if it arrives before JS attaches a listener
  __idiaPendingPushToken?: string;
}
