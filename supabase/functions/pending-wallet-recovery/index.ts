/**
 * pending-wallet-recovery
 *
 * Recovers two types of pending operations for users who add a wallet
 * address after the operation was originally attempted:
 *
 *   1. USDC payouts (from idia-circular-settlement)
 *      → synapse_credit_ledger entries with status = 'pending_wallet'
 *      → Executes the USDC transfer and updates status to 'completed'
 *
 *   2. NFT mints (from mint-liability-receipt)
 *      → pending_nft_mints entries with status = 'pending_wallet'
 *      → Mints the Liability Receipt NFT and updates status to 'minted'
 *
 * Trigger options (use ONE):
 *   A. pg_cron every 5 minutes (recommended — simple, reliable)
 *   B. Supabase database webhook on profiles.wallet_address update
 *   C. Manual invocation after a user adds their wallet
 */
 // pg_cron setup:
 //   SELECT cron.schedule('pending-wallet-recovery', '*/5 * * * *', $$
 //     SELECT net.http_post(
 //       url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/pending-wallet-recovery',
 //      headers := '{"Content-Type": "application/json"}'::jsonb,
 //      body := '{}'::jsonb
 //     );
 //   $$);
 
//  Requires env vars:/
//    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or IDIA_SECRET_KEY)
//    RELAYER_PRIVATE_KEY
//    LIABILITY_RECEIPT_ADDRESS
//    BASE_RPC_URL (optional)
 

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
  keccak256,
  toBytes,
} from "https://esm.sh/viem@2.9.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("IDIA_SECRET_KEY") ?? "";
const RELAYER_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!;
const RECEIPT_CONTRACT = Deno.env.get("LIABILITY_RECEIPT_ADDRESS") || "";
const RPC_URL = Deno.env.get("ALCHEMY_BASE_RPC_URL") || Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const USDC_ABI = [
  {
    name: "transfer", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "to", type: "address" }, { name: "value", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const RECEIPT_ABI = [
  {
    name: "mintReceipt", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "dataBuyer", type: "address" },
      { name: "acaHashes", type: "bytes32[]" },
      { name: "purchaseAmount", type: "uint256" },
      { name: "synapseReceiptId", type: "bytes32" },
      { name: "dataBundleRef", type: "string" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function toBytes32(value: string): `0x${string}` {
  if (value.startsWith("0x") && value.length === 66) return value as `0x${string}`;
  return keccak256(toBytes(value));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const formattedKey = RELAYER_KEY.trim().startsWith("0x") ? RELAYER_KEY.trim() : `0x${RELAYER_KEY.trim()}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

    let usdcRecovered = 0;
    let nftsRecovered = 0;

    // ═══════════════════════════════════════════════════════
    // PART 1: Recover pending USDC payouts
    // ═══════════════════════════════════════════════════════

    const { data: pendingPayouts } = await supabase
      .from("synapse_credit_ledger")
      .select("id, user_id, amount, description")
      .eq("status", "pending_wallet")
      .eq("transaction_type", "DATA_SALE_PAYOUT")
      .limit(20);

    if (pendingPayouts && pendingPayouts.length > 0) {
      console.info(`[recovery] Found ${pendingPayouts.length} pending USDC payouts`);

      for (const payout of pendingPayouts) {
        // Check if user now has a wallet
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("id", payout.user_id)
          .single();

        if (!profile?.wallet_address) continue; // Still no wallet

        console.info(`[recovery] User ${payout.user_id} now has wallet ${profile.wallet_address} — sending ${payout.amount} USDC`);

        try {
          const hash = await walletClient.writeContract({
            address: USDC_ADDRESS as `0x${string}`,
            abi: USDC_ABI,
            functionName: "transfer",
            args: [
              profile.wallet_address as `0x${string}`,
              parseUnits(Math.abs(payout.amount).toFixed(6), 6),
            ],
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

          if (receipt.status === "success") {
            await supabase.from("synapse_credit_ledger").update({
              status: "completed",
              blockchain_tx_hash: hash,
              is_settled: true,
              settled_at: new Date().toISOString(),
              description: payout.description + ` [recovered: wallet added]`,
            }).eq("id", payout.id);

            usdcRecovered++;
            console.info(`[recovery] USDC payout completed: ${hash}`);
          }

          await new Promise((r) => setTimeout(r, 1000));
        } catch (err: any) {
          console.error(`[recovery] USDC transfer failed for ${payout.user_id}: ${err.message}`);
        }
      }
    }

    // ═══════════════════════════════════════════════════════
    // PART 2: Recover pending NFT mints
    // ═══════════════════════════════════════════════════════

    if (RECEIPT_CONTRACT) {
      const { data: pendingMints } = await supabase
        .from("pending_nft_mints")
        .select("id, egress_id, owner_guid, aca_hashes, buyer_id, liability_token_hash, bundle_ref")
        .eq("status", "pending_wallet")
        .limit(20);

      if (pendingMints && pendingMints.length > 0) {
        console.info(`[recovery] Found ${pendingMints.length} pending NFT mints`);

        for (const mint of pendingMints) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("wallet_address")
            .eq("platform_guid", mint.owner_guid)
            .single();

          if (!profile?.wallet_address) continue;

          console.info(`[recovery] Owner ${mint.owner_guid} now has wallet — minting receipt`);

          try {
            const acaBytes32 = (mint.aca_hashes || []).map(toBytes32);
            const receiptId = keccak256(toBytes(`${mint.liability_token_hash}|${mint.owner_guid}`));

            const hash = await walletClient.writeContract({
              address: RECEIPT_CONTRACT as `0x${string}`,
              abi: RECEIPT_ABI,
              functionName: "mintReceipt",
              args: [
                profile.wallet_address as `0x${string}`,
                acaBytes32,
                BigInt(0),
                receiptId,
                mint.bundle_ref || "recovered",
              ],
            });

            const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

            if (receipt.status === "success") {
              await supabase.from("pending_nft_mints").update({
                status: "minted",
                tx_hash: hash,
                minted_at: new Date().toISOString(),
              }).eq("id", mint.id);

              nftsRecovered++;
              console.info(`[recovery] NFT minted: ${hash}`);
            }

            await new Promise((r) => setTimeout(r, 2000));
          } catch (err: any) {
            if (err.message?.includes("Receipt already minted")) {
              await supabase.from("pending_nft_mints").update({ status: "already_minted" }).eq("id", mint.id);
            } else {
              console.error(`[recovery] Mint failed for ${mint.owner_guid}: ${err.message}`);
            }
          }
        }
      }
    }

    const result = { usdcRecovered, nftsRecovered };
    console.info(`[recovery] Complete:`, result);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[recovery] Fatal: ${err.message}`);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
