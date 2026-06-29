## Phase 1 — Strava Backend Consolidation

1. **Create new edge function** `supabase/functions/strava-controller/index.ts`
   - Single action-routed handler. Initial action: `get-auth-url` (mirrors existing `strava-auth-url` logic: validates `userId`, reads `STRAVA_CLIENT_ID`, builds OAuth URL).
   - Built so future actions (`oauth-callback`, `webhook`, etc.) can be folded in without breaking callers.
   - CORS headers on every response. `verify_jwt = false` via `supabase/config.toml`.
   - Deploy immediately via `supabase--deploy_edge_functions` before any client change so the first frontend invocation succeeds.
   - Leave `ingest-strava-data`, `strava-oauth-callback`, `strava-webhook-subscription`, and `strava-auth-url` untouched (per spec — `ingest-strava-data` stays separate; the old `strava-auth-url` is left in place for now to avoid breaking anything mid-flight; can be removed in a follow-up once `strava-controller` is verified).

2. **Update `src/components/StravaConnectionModal.tsx`**
   - Replace the `supabase.functions.invoke('strava-auth-url', { body: { userId } })` call with:
     ```ts
     supabase.functions.invoke('strava-controller', {
       body: { action: 'get-auth-url', userId: currentUserId }
     })
     ```
   - No other UI/behavior changes.

## Phase 2 — Unified MetaMask Launch

3. **Refactor `src/components/SendRequestModal.tsx`**
   - Current file already has no Send/Receive tabs, but it does have two buttons (`Launch MetaMask` + `Send USDC`) and an unused `useState` import.
   - Reduce to a single primary CTA button labeled **"Launch MetaMask"**.
   - Remove the `Send USDC` button, the `handleSendUSDC` helper, the `navigator.clipboard.writeText` private-key copy logic, and the unused `ArrowUpRight` / `useState` imports.
   - Replace handler with the exact spec:
     ```ts
     const handleLaunchMetaMask = () => {
       if (window.webkit?.messageHandlers?.launchMetaMask) {
         window.webkit.messageHandlers.launchMetaMask.postMessage({});
         onClose();
       } else {
         toast({ title: "Native Bridge Error", description: "MetaMask not accessible.", variant: "destructive" });
       }
     };
     ```
   - Keep the modal shell, title, ShieldCheck info card; trim copy to reflect single action.

4. **Data/Integrations page reflection**
   - `StravaConnectionModal` already updates `data_connections` via the existing OAuth callback, and the connected-state UI inside the modal still shows "Active Pipeline". No additional changes needed since the connection record schema is unchanged — only the auth-URL endpoint moved. Verify by reading whichever page renders Strava status (DataDashboard / DataSourceModal) and confirm it keys off `data_connections.connection_type = 'strava'` (no code change expected).

## Phase 3 — Cleanup

5. **Ghost modal files** — `SendTransactionModal.tsx`, `TransactionConfirmModal.tsx`, and `RequestPaymentQR.tsx` do **not exist** in the repo (`ls src/components/` confirms). Nothing to delete. Will surface this in the final report rather than fabricate deletions.

6. **Ghost imports check** — `EnhancedWalletDashboard.tsx` only imports `SendRequestModal` (kept). No imports of the three non-existent modals anywhere in `src/`. Will run `rg` one more time post-edit to confirm zero references.

## Technical notes / preflight

- **Strava callback URL**: `ingest-strava-data` is the data-pull function and does not own the OAuth redirect — `strava-oauth-callback` does. Per the user's preflight note, after `strava-controller` is verified we can migrate the redirect URI in Strava's app settings + `strava-auth-url`'s `redirect_uri` to point at `strava-controller?action=oauth-callback`. **This migration is out of scope for this pass** (would break in-flight OAuth sessions); flagging for a follow-up.
- **Swift handler**: `window.webkit.messageHandlers.launchMetaMask` must be registered in the iOS shell (`ContentView.swift` / `IDIAWebView`). Not editable from this project — will call this out in the closing message so the user verifies on the native side.
- No Supabase schema changes. No new secrets needed (`STRAVA_CLIENT_ID` already configured).

## Files touched

- **New**: `supabase/functions/strava-controller/index.ts`
- **Edited**: `src/components/StravaConnectionModal.tsx`, `src/components/SendRequestModal.tsx`
- **Deploy**: `strava-controller` edge function (before client cuts over)
