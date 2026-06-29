/**
 * relay-delegation
 *
 * Gasless ERC20Votes self-delegation via EIP-712 `delegateBySig`.
 * The client signs the typed-data offline; this function submits the
 * tx through the shared relayer wallet and pays gas on the user's behalf.
 *
 * Records an ACA (Auditable Consent Artifact) for full DELT provenance.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6.13.0";

const IDIA_DELEGATE_ABI = [
  "function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)",
  "function delegates(address) view returns (address)",
];

// Mirror of src/config/contracts.ts mainnet/testnet addresses
const NETWORKS: Record<string, { chainId: number; rpcFallback: string; idiaToken: string; name: string }> = {
  mainnet: {
    chainId: 8453,
    rpcFallback: "https://mainnet.base.org",
    idiaToken: "0x6526F939D257E67896821c25B6C24Daa404a01FB",
    name: "Base",
  },
  testnet: {
    chainId: 84532,
    rpcFallback: "https://sepolia.base.org",
    idiaToken: "0x18306e920946FA7e42990C5D6F9402750407bF4B",
    name: "Base Sepolia",
  },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let stage = "INIT";

  try {
    stage = "AUTH";
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) return jsonResponse({ error: "Unauthorized" }, 401);
    const userId = userData.user.id;

    stage = "PARSE";
    const body = await req.json();
    const { delegatee, nonce, expiry, v, r, s } = body;

    stage = "VALIDATE";
    if (!ethers.isAddress(delegatee)) return jsonResponse({ error: "Invalid delegatee" }, 400);
    if (typeof nonce !== "number" && typeof nonce !== "string") return jsonResponse({ error: "Invalid nonce" }, 400);
    if (typeof expiry !== "number") return jsonResponse({ error: "Invalid expiry" }, 400);
    if (expiry <= Math.floor(Date.now() / 1000)) return jsonResponse({ error: "Signature expired" }, 400);
    if (typeof v !== "number" || typeof r !== "string" || typeof s !== "string") {
      return jsonResponse({ error: "Invalid signature" }, 400);
    }

    stage = "PROFILE";
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("wallet_address")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.wallet_address) return jsonResponse({ error: "No sovereign wallet on profile" }, 400);
    if ((profile.wallet_address as string).toLowerCase() !== (delegatee as string).toLowerCase()) {
      // For self-delegation flow, delegatee must match caller's wallet
      return jsonResponse({ error: "Delegatee must equal caller wallet for self-delegation" }, 400);
    }

    stage = "NETWORK";
    const env = (Deno.env.get("ACTIVE_DEPLOYMENT") || "mainnet").toLowerCase();
    const network = NETWORKS[env] || NETWORKS.mainnet;
    const rpcUrl = Deno.env.get("ALCHEMY_BASE_RPC_URL") || network.rpcFallback;

    stage = "WALLET";
    const relayerKey = Deno.env.get("RELAYER_PRIVATE_KEY");
    if (!relayerKey) return jsonResponse({ error: "Relay not configured" }, 500);

    const provider = new ethers.JsonRpcProvider(rpcUrl, network.chainId);
    const relayer = new ethers.Wallet(relayerKey, provider);

    const relayerBalance = await provider.getBalance(relayer.address);
    if (relayerBalance === 0n) return jsonResponse({ error: "Relay wallet has no gas funds" }, 500);

    stage = "SUBMIT";
    const idia = new ethers.Contract(network.idiaToken, IDIA_DELEGATE_ABI, relayer);
    console.log(`[relay-delegation] delegatee=${delegatee} nonce=${nonce} expiry=${expiry}`);
    const tx = await idia.delegateBySig(delegatee, nonce, expiry, v, r, s);
    console.log(`[relay-delegation] tx submitted ${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[relay-delegation] confirmed block ${receipt.blockNumber}`);

    stage = "ACA";
    // Generate ACA hash for delegation event
    const acaPayload = {
      consent_scope: ["GOVERNANCE_DELEGATE", "LEDGER_WRITE"],
      timestamp: new Date().toISOString(),
      action: "self_delegate",
      delegatee,
      tx_hash: tx.hash,
      chain_id: network.chainId,
    };
    const encoder = new TextEncoder();
    const buf = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`${userId}:self_delegate:${tx.hash}:${expiry}`),
    );
    const acaHash =
      "0x" +
      Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

    try {
      await supabaseAdmin.from("user_aca_records").insert({
        platform_guid: userId,
        aca_hash_key: acaHash,
        source_id: "governance_self_delegate",
        consent_type: "GOVERNANCE_DELEGATE",
        consent_scope: acaPayload.consent_scope,
        created_at: acaPayload.timestamp,
        tx_hash: tx.hash,
      });
    } catch (acaErr: any) {
      console.error(`[relay-delegation] ACA insert failed (non-fatal): ${acaErr.message}`);
    }

    return jsonResponse({
      success: true,
      tx_hash: tx.hash,
      block_number: receipt.blockNumber,
      aca_hash: acaHash,
      delegatee,
      network: network.name,
    });
  } catch (err: any) {
    console.error(`[relay-delegation] FAILED at ${stage}: ${err.message}`);
    let userError = err.message || "Delegation relay failed";
    if (err.message?.includes("insufficient funds")) userError = "Treasury wallet has insufficient ETH for gas.";
    else if (err.message?.includes("invalid signature") || err.message?.includes("ECDSA")) userError = "Signature verification failed.";
    else if (err.message?.includes("expired")) userError = "Signature expired — please retry.";
    return jsonResponse({ error: userError, failed_at: stage }, 500);
  }
});
