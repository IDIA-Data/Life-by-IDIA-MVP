import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.7";
import { privateKeyToAccount } from "npm:viem@2.9.20/accounts";
import { base, baseSepolia } from "npm:viem@2.9.20/chains";
import {
  createWalletClient,
  http,
  parseUnits,
  publicActions,
  type Hash,
} from "npm:viem@2.9.20";

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const IS_MAINNET = (Deno.env.get("BASE_RPC_URL") || "").includes("mainnet");
const CHAIN = IS_MAINNET ? base : baseSepolia;
const RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://sepolia.base.org";

// Maximum distributions per invocation (prevent runaway gas spend)
const MAX_BATCH_SIZE = 20;

// Delay between on-chain transactions (ms) to ease sequencer pressure
const TX_DELAY_MS = 2000;

// ══════════════════════════════════════════════════════════════
// ESCROW CONTRACT MAPPING
//
// Maps funding_typecode → escrow contract address.
// Read from Supabase secrets first, fall back to hardcoded defaults.
// The dim_funding_type table is the source of truth; these are
// backup values in case the DB join fails.
// ══════════════════════════════════════════════════════════════

function getEscrowAddress(fundingTypecode: number): string {
  const mapping: Record<number, { envKey: string; fallback: string }> = {
    1: { envKey: "ESCROW_TEAM",      fallback: "0xF0E67683783ef5879b43ef99ab04Bc27A9a71074" },
    2: { envKey: "ESCROW_ECOSYSTEM", fallback: "0xd052C6F3846b4Fe56E579880Ec9ea2764ABDe708" },
    3: { envKey: "ESCROW_PUBLIC",    fallback: "0xAE51E24674d9665febC188a8f82a4bB647BF014c" },
    4: { envKey: "ESCROW_LIQUIDITY", fallback: "0xdC93412182b2fBf68b4282255d772d6Cd01fE8A1" },
    5: { envKey: "ESCROW_INVESTORS", fallback: "0xDc93eca954fD2625001b2fb9E9A098914365ADe9" },
  };

  const entry = mapping[fundingTypecode];
  if (!entry) throw new Error(`Unknown funding_typecode: ${fundingTypecode}`);

  return Deno.env.get(entry.envKey) || entry.fallback;
}

// ══════════════════════════════════════════════════════════════
// ABI — only the function we call
// ══════════════════════════════════════════════════════════════

const ESCROW_ABI = [
  {
    name: "automatedDistribute",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "reason", type: "string" },
    ],
    outputs: [{ name: "proposalId", type: "uint256" }],
  },
] as const;

// ══════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let currentStep = "INIT";
  const results: Array<{
    queue_id: number;
    status: string;
    tx_hash?: string;
    proposal_id?: number;
    error?: string;
  }> = [];

  try {
    console.info("[BEGIN: distribution-processor] Starting distribution cycle.");

    // ── Initialize Supabase ────────────────────────────────
    currentStep = "SUPABASE_INIT";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("IDIA_SECRET_KEY");

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Missing SUPABASE_URL or service role key.");
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Initialize blockchain client ───────────────────────
    currentStep = "BLOCKCHAIN_INIT";
    const rawKey = Deno.env.get("RELAYER_PRIVATE_KEY");
    if (!rawKey) {
      throw new Error("RELAYER_PRIVATE_KEY secret is missing.");
    }
    const formattedKey = rawKey.trim().startsWith("0x")
      ? rawKey.trim()
      : `0x${rawKey.trim()}`;

    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const client = createWalletClient({
      account,
      chain: CHAIN,
      transport: http(RPC_URL),
    }).extend(publicActions);

    console.info(
      `[TRACE: ${currentStep}] Relayer: ${account.address} | Chain: ${CHAIN.name}`
    );

    // ── Fetch pending distributions ────────────────────────
    currentStep = "FETCH_PENDING";

    // Acquire a processing lock to prevent duplicate execution
    const lockId = crypto.randomUUID();

    // Claim pending rows (atomic: only unclaimed rows)
    const { data: claimed, error: claimErr } = await supabase
      .schema("distribution")
      .from("queue")
      .update({
        status: "processing",
        lock_id: lockId,
        processing_at: new Date().toISOString(),
      })
      .eq("status", "pending")
      .is("lock_id", null)
      .order("created_at", { ascending: true })
      .limit(MAX_BATCH_SIZE)
      .select("*");

    if (claimErr) {
      throw new Error(`Failed to claim pending rows: ${claimErr.message}`);
    }

    // Also pick up failed rows that haven't exceeded retry limit
    const { data: retries, error: retryErr } = await supabase
      .schema("distribution")
      .from("queue")
      .update({
        status: "processing",
        lock_id: lockId,
        processing_at: new Date().toISOString(),
      })
      .eq("status", "failed")
      .is("lock_id", null)
      .lt("retry_count", 3) // max_retries default
      .order("created_at", { ascending: true })
      .limit(Math.max(0, MAX_BATCH_SIZE - (claimed?.length || 0)))
      .select("*");

    if (retryErr) {
      console.warn(`[WARN] Failed to claim retries: ${retryErr.message}`);
    }

    const pending = [...(claimed || []), ...(retries || [])];

    if (pending.length === 0) {
      console.info("[END: distribution-processor] No pending distributions.");
      return new Response(
        JSON.stringify({
          status: "idle",
          message: "No pending distributions in queue.",
          processed: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(
      `[TRACE: ${currentStep}] Claimed ${pending.length} distributions (${claimed?.length || 0} new, ${retries?.length || 0} retries).`
    );

    // ── Resolve escrow addresses from dim table ────────────
    currentStep = "RESOLVE_ESCROWS";
    const { data: dimTypes } = await supabase
      .schema("initial_funding")
      .from("dim_funding_type")
      .select("funding_typecode, classification, escrowcontractaddress");

    const escrowLookup = new Map<number, string>();
    if (dimTypes) {
      for (const dt of dimTypes) {
        escrowLookup.set(dt.funding_typecode, dt.escrowcontractaddress);
      }
    }

    // ── Get master nonce ───────────────────────────────────
    currentStep = "NONCE_INIT";
    let masterNonce = await client.getTransactionCount({
      address: account.address,
      blockTag: "pending",
    });
    console.info(`[TRACE: ${currentStep}] Starting nonce: ${masterNonce}`);

    // ── Process each distribution ──────────────────────────
    currentStep = "PROCESSING";

    for (const row of pending) {
      const rowStep = `DISTRIBUTE_${row.id}`;
      console.info(
        `[BEGIN: ${rowStep}] Queue #${row.id}: ${row.token_amount} IDIA → ${row.recipient_wallet} (type ${row.funding_typecode})`
      );

      try {
        // Validate wallet address
        if (
          !row.recipient_wallet ||
          !row.recipient_wallet.startsWith("0x") ||
          row.recipient_wallet.length !== 42
        ) {
          throw new Error(
            `Invalid wallet address: ${row.recipient_wallet}`
          );
        }

        // Resolve escrow address: DB first, then env fallback
        const escrowAddr =
          escrowLookup.get(row.funding_typecode) ||
          getEscrowAddress(row.funding_typecode);

        // Convert whole token amount to 18 decimals
        // row.token_amount is stored as whole tokens (e.g., 10000)
        // On-chain needs wei (e.g., 10000 * 10^18)
        const amountWei = parseUnits(String(row.token_amount), 18);

        // Build the reason string for on-chain audit trail
        const reason = row.synapse_receipt_ref
          ? `${row.reason} | Ref: ${row.synapse_receipt_ref} | Queue #${row.id}`
          : `${row.reason} | Queue #${row.id}`;

        console.info(
          `[TRACE: ${rowStep}] Escrow: ${escrowAddr} | Amount: ${row.token_amount} IDIA (${amountWei} wei) | Nonce: ${masterNonce}`
        );

        // Execute automatedDistribute on-chain
        const txHash: Hash = await client.writeContract({
          address: escrowAddr as `0x${string}`,
          abi: ESCROW_ABI,
          functionName: "automatedDistribute",
          args: [
            row.recipient_wallet as `0x${string}`,
            amountWei,
            reason,
          ],
          nonce: masterNonce++,
        });

        console.info(
          `[TRACE: ${rowStep}] TX submitted: ${txHash}. Waiting for receipt...`
        );

        // Wait for confirmation
        const receipt = await client.waitForTransactionReceipt({
          hash: txHash,
        });

        if (receipt.status !== "success") {
          throw new Error(`Transaction reverted. Hash: ${txHash}`);
        }

        // Extract proposalId from the AutomatedDistribution event log
        // The third event emitted is AutomatedDistribution with proposalId as the first indexed topic
        let proposalId: number | null = null;
        for (const log of receipt.logs) {
          if (
            log.address.toLowerCase() === escrowAddr.toLowerCase() &&
            log.topics.length >= 2
          ) {
            // AutomatedDistribution event: topic[1] = proposalId (indexed)
            const possibleId = parseInt(log.topics[1], 16);
            if (!isNaN(possibleId)) {
              proposalId = possibleId;
              break;
            }
          }
        }

        // Update queue row: completed
        await supabase
          .schema("distribution")
          .from("queue")
          .update({
            status: "completed",
            tx_hash: txHash,
            proposal_id: proposalId,
            escrow_address: escrowAddr,
            gas_used: Number(receipt.gasUsed),
            completed_at: new Date().toISOString(),
            error_message: null,
            lock_id: null,
          })
          .eq("id", row.id);

        results.push({
          queue_id: row.id,
          status: "completed",
          tx_hash: txHash,
          proposal_id: proposalId ?? undefined,
        });

        console.info(
          `[END: ${rowStep}] ✓ Completed. TX: ${txHash} | Proposal: ${proposalId}`
        );

        // Delay between transactions
        if (pending.indexOf(row) < pending.length - 1) {
          console.info(
            `[NETWORK] Delaying ${TX_DELAY_MS}ms before next transaction...`
          );
          await new Promise((r) => setTimeout(r, TX_DELAY_MS));
        }
      } catch (txErr: any) {
        console.error(
          `[ERROR: ${rowStep}] Distribution failed: ${txErr.message}`
        );

        // Update queue row: failed
        await supabase
          .schema("distribution")
          .from("queue")
          .update({
            status: "failed",
            error_message: txErr.message.slice(0, 500),
            retry_count: (row.retry_count || 0) + 1,
            lock_id: null,
          })
          .eq("id", row.id);

        results.push({
          queue_id: row.id,
          status: "failed",
          error: txErr.message.slice(0, 200),
        });

        // If the error is a nonce issue, re-fetch nonce
        if (
          txErr.message.includes("nonce") ||
          txErr.message.includes("replacement")
        ) {
          console.warn("[WARN] Nonce collision detected. Re-fetching...");
          masterNonce = await client.getTransactionCount({
            address: account.address,
            blockTag: "pending",
          });
        }
      }
    }

    // ── Summary ────────────────────────────────────────────
    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status === "failed").length;

    console.info(
      `[END: distribution-processor] Cycle complete. ${completed} completed, ${failed} failed out of ${pending.length} processed.`
    );

    return new Response(
      JSON.stringify({
        status: "processed",
        total: pending.length,
        completed,
        failed,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error(`[FATAL: ${currentStep}] ${error.message}`);
    return new Response(
      JSON.stringify({
        error: error.message,
        failed_at: currentStep,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
