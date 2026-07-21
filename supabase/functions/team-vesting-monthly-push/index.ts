/**
 * team-vesting-monthly-push
 *
 * Pushes unlocked vested tokens to all team members in batches.
 * Separate from the investor vesting push because:
 *   - Different contract address (TeamVestingManager vs investor VestingManager)
 *   - Different vesting duration (36 months vs 72)
 *   - Per-beneficiary start dates (not global)
 *   - Tracked in team_vesting_pushes table (not vesting_pushes)
 *
 * Deploy: supabase functions deploy team-vesting-monthly-push --no-verify-jwt
 *
 * pg_cron (1st of each month at 7am UTC — offset from investor push at 6am):
 *   SELECT cron.schedule('team-vesting-push', '0 7 1 * *', $$
 *     SELECT net.http_post(
 *       url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/team-vesting-monthly-push',
 *       headers := '{"Content-Type": "application/json"}'::jsonb,
 *       body := '{"batchSize": 50}'::jsonb
 *     );
 *   $$);
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or IDIA_SECRET_KEY)
 *   RELAYER_PRIVATE_KEY
 *   TEAM_VESTING_MANAGER_ADDRESS
 *   BASE_RPC_URL or ALCHEMY_BASE_RPC_URL (optional)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  decodeEventLog,
} from "https://esm.sh/viem@2.9.20";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("IDIA_SECRET_KEY") ?? "";
const RELAYER_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!;
const VESTING_MANAGER = Deno.env.get("TEAM_VESTING_MANAGER_ADDRESS") || "0xb4F5bB829FC7492Df7daA44374eda653245C5F6f";
const RPC_URL = Deno.env.get("ALCHEMY_BASE_RPC_URL") || Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const DEFAULT_BATCH_SIZE = 50;
const DELAY_BETWEEN_BATCHES_MS = 3000;
const MAX_EXECUTION_MS = 50000;

const VESTING_ABI = parseAbi([
  "function pushDistributionBatch(uint256 fromIndex, uint256 toIndex) external",
  "function getBeneficiaryCount() view returns (uint256)",
  "function paused() view returns (bool)",
  "function claimable(address beneficiary) view returns (uint256)",
  "function beneficiaries(uint256 index) view returns (address)",
  "event TokensPushed(address indexed beneficiary, uint256 amount, uint256 totalClaimed, uint256 monthsUnlocked)",
  "event BatchPushCompleted(uint256 fromIndex, uint256 toIndex, uint256 processedCount, uint256 totalPushed)",
  "event PushFailed(address indexed beneficiary, uint256 index, uint256 amount, string reason)",
]);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const batchSize = body.batchSize || DEFAULT_BATCH_SIZE;

    if (!VESTING_MANAGER) {
      return new Response(
        JSON.stringify({ error: "TEAM_VESTING_MANAGER_ADDRESS not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    const formattedKey = RELAYER_KEY.trim().startsWith("0x")
      ? RELAYER_KEY.trim()
      : `0x${RELAYER_KEY.trim()}`;
    const account = privateKeyToAccount(formattedKey as `0x${string}`);
    const publicClient = createPublicClient({ chain: base, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: base, transport: http(RPC_URL) });

    // ── Pre-flight checks ───────────────────────────────────
    const [isPaused, beneficiaryCount] = await Promise.all([
      publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "paused",
      }),
      publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "getBeneficiaryCount",
      }),
    ]);

    if (isPaused) {
      return new Response(
        JSON.stringify({ error: "TeamVestingManager is paused" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const totalBeneficiaries = Number(beneficiaryCount);
    if (totalBeneficiaries === 0) {
      return new Response(
        JSON.stringify({ message: "No beneficiaries" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Spot check: anything to push? ───────────────────────
    try {
      const firstAddr = await publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "beneficiaries",
        args: [0n],
      });
      const firstClaimable = await publicClient.readContract({
        address: VESTING_MANAGER as `0x${string}`,
        abi: VESTING_ABI,
        functionName: "claimable",
        args: [firstAddr as `0x${string}`],
      });
      if (Number(firstClaimable) === 0) {
        console.info(`[team-push] Spot check: first beneficiary has 0 claimable — likely already pushed`);
      }
    } catch {
      // Spot check failed, proceed anyway
    }

    console.info(`[team-push] Starting: ${totalBeneficiaries} beneficiaries, batch size ${batchSize}`);

    // ── Create job record ───────────────────────────────────
    const { data: job } = await supabase
      .from("distribution_jobs")
      .insert({
        job_type: "team_monthly_push",
        status: "running",
        total_investors: totalBeneficiaries,
        batch_size: batchSize,
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const jobId = job?.id;

    // ── Execute batches ─────────────────────────────────────
    let currentIndex = 0;
    let batchesCompleted = 0;
    let batchesFailed = 0;
    const errorLog: any[] = [];
    const startTime = Date.now();
    let timedOut = false;

    while (currentIndex < totalBeneficiaries) {
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.info(`[team-push] Approaching timeout at index ${currentIndex}. Saving progress.`);
        timedOut = true;
        break;
      }

      const fromIndex = currentIndex;
      const toIndex = Math.min(currentIndex + batchSize, totalBeneficiaries);

      console.info(`[team-push] Batch: ${fromIndex} → ${toIndex}`);

      try {
        const hash = await walletClient.writeContract({
          address: VESTING_MANAGER as `0x${string}`,
          abi: VESTING_ABI,
          functionName: "pushDistributionBatch",
          args: [BigInt(fromIndex), BigInt(toIndex)],
        });

        console.info(`[team-push] TX sent: ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });

        if (receipt.status === "success") {
          console.info(`[team-push] Batch confirmed at block ${receipt.blockNumber}`);
          batchesCompleted++;

          // Index TokensPushed events from the receipt into the DB
          for (const log of receipt.logs) {
            try {
              const decoded = decodeEventLog({
                abi: VESTING_ABI,
                data: log.data,
                topics: log.topics,
              });

              if (decoded.eventName === "TokensPushed") {
                const args = decoded.args as any;
                await supabase.from("team_vesting_pushes").insert({
                  beneficiary_address: args.beneficiary.toLowerCase(),
                  amount: args.amount.toString(),
                  total_claimed: args.totalClaimed.toString(),
                  months_unlocked: Number(args.monthsUnlocked),
                  tx_hash: hash,
                  block_number: Number(receipt.blockNumber),
                });
              }
            } catch {
              // Not a TokensPushed event, skip
            }
          }
        } else {
          console.error(`[team-push] Batch ${fromIndex}-${toIndex} reverted`);
          batchesFailed++;
          errorLog.push({
            batch: `${fromIndex}-${toIndex}`,
            error: "Reverted on-chain",
            txHash: hash,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (err: any) {
        console.error(`[team-push] Batch ${fromIndex}-${toIndex} failed: ${err.message}`);
        batchesFailed++;
        errorLog.push({
          batch: `${fromIndex}-${toIndex}`,
          error: err.message.slice(0, 500),
          timestamp: new Date().toISOString(),
        });
      }

      currentIndex = toIndex;

      if (jobId) {
        await supabase.from("distribution_jobs").update({
          last_processed_index: currentIndex,
          batches_completed: batchesCompleted,
          batches_failed: batchesFailed,
          error_log: errorLog,
          updated_at: new Date().toISOString(),
        }).eq("id", jobId);
      }

      if (currentIndex < totalBeneficiaries) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
      }
    }

    // ── Finalize job ────────────────────────────────────────
    const jobStatus = timedOut ? "running" : (batchesFailed === 0 ? "completed" : "completed_with_errors");

    if (jobId) {
      await supabase.from("distribution_jobs").update({
        status: jobStatus,
        completed_at: timedOut ? null : new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    const result = {
      jobId,
      status: jobStatus,
      totalBeneficiaries,
      batchesCompleted,
      batchesFailed,
      timedOut,
      errors: errorLog.length,
    };

    console.info(`[team-push] Complete:`, result);

    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[team-push] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
