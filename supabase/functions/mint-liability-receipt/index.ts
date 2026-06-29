/**
 * mint-liability-receipt
 *
 * Mints soulbound Liability Receipt NFTs to data owners whose data
 * was included in a sale. Triggered by polling egress_logs for
 * unminted entries, or called directly by synapse-controller.
 *
 * Flow:
 *   1. Query egress_logs for entries where nft_minted = false
 *   2. For each egress entry:
 *      a. Resolve ACA hashes → data owners via user_aca_records
 *      b. For each owner: get wallet from profiles.wallet_address
 *      c. Call IDIALiabilityReceipt.mintReceipt() on-chain
 *      d. Mark egress_logs.nft_minted = true
 *
 * Each data owner receives their own NFT containing ONLY the ACA
 * hashes that belong to them (not the full sale's hashes).
 *
 * Deploy:  supabase functions deploy mint-liability-receipt --no-verify-jwt
 * Schedule: pg_cron every 60 seconds
 *
 *   SELECT cron.schedule('mint-liability-receipt', '* * * * *', $$
 *     SELECT net.http_post(
 *       url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/mint-liability-receipt',
 *       headers := '{"Content-Type": "application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     );
 *   $$);
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or IDIA_SECRET_KEY)
 *   RELAYER_PRIVATE_KEY
 *   LIABILITY_RECEIPT_ADDRESS (deployed IDIALiabilityReceipt contract)
 *   BASE_RPC_URL (optional)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";
import {
  createWalletClient,
  createPublicClient,
  http,
  toHex,
  keccak256,
  toBytes,
  pad,
} from "https://esm.sh/viem@2.9.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("IDIA_SECRET_KEY") ?? "";
const RELAYER_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!;
const RECEIPT_CONTRACT = Deno.env.get("LIABILITY_RECEIPT_ADDRESS") || "";
const RPC_URL = Deno.env.get("ALCHEMY_BASE_RPC_URL") || Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const MAX_MINTS_PER_RUN = 10; // Stay within edge function timeout
const DELAY_BETWEEN_MINTS_MS = 2000;

const RECEIPT_ABI = [
  {
    name: "mintReceipt",
    type: "function",
    stateMutability: "nonpayable",
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

/**
 * Convert a string (ACA hash key or hex string) to a bytes32 value.
 * If already 0x-prefixed hex of correct length, pass through.
 * Otherwise hash via keccak256.
 */
function toBytes32(value: string): `0x${string}` {
  if (value.startsWith("0x") && value.length === 66) {
    return value as `0x${string}`;
  }
  return keccak256(toBytes(value));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!RECEIPT_CONTRACT) {
      return new Response(
        JSON.stringify({ error: "LIABILITY_RECEIPT_ADDRESS not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Set up blockchain clients
    const formattedKey = RELAYER_KEY.trim().startsWith("0x")
      ? RELAYER_KEY.trim()
      : `0x${RELAYER_KEY.trim()}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

    // ── Find unminted egress entries ────────────────────────
    // egress_logs entries where nft_minted is null or false
    const { data: pendingEgress, error: queryErr } = await supabase
      .from("egress_logs")
      .select("id, user_id, client_id, aca_record_references, liability_token_hash, digiramp_anchor_id, metadata, settled_at")
      .or("nft_minted.is.null,nft_minted.eq.false")
      .not("settled_at", "is", null)
      .order("settled_at", { ascending: true })
      .limit(MAX_MINTS_PER_RUN);

    if (queryErr) throw new Error(`Query failed: ${queryErr.message}`);
    if (!pendingEgress || pendingEgress.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending mints", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.info(`[mint-receipt] Found ${pendingEgress.length} unminted egress entries`);

    let minted = 0;
    let skipped = 0;
    let failed = 0;

    for (const egress of pendingEgress) {
      const acaRecordIds: string[] = egress.aca_record_references || [];
      if (acaRecordIds.length === 0) {
        console.warn(`[mint-receipt] Egress ${egress.id} has no ACA records — skipping`);
        await supabase.from("egress_logs").update({ nft_minted: true, nft_mint_note: "no_aca_records" }).eq("id", egress.id);
        skipped++;
        continue;
      }

      // ── Resolve data owners from ACA records ──────────────
      // Query user_aca_records to find which users own which ACAs
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const validUuids = acaRecordIds.filter((id: string) => uuidRegex.test(id));
      const stringHashes = acaRecordIds.filter((id: string) => !uuidRegex.test(id));

      let ownerRecords: any[] = [];
      if (validUuids.length > 0) {
        const { data } = await supabase
          .from("user_aca_records")
          .select("id, platform_guid, aca_hash_key")
          .in("id", validUuids);
        if (data) ownerRecords.push(...data);
      }
      if (stringHashes.length > 0) {
        const { data } = await supabase
          .from("user_aca_records")
          .select("id, platform_guid, aca_hash_key")
          .in("aca_hash_key", stringHashes);
        if (data) ownerRecords.push(...data);
      }

      if (ownerRecords.length === 0) {
        console.warn(`[mint-receipt] No owner records found for egress ${egress.id} — skipping`);
        await supabase.from("egress_logs").update({ nft_minted: true, nft_mint_note: "no_owners_resolved" }).eq("id", egress.id);
        skipped++;
        continue;
      }

      // Group ACA hashes by owner (platform_guid)
      const ownerToAcas: Record<string, string[]> = {};
      for (const rec of ownerRecords) {
        const guid = rec.platform_guid;
        if (!ownerToAcas[guid]) ownerToAcas[guid] = [];
        ownerToAcas[guid].push(rec.aca_hash_key || rec.id);
      }

      const uniqueOwners = Object.keys(ownerToAcas);
      console.info(`[mint-receipt] Egress ${egress.id}: ${uniqueOwners.length} owners, ${ownerRecords.length} ACAs`);

      // ── Mint one receipt per data owner ────────────────────
      let allMinted = true;
      for (const ownerGuid of uniqueOwners) {
        // Get owner's wallet address
        const { data: profile } = await supabase
          .from("profiles")
          .select("wallet_address")
          .eq("platform_guid", ownerGuid)
          .single();

        if (!profile?.wallet_address) {
          console.warn(`[mint-receipt] Owner ${ownerGuid} has no wallet — recording pending`);
          // Record for later minting when wallet is added
          await supabase.from("pending_nft_mints").insert({
            egress_id: egress.id,
            owner_guid: ownerGuid,
            aca_hashes: ownerToAcas[ownerGuid],
            buyer_id: egress.user_id,
            liability_token_hash: egress.liability_token_hash,
            bundle_ref: egress.metadata?.bundle_id || "unknown",
            status: "pending_wallet",
          }).then(({ error }) => {
            if (error) console.error(`[mint-receipt] Failed to record pending mint: ${error.message}`);
          });
          continue;
        }

        // Build contract call parameters
        const ownerAcas = ownerToAcas[ownerGuid];
        const acaBytes32 = ownerAcas.map(toBytes32);

        // Generate unique synapseReceiptId per owner per sale
        const receiptIdRaw = keccak256(
          toBytes(`${egress.liability_token_hash}|${ownerGuid}`),
        );

        // Purchase amount in USDC (from metadata or 0)
        const purchaseAmount = BigInt(0); // Actual USDC amount tracked in settlement, not here

        const bundleRef = egress.metadata?.bundle_id || egress.metadata?.bundle_title || "direct";

        try {
          const hash = await walletClient.writeContract({
            address: RECEIPT_CONTRACT as `0x${string}`,
            abi: RECEIPT_ABI,
            functionName: "mintReceipt",
            args: [
              profile.wallet_address as `0x${string}`,
              acaBytes32,
              purchaseAmount,
              receiptIdRaw,
              bundleRef,
            ],
          });

          console.info(`[mint-receipt] TX sent for owner ${ownerGuid}: ${hash}`);

          const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
          if (receipt.status === "success") {
            console.info(`[mint-receipt] Minted to ${profile.wallet_address} at block ${receipt.blockNumber}`);
            minted++;
          } else {
            console.error(`[mint-receipt] TX reverted for ${ownerGuid}: ${hash}`);
            allMinted = false;
            failed++;
          }

          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MINTS_MS));
        } catch (mintErr: any) {
          if (mintErr.message?.includes("Receipt already minted")) {
            console.info(`[mint-receipt] Already minted for ${ownerGuid} — skipping`);
          } else {
            console.error(`[mint-receipt] Mint failed for ${ownerGuid}: ${mintErr.message}`);
            allMinted = false;
            failed++;
          }
        }
      }

      // Mark egress as minted (even if some owners were pending_wallet)
      await supabase.from("egress_logs").update({
        nft_minted: allMinted,
        nft_mint_note: allMinted ? "all_minted" : "partial_pending_wallet",
      }).eq("id", egress.id);
    }

    const result = { processed: pendingEgress.length, minted, skipped, failed };
    console.info(`[mint-receipt] Complete:`, result);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[mint-receipt] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
