/**
 * relay-usdc-transfer (v2 — with ACA tracking)
 *
 * Relays EIP-3009 transferWithAuthorization for gasless USDC payments.
 * Now records ACA (Auditable Consent Artifact) hashes alongside tx hashes
 * for full consent provenance tracking.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6.13.0";

const TRANSFER_WITH_AUTH_ABI = [
  "function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, uint8 v, bytes32 r, bytes32 s) external",
];

const NETWORKS: Record<number, { rpcUrlFallback: string; usdcAddress: string; name: string }> = {
  84532: { rpcUrlFallback: "https://sepolia.base.org", usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", name: "Base Sepolia" },
  8453: { rpcUrlFallback: "https://mainnet.base.org", usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", name: "Base" },
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let stage = "INIT";

  try {
    stage = "PARSE";
    const body = await req.json();
    const { authorization, aca_hash, merchant_id, merchant_name, reference, chainId } = body;

    if (!authorization) return jsonResponse({ error: "Missing authorization" }, 400);

    const { from, to, value, validAfter, validBefore, nonce, v, r, s } = authorization;

    stage = "VALIDATE";
    if (!ethers.isAddress(from) || !ethers.isAddress(to)) return jsonResponse({ error: "Invalid from or to address" }, 400);
    if (!value || BigInt(value) <= 0n) return jsonResponse({ error: "Invalid value" }, 400);
    const now = Math.floor(Date.now() / 1000);
    if (validBefore <= now) return jsonResponse({ error: "Authorization has expired" }, 400);

    stage = "NETWORK";
    const networkChainId = chainId || 84532;
    const network = NETWORKS[networkChainId];
    if (!network) return jsonResponse({ error: `Unsupported chainId: ${networkChainId}` }, 400);

    let rpcUrl: string;
    if (networkChainId === 8453) {
      rpcUrl = Deno.env.get("ALCHEMY_BASE_RPC_URL") || network.rpcUrlFallback;
    } else {
      rpcUrl = network.rpcUrlFallback;
    }

    stage = "WALLET";
    const relayerKey = Deno.env.get("RELAYER_PRIVATE_KEY");
    if (!relayerKey) return jsonResponse({ error: "Relay not configured" }, 500);

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const relayer = new ethers.Wallet(relayerKey, provider);

    const relayerBalance = await provider.getBalance(relayer.address);
    if (relayerBalance === 0n) return jsonResponse({ error: "Relay wallet has no gas funds on this network" }, 500);

    const amountFormatted = ethers.formatUnits(value, 6);
    console.log(`[relay] ${amountFormatted} USDC: ${from} → ${to} on ${network.name}`);
    if (aca_hash) console.log(`[relay] ACA: ${aca_hash.slice(0, 16)}...`);

    stage = "SUBMIT";
    const usdc = new ethers.Contract(network.usdcAddress, TRANSFER_WITH_AUTH_ABI, relayer);
    const tx = await usdc.transferWithAuthorization(from, to, value, validAfter, validBefore, nonce, v, r, s);
    console.log(`[relay] Tx submitted: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`[relay] Confirmed block ${receipt.blockNumber}`);

    stage = "RECORD";
    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Record in usdc_payments with ACA hash
    try {
      await supabaseAdmin.from("usdc_payments").insert({
        sender_address: from.toLowerCase(),
        recipient_address: to.toLowerCase(),
        amount_raw: value,
        amount_usdc: parseFloat(amountFormatted),
        network: network.name,
        chain_id: networkChainId,
        tx_hash: tx.hash,
        block_number: receipt.blockNumber,
        nonce_used: nonce,
        aca_hash: aca_hash || null,
        merchant_id: merchant_id || null,
        merchant_name: merchant_name || null,
        reference: reference || null,
        status: "completed",
        relayed_by: relayer.address.toLowerCase(),
        settled_at: new Date().toISOString(),
      });
    } catch (dbErr: any) {
      console.error(`[relay] usdc_payments insert failed (tx succeeded): ${dbErr.message}`);
    }

    // Also record in Eddie's transactions table
    try {
      const authHeader = req.headers.get("Authorization");
      let userId: string | null = null;
      if (authHeader) {
        const token = authHeader.replace("Bearer ", "");
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        userId = user?.id || null;
      }

      if (userId) {
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          transaction_type: "payment_sent",
          amount: -parseFloat(amountFormatted),
          description: merchant_name ? `USDC Payment to ${merchant_name}` : "USDC Payment",
          metadata: {
            currency: "USDC",
            tx_hash: tx.hash,
            aca_hash: aca_hash || null,
            network: network.name,
            chain_id: networkChainId,
            recipient: to,
            method: "EIP3009_RELAY",
            merchant_id: merchant_id,
            reference: reference,
            relayed_by: relayer.address,
          },
        });
      }
    } catch (txErr: any) {
      console.error(`[relay] transactions insert failed: ${txErr.message}`);
    }

    // Stamp the ACA mirror row with settlement reference. The row itself was
    // INSERTed client-side via acaLedger.ts before relay submission; we only
    // patch tx_hash + consumed_at here. The deleted aca_consent_artifacts
    // table is intentionally NOT touched.
    if (aca_hash) {
      try {
        const { error: acaErr } = await supabaseAdmin
          .from("user_aca_records")
          .update({ tx_hash: tx.hash, consumed_at: new Date().toISOString() })
          .eq("aca_hash_key", aca_hash);
        if (acaErr) throw acaErr;
        console.log(`[relay] ACA ${aca_hash.slice(0, 16)}... stamped (tx + consumed_at)`);
      } catch (acaErr: any) {
        console.error(`[relay] ACA stamp failed (non-fatal): ${acaErr.message}`);
      }
    }

    return jsonResponse({
      success: true,
      tx_hash: tx.hash,
      block_number: receipt.blockNumber,
      aca_hash: aca_hash || null,
      from, to, value,
      amount_usdc: amountFormatted,
      network: network.name,
    });

  } catch (err: any) {
    console.error(`[relay] FAILED at ${stage}: ${err.message}`);

    let userError = err.message || "Relay failed";
    if (err.message?.includes("insufficient funds")) userError = "Treasury wallet has insufficient ETH for gas.";
    else if (err.message?.includes("authorization") && err.message?.includes("used")) userError = "This payment authorization was already used.";
    else if (err.message?.includes("ERC20: transfer amount exceeds balance")) userError = "Insufficient USDC balance.";
    else if (err.message?.includes("caller must be the payee")) userError = "Authorization verification failed.";
    else if (err.message?.includes("not yet valid") || err.message?.includes("expired")) userError = "Payment authorization expired.";

    return jsonResponse({ error: userError, failed_at: stage }, 500);
  }
});
