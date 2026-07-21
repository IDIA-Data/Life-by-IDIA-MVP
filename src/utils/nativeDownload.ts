// Save a file to the device. The IDIA iOS shell is a raw WKWebView (not the
// Capacitor runtime), so we hand the file directly to Swift via the custom
// `nativeDownload` WebKit message handler. Swift writes the payload to the
// temp directory and presents UIActivityViewController ("Save to Files",
// AirDrop, Mail, etc.) without navigating away from the React app.
//
// On web/desktop browsers (no WebKit bridge), we fall back to the standard
// hidden `<a download>` anchor. Instrumented with granular flow logs so any
// silent handoff stall is visible in the console.

interface DownloadOptions {
  filename: string;
  data: string | Blob;
  mimeType: string;
}

export const saveFileToDevice = async ({
  filename,
  data,
  mimeType,
}: DownloadOptions): Promise<void> => {
  console.log(`📥 [DOWNLOAD_FLOW_LOG] START: Initiating native handoff for [${filename}]`);

  try {
    const nativeHandler = window.webkit?.messageHandlers?.nativeDownload;

    if (nativeHandler) {
      console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: IDIA native shell detected. Encoding payload to Base64.`);

      let base64Data: string;
      if (typeof data === "string") {
        base64Data = btoa(unescape(encodeURIComponent(data)));
        console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: String -> Base64 conversion complete.`);
      } else {
        base64Data = await new Promise<string>((resolve, reject) => {
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
      }

      console.log(`📥 [DOWNLOAD_FLOW_LOG] PROCESS: Dispatching Base64 payload to Swift bridge.`);
      nativeHandler.postMessage({ filename, base64Data, mimeType });
      console.log(`📥 [DOWNLOAD_FLOW_LOG] SUCCESS: Payload handed off to iOS UIActivityViewController.`);
      return;
    }

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
  } catch (error) {
    console.error(`🚨 [DOWNLOAD_FLOW_LOG] ERROR: Critical failure during saveFileToDevice execution:`, error);
    throw error;
  } finally {
    console.log(`📥 [DOWNLOAD_FLOW_LOG] END: saveFileToDevice execution concluded.`);
  }
};
