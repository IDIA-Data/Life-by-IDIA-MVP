/**
 * funding-round-distribute
 *
 * Executes batched token distribution after the funding round is finalized.
 * Calls IDIAFundingRound.distributeBatch(fromIndex, toIndex) in configurable
 * chunks until all investors are processed.
 *
 * The function is idempotent: re-invoking resumes from the last processed index.
 * Each batch is a separate on-chain transaction. If a batch fails (e.g., gas,
 * AlreadyDistributed), it's logged and the job continues with the next batch.
 *
 * Deploy:  supabase functions deploy funding-round-distribute --no-verify-jwt
 * Invoke:  POST /functions/v1/funding-round-distribute
 *          Body: { "batchSize": 50 }  (optional, defaults to 50)
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RELAYER_PRIVATE_KEY (wallet that is the Safe — or a Safe module/delegate)
 *   FUNDING_ROUND_ADDRESS
 *   BASE_RPC_URL (optional, defaults to public Base RPC)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
} from "https://esm.sh/viem@2.21.0";
import { privateKeyToAccount } from "https://esm.sh/viem@2.21.0/accounts";
import { base } from "https://esm.sh/viem@2.21.0/chains";

// ── Config ──────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RELAYER_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!;
const FUNDING_ROUND = Deno.env.get("FUNDING_ROUND_ADDRESS")!;
const RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const DEFAULT_BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 3000; // Avoid RPC rate limits
const MAX_EXECUTION_MS = 50000; // Exit gracefully before Supabase 60s timeout

// ── ABI (minimal — only functions we call) ──────────────────────

const FUNDING_ROUND_ABI = parseAbi([
  "function distributeBatch(uint256 fromIndex, uint256 toIndex) external",
  "function getInvestorCount() view returns (uint256)",
  "function getContributorCount() view returns (uint256)",
  "function getRemainingDistributions() view returns (uint256)",
  "function distributedCount() view returns (uint256)",
  "function state() view returns (uint8)",
  "function paused() view returns (bool)",
  "error AlreadyDistributed(uint256 index, address investor)",
  "error NotFinalized()",
  "error ContractPaused()",
  "error InvalidRange()",
  "error InsufficientIDIA()",
]);

// ── Helpers ─────────────────────────────────────────────────────

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Main ────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Set up blockchain clients
    const formattedKey = RELAYER_KEY.trim().startsWith("0x")
      ? RELAYER_KEY.trim()
      : `0x${RELAYER_KEY.trim()}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);

    const publicClient = createPublicClient({
      chain: base,
      transport: http(RPC_URL),
    });

    const walletClient = createWalletClient({
      account,
      chain: base,
      transport: http(RPC_URL),
    });

    // ── Pre-flight checks ───────────────────────────────────

    const [contractState, isPaused, investorCount, remaining] = await Promise.all([
      publicClient.readContract({
        address: FUNDING_ROUND as `0x${string}`,
        abi: FUNDING_ROUND_ABI,
        functionName: "state",
      }),
      publicClient.readContract({
        address: FUNDING_ROUND as `0x${string}`,
        abi: FUNDING_ROUND_ABI,
        functionName: "paused",
      }),
      publicClient.readContract({
        address: FUNDING_ROUND as `0x${string}`,
        abi: FUNDING_ROUND_ABI,
        functionName: "getInvestorCount",
      }),
      publicClient.readContract({
        address: FUNDING_ROUND as `0x${string}`,
        abi: FUNDING_ROUND_ABI,
        functionName: "getRemainingDistributions",
      }),
    ]);

    // State 3 = Finalized
    if (Number(contractState) !== 3) {
      return new Response(
        JSON.stringify({ error: "Round not finalized", contractState: Number(contractState) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (isPaused) {
      return new Response(
        JSON.stringify({ error: "Contract is paused" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (Number(remaining) === 0) {
      return new Response(
        JSON.stringify({ message: "All investors already distributed", remaining: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalInvestors = Number(investorCount);
    console.log(`[distribute] Starting: ${totalInvestors} investors, ${Number(remaining)} remaining, batch size ${batchSize}`);

    // ── Create or resume job ────────────────────────────────

    const distributedSoFar = await publicClient.readContract({
      address: FUNDING_ROUND as `0x${string}`,
      abi: FUNDING_ROUND_ABI,
      functionName: "distributedCount",
    });

    // Find the starting index: we scan from 0, the contract skips already-distributed
    // But for efficiency, check the job table for last processed index
    let { data: existingJob } = await supabase
      .from("distribution_jobs")
      .select("*")
      .eq("job_type", "initial_distribution")
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let jobId: string;
    let startIndex: number;

    if (existingJob) {
      jobId = existingJob.id;
      startIndex = existingJob.last_processed_index;
      console.log(`[distribute] Resuming job ${jobId} from index ${startIndex}`);
    } else {
      const { data: newJob } = await supabase
        .from("distribution_jobs")
        .insert({
          job_type: "initial_distribution",
          status: "running",
          total_investors: totalInvestors,
          batch_size: batchSize,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      jobId = newJob!.id;
      startIndex = 0;
      console.log(`[distribute] New job ${jobId} starting from 0`);
    }

    // ── Execute batches ─────────────────────────────────────

    let currentIndex = startIndex;
    let batchesCompleted = existingJob?.batches_completed || 0;
    let batchesFailed = existingJob?.batches_failed || 0;
    const errorLog: any[] = existingJob?.error_log || [];
    const startTime = Date.now();
    let timedOut = false;

    while (currentIndex < totalInvestors) {
      // Check timeout — exit gracefully before Supabase kills us
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log(`[distribute] Approaching timeout at index ${currentIndex}. Saving progress.`);
        timedOut = true;
        break;
      }
      const fromIndex = currentIndex;
      const toIndex = Math.min(currentIndex + batchSize, totalInvestors);

      console.log(`[distribute] Batch: ${fromIndex} → ${toIndex}`);

      try {
        const hash = await walletClient.writeContract({
          address: FUNDING_ROUND as `0x${string}`,
          abi: FUNDING_ROUND_ABI,
          functionName: "distributeBatch",
          args: [BigInt(fromIndex), BigInt(toIndex)],
        });

        console.log(`[distribute] TX sent: ${hash}`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (receipt.status === "success") {
          console.log(`[distribute] Batch ${fromIndex}-${toIndex} confirmed at block ${receipt.blockNumber}`);
          batchesCompleted++;
        } else {
          console.error(`[distribute] Batch ${fromIndex}-${toIndex} reverted`);
          batchesFailed++;
          errorLog.push({
            batch: `${fromIndex}-${toIndex}`,
            error: "Transaction reverted on-chain",
            txHash: hash,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error(`[distribute] Batch ${fromIndex}-${toIndex} failed: ${err.message}`);
        batchesFailed++;

        // Extract custom error data if available
        let errorDetail = err.message;
        if (err.message.includes("AlreadyDistributed")) {
          errorDetail = `AlreadyDistributed collision in range ${fromIndex}-${toIndex}`;
        }

        errorLog.push({
          batch: `${fromIndex}-${toIndex}`,
          error: errorDetail,
          timestamp: new Date().toISOString(),
        });

        // Don't retry the same batch — move to next
        // The overlap was caught by the pre-check, so this range has a collision
      }

      currentIndex = toIndex;

      // Update job progress
      await supabase
        .from("distribution_jobs")
        .update({
          last_processed_index: currentIndex,
          batches_completed: batchesCompleted,
          batches_failed: batchesFailed,
          error_log: errorLog,
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      // Delay between batches to avoid RPC rate limits
      if (currentIndex < totalInvestors) {
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    // ── Finalize job ────────────────────────────────────────

    const finalRemaining = await publicClient.readContract({
      address: FUNDING_ROUND as `0x${string}`,
      abi: FUNDING_ROUND_ABI,
      functionName: "getRemainingDistributions",
    });

    // If timed out, keep status as "running" so next invocation resumes
    const jobStatus = timedOut ? "running" : (Number(finalRemaining) === 0 ? "completed" : "failed");

    await supabase
      .from("distribution_jobs")
      .update({
        status: jobStatus,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    const result = {
      jobId,
      status: jobStatus,
      totalInvestors,
      batchesCompleted,
      batchesFailed,
      remainingDistributions: Number(finalRemaining),
      errors: errorLog.length,
    };

    console.log(`[distribute] Job complete:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[distribute] Fatal error: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
