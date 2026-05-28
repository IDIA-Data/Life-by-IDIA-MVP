import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve((req: Request) => {
  const url = new URL(req.url);
  
  // Log everything for debugging
  console.log("[auth-redirect] Full URL:", req.url);
  console.log("[auth-redirect] Search params:", url.search);
  console.log("[auth-redirect] Hash:", url.hash);
  console.log("[auth-redirect] All params:", Object.fromEntries(url.searchParams.entries()));

  // PKCE flow: Supabase sends ?code=xxx
  const code = url.searchParams.get("code");
  if (code) {
    console.log("[auth-redirect] PKCE code found, redirecting to app");
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `idialife://auth-callback?code=${encodeURIComponent(code)}`,
      },
    });
  }

  // Implicit flow fallback: tokens might be in query params
  // (Supabase sometimes sends them this way even without implicit mode)
  const accessToken = url.searchParams.get("access_token");
  const refreshToken = url.searchParams.get("refresh_token");
  if (accessToken && refreshToken) {
    console.log("[auth-redirect] Tokens found in query params, redirecting to app");
    return new Response(null, {
      status: 302,
      headers: {
        "Location": `idialife://auth-callback?access_token=${encodeURIComponent(accessToken)}&refresh_token=${encodeURIComponent(refreshToken)}`,
      },
    });
  }

  // If nothing in query params, tokens might be in the fragment (hash)
  // which the server can't see. Return a debug page showing what arrived.
  console.log("[auth-redirect] No code or tokens in query params");
  
  const debugHtml = `<!DOCTYPE html>
<html><head><title>IDIA Auth Debug</title></head>
<body>
<h3>Auth Redirect Debug</h3>
<p id="info">Checking URL...</p>
<pre id="debug"></pre>
<script>
var d = document.getElementById('debug');
var i = document.getElementById('info');
d.textContent = 'URL: ' + window.location.href + '\\n'
  + 'Hash: ' + window.location.hash + '\\n'
  + 'Search: ' + window.location.search + '\\n';

var hash = window.location.hash.substring(1);
var params = new URLSearchParams(hash);
var at = params.get('access_token');
var rt = params.get('refresh_token');

if (at && rt) {
  i.textContent = 'Tokens found in hash! Redirecting to app...';
  d.textContent += 'access_token: ' + at.substring(0,20) + '...\\n';
  d.textContent += 'refresh_token: ' + rt.substring(0,20) + '...\\n';
  window.location.href = 'idialife://auth-callback#' + hash;
} else {
  i.textContent = 'No tokens found. Copy this debug info.';
  d.textContent += 'No access_token or refresh_token found in hash or query.\\n';
}
</script>
</body></html>`;

  return new Response(debugHtml, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
});