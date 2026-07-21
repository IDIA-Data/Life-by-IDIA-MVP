// Save a file to the device across all three platforms:
//
//   iOS    — The IDIA iOS shell is a raw WKWebView (not the Capacitor runtime),
//            so we hand the file directly to Swift via the custom
//            `nativeDownload` WebKit message handler. Swift writes the payload
//            to the temp directory and presents UIActivityViewController
//            ("Save to Files", AirDrop, Mail, etc.).
//
//   Android — The Android shell IS the Capacitor runtime. We write the file to
//            the app cache via @capacitor/filesystem, then present the Android
//            share sheet via @capacitor/share (the platform equivalent of
//            UIActivityViewController: "Save to Files", Drive, Gmail, etc.).
//
//   Web    — Standard hidden `<a download>` anchor fallback.
//
// Instrumented with granular flow logs so any silent handoff stall is visible
// in the console.

import { Capacitor } from "@capacitor/core";

interface DownloadOptions {
  filename: string;
  data: string | Blob;
  mimeType: string;
}

/** Convert string or Blob input to a base64 payload (no data: prefix). */
async function toBase64(data: string | Blob): Promise<string> {
  if (typeof data === "string") {
    const b64 = btoa(unescape(encodeURIComponent(data)));
    console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: String -> Base64 conversion complete.`);
    return b64;
  }
  const b64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = (error) => {
      console.error(`🚨 [DOWNLOAD_FLOW_LOG] ERROR: FileReader failed to parse Blob:`, error);
      reject(error);
    };
    reader.readAsDataURL(data);
  });
  console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Blob -> Base64 conversion complete.`);
  return b64;
}

export const saveFileToDevice = async ({
  filename,
  data,
  mimeType,
}: DownloadOptions): Promise<void> => {
  console.log(`📥 [DOWNLOAD_FLOW_LOG] START: Initiating native handoff for [${filename}]`);

  try {
    // ── iOS: raw WKWebView bridge to Swift ─────────────────────────────
    const nativeHandler = (window as any).webkit?.messageHandlers?.nativeDownload;

    if (nativeHandler) {
      console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: IDIA iOS shell detected. Encoding payload to Base64.`);
      const base64Data = await toBase64(data);
      console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Dispatching Base64 payload to Swift bridge.`);
      nativeHandler.postMessage({ filename, base64Data, mimeType });
      console.log(`📥 [DOWNLOAD_FLOW_LOG] SUCCESS: Payload handed off to iOS UIActivityViewController.`);
      return;
    }

    // ── Android: Capacitor Filesystem + Share sheet ────────────────────
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android") {
      console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Android Capacitor shell detected. Writing to cache.`);

      const [{ Filesystem, Directory }, { Share }] = await Promise.all([
        import("@capacitor/filesystem"),
        import("@capacitor/share"),
      ]);

      const base64Data = await toBase64(data);

      const writeResult = await Filesystem.writeFile({
        path: filename,
        data: base64Data,
        directory: Directory.Cache,
      });
      console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: File written to cache at ${writeResult.uri}`);

      await Share.share({
        title: filename,
        url: writeResult.uri,
        dialogTitle: `Save ${filename}`,
      });
      console.log(`📥 [DOWNLOAD_FLOW_LOG] SUCCESS: Payload handed off to Android share sheet.`);
      return;
    }

    // ── Web: hidden anchor fallback ────────────────────────────────────
    console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Web environment detected. Executing standard anchor fallback.`);
    const url =
      typeof data === "string"
        ? `data:${mimeType};charset=utf-8,${encodeURIComponent(data)}`
        : URL.createObjectURL(data);

    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);

    console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Firing hidden anchor click event.`);
    link.click();

    document.body.removeChild(link);
    console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Anchor element cleaned from DOM.`);

    if (typeof data !== "string") {
      setTimeout(() => {
        URL.revokeObjectURL(url);
        console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Revoked ObjectURL to prevent memory leaks.`);
      }, 150);
    }
    console.log(`📥 [DOWNLOAD_FLOW_LOG] SUCCESS: Web fallback download completed.`);
  } catch (error: any) {
    // User cancelling the Android share sheet throws — treat as a no-op, not an error.
    if (error?.message?.includes("Share canceled") || error?.message?.includes("canceled")) {
      console.log(`📥 [DOWNLOAD_FLOW_LOG] INFO: User dismissed share sheet.`);
      return;
    }
    console.error(`🚨 [DOWNLOAD_FLOW_LOG] ERROR: Critical failure during saveFileToDevice execution:`, error);
    throw error;
  } finally {
    console.log(`📥 [DOWNLOAD_FLOW_LOG] END: saveFileToDevice execution concluded.`);
  }
};