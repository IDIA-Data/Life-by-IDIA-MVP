/** * [START] main.tsx: Script Execution Initiated
 * Pure React mounting sequence - Sovereign Native Flow
 */
console.log("[START] main.tsx: Entry Point Reached");

import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// TRACKING SCRIPT DISABLED to prevent 403 network deadlocks:
// import "./utils/AuthEventTracker";

const container = document.getElementById("root");

console.log(`[INFO] DOM Root Search: ${container ? "FOUND" : "MISSING"}`);

if (container) {
  try {
    console.log("[START] React Root Mounting Sequence");
    createRoot(container).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("[SUCCESS] React Root Mounting Sequence complete.");
  } catch (mountError: any) {
    console.error("[START] React Mount Error Handler");
    console.error("[FATAL] React failed to mount to DOM:", mountError.message);
    console.error("[STACK]", mountError.stack);
    console.error("[END] React Mount Error Handler");
  }
} else {
  console.error("[CRITICAL] #root element missing from index.html.");
}

console.log("[END] main.tsx: Script Execution Initiated");