/**
 * team-recovery
 *
 * One-time recovery function to return stuck IDIA tokens
 * from the relayer wallet back to the Team Escrow.
 *
 * Deploy: supabase functions deploy team-recovery --no-verify-jwt
 *
 * Invoke:
 *   curl -X POST .../functions/v1/team-recovery \
 *     -H "Content-Type: application/json" \
 *     -d '{"amount": "90000000", "recipient": "0xF0E67683783ef5879b43ef99ab04Bc27A9a71074"}'
 *
 * After recovery is confirmed, you can delete this function.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
} from "https://esm.sh/viem@2.9.20";

const RELAYER_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!;
const IDIA_TOKEN = "0x6526F939D257E67896821c25B6C24Daa404a01FB";
const RPC_URL = Deno.env.get("ALCHEMY_BASE_RPC_URL") || Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const IDIA_ABI = [{
  name: "transfer", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "to", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
}] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { amount, recipient } = await req.json();

    if (!amount || !recipient) {
      return new Response(
        JSON.stringify({ error: "Provide amount (whole tokens) and recipient address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const formattedKey = RELAYER_KEY.trim().startsWith("0x")
      ? RELAYER_KEY.trim()
      : `0x${RELAYER_KEY.trim()}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

    const amountWei = parseUnits(amount, 18);

    console.info(`[recovery] Transferring ${amount} IDIA from relayer ${account.address} to ${recipient}`);

    const hash = await walletClient.writeContract({
      address: IDIA_TOKEN as `0x${string}`,
      abi: IDIA_ABI,
      functionName: "transfer",
      args: [recipient as `0x${string}`, amountWei],
    });

    console.info(`[recovery] TX: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

    return new Response(
      JSON.stringify({
        status: receipt.status,
        txHash: hash,
        amount,
        from: account.address,
        to: recipient,
        blockNumber: Number(receipt.blockNumber),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error(`[recovery] Error: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});