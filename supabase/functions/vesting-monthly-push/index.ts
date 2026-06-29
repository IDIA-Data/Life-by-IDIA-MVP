/**
 * vesting-monthly-push
 *
 * Pushes unlocked vested tokens to all investors in batches.
 * Called monthly via pg_cron or external scheduler.
 *
 * The function is fully idempotent:
 *   - Calling twice in the same month: second call skips everyone (0 claimable)
 *   - Calling after missing months: sends accumulated unlocked tokens
 *   - Overlapping batch ranges: safe (already-pushed investors have 0 claimable)
 *
 * Deploy:  supabase functions deploy vesting-monthly-push --no-verify-jwt
 * Invoke:  POST /functions/v1/vesting-monthly-push
 *          Body: { "batchSize": 50 }  (optional)
 *
 * Cron (pg_cron — run on the 1st of each month):
 *   SELECT cron.schedule('vesting-push', '0 6 1 * *', $$
 *     SELECT net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/vesting-monthly-push',
 *       headers := '{"Content-Type": "application/json"}'::jsonb,
 *       body := '{"batchSize": 50}'::jsonb
 *     );
 *   $$);
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   RELAYER_PRIVATE_KEY
 *   VESTING_MANAGER_ADDRESS
 *   BASE_RPC_URL (optional)
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
const VESTING_MANAGER = Deno.env.get("VESTING_MANAGER_ADDRESS")!;
const RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const DEFAULT_BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 3000;
const MAX_EXECUTION_MS = 50000; // Exit before Supabase 60s timeout

// ── ABI ─────────────────────────────────────────────────────────

const VESTING_ABI = parseAbi([
  "function pushDistributionBatch(uint256 fromIndex, uint256 toIndex) external",
  "function getBeneficiaryCount() view returns (uint256)",
  "function vestingStartDate() view returns (uint256)",
  "function paused() view returns (bool)",
  // View for checking if there's anything to push
  "function claimable(address beneficiary) view returns (uint256)",
  "function beneficiaries(uint256 index) view returns (address)",
]);

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

    const [isPaused, vestingStart, beneficiaryCount] = await Promise.all([
      publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "paused",
      }),
      publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "vestingStartDate",
      }),
      publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "getBeneficiaryCount",
      }),
    ]);

    if (isPaused) {
      return new Response(
        JSON.stringify({ error: "VestingManager is paused" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (Number(vestingStart) === 0) {
      return new Response(
        JSON.stringify({ error: "Vesting start date not set" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= Number(vestingStart)) {
      return new Response(
        JSON.stringify({ message: "Vesting has not started yet", vestingStart: Number(vestingStart) }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalBeneficiaries = Number(beneficiaryCount);
    if (totalBeneficiaries === 0) {
      return new Response(
        JSON.stringify({ message: "No beneficiaries" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Calculate which month we're in
    const elapsed = now - Number(vestingStart);
    const currentMonth = Math.floor(elapsed / (30 * 24 * 60 * 60));
    console.log(`[vesting-push] Month ${currentMonth}/72, ${totalBeneficiaries} beneficiaries, batch size ${batchSize}`);

    // ── Spot check: is there anything to push? ──────────────
    // Check first beneficiary's claimable amount as a quick test
    let hasClaimable = false;
    try {
      const firstBeneficiary = await publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "beneficiaries",
        args: [0n],
      });

      const firstClaimable = await publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "claimable",
        args: [firstBeneficiary as `0x${string}`],
      });

      hasClaimable = Number(firstClaimable) > 0;
    } catch {
      // If spot check fails, proceed anyway — the contract handles 0 claimable gracefully
      hasClaimable = true;
    }

    if (!hasClaimable) {
      console.log(`[vesting-push] Spot check: first beneficiary has 0 claimable. Likely already pushed this month.`);
      return new Response(
        JSON.stringify({
          message: "No tokens to push (likely already distributed this month)",
          currentMonth,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Create job ──────────────────────────────────────────

    const { data: job } = await supabase
      .from("distribution_jobs")
      .insert({
        job_type: "monthly_push",
        status: "running",
        total_investors: totalBeneficiaries,
        batch_size: batchSize,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const jobId = job!.id;

    // ── Execute batches ─────────────────────────────────────

    let currentIndex = 0;
    let batchesCompleted = 0;
    let batchesFailed = 0;
    const errorLog: any[] = [];
    const startTime = Date.now();
    let timedOut = false;

    while (currentIndex < totalBeneficiaries) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log(`[vesting-push] Approaching timeout at index ${currentIndex}. Saving progress.`);
        timedOut = true;
        break;
      }
      const fromIndex = currentIndex;
      const toIndex = Math.min(currentIndex + batchSize, totalBeneficiaries);

      console.log(`[vesting-push] Batch: ${fromIndex} → ${toIndex}`);

      try {
        const hash = await walletClient.writeContract({
          address: VESTING_MANAGER as `0x${string}`,
          abi: VESTING_ABI,
          functionName: "pushDistributionBatch",
          args: [BigInt(fromIndex), BigInt(toIndex)],
        });

        console.log(`[vesting-push] TX sent: ${hash}`);

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
        });

        if (receipt.status === "success") {
          console.log(`[vesting-push] Batch ${fromIndex}-${toIndex} confirmed`);
          batchesCompleted++;
        } else {
          console.error(`[vesting-push] Batch ${fromIndex}-${toIndex} reverted`);
          batchesFailed++;
          errorLog.push({
            batch: `${fromIndex}-${toIndex}`,
            error: "Reverted on-chain",
            txHash: hash,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error(`[vesting-push] Batch ${fromIndex}-${toIndex} failed: ${err.message}`);
        batchesFailed++;
        errorLog.push({
          batch: `${fromIndex}-${toIndex}`,
          error: err.message.slice(0, 500),
          timestamp: new Date().toISOString(),
        });
      }

      currentIndex = toIndex;

      // Update progress
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

      if (currentIndex < totalBeneficiaries) {
        await delay(DELAY_BETWEEN_BATCHES_MS);
      }
    }

    // ── Finalize ────────────────────────────────────────────

    const jobStatus = timedOut ? "running" : (batchesFailed === 0 ? "completed" : "completed_with_errors");

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
      currentMonth,
      totalBeneficiaries,
      batchesCompleted,
      batchesFailed,
      errors: errorLog.length,
    };

    console.log(`[vesting-push] Complete:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[vesting-push] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
