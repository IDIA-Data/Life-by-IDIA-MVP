/**
 * team-initial-distribution
 *
 * Distributes team token allocations with per-person control and
 * full database audit trail in the team_distributions table.
 *
 * Deploy: supabase functions deploy team-initial-distribution --no-verify-jwt
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or IDIA_SECRET_KEY)
 *   RELAYER_PRIVATE_KEY
 *   TEAM_ESCROW_ADDRESS (default: 0xF0E67683783ef5879b43ef99ab04Bc27A9a71074)
 *   TEAM_VESTING_MANAGER_ADDRESS
 *   IDIA_TOKEN_ADDRESS (default: 0x6526F939D257E67896821c25B6C24Daa404a01FB)
 *   BASE_RPC_URL or ALCHEMY_BASE_RPC_URL (optional)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseUnits,
} from "https://esm.sh/viem@2.9.20";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("IDIA_SECRET_KEY") ?? "";
const RELAYER_KEY = Deno.env.get("RELAYER_PRIVATE_KEY")!;
const TEAM_ESCROW = Deno.env.get("ESCROW_TEAM") || "0xF0E67683783ef5879b43ef99ab04Bc27A9a71074";
const VESTING_MANAGER = Deno.env.get("TEAM_VESTING_MANAGER_ADDRESS") || "0xb4F5bB829FC7492Df7daA44374eda653245C5F6f";
const IDIA_TOKEN = Deno.env.get("IDIA_TOKEN_ADDRESS") || "0x6526F939D257E67896821c25B6C24Daa404a01FB";
const RPC_URL = Deno.env.get("ALCHEMY_BASE_RPC_URL") || Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const DELAY_BETWEEN_TXS_MS = 3000;

const ESCROW_ABI = [{
  name: "automatedDistribute", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "recipient", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "reason", type: "string" },
  ],
  outputs: [{ name: "proposalId", type: "uint256" }],
}] as const;

const IDIA_ABI = [{
  name: "approve", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "spender", type: "address" },
    { name: "amount", type: "uint256" },
  ],
  outputs: [{ name: "", type: "bool" }],
}] as const;

const VESTING_ABI = [{
  name: "depositFor", type: "function", stateMutability: "nonpayable",
  inputs: [
    { name: "beneficiary", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "startTimestamp", type: "uint256" },
  ],
  outputs: [],
}] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TeamAllocation {
  wallet: string;
  totalIdia: string;
  immediatePercent: number;
  vestingStart: string;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const allocations: TeamAllocation[] = body.allocations;

    if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
      return new Response(
        JSON.stringify({ error: "Provide allocations: [{wallet, totalIdia, immediatePercent, vestingStart}]" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

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

    const results: any[] = [];
    console.info(`[team-dist] Processing ${allocations.length} team allocations`);

    for (let i = 0; i < allocations.length; i++) {
      const { wallet, totalIdia, immediatePercent, vestingStart } = allocations[i];

      // ── Validate inputs ───────────────────────────────────
      if (immediatePercent < 0 || immediatePercent > 100) {
        results.push({ wallet, status: "invalid", error: "immediatePercent must be 0-100" });
        continue;
      }

      const vestingStartTimestamp = Math.floor(new Date(vestingStart).getTime() / 1000);
      if (isNaN(vestingStartTimestamp) || vestingStartTimestamp === 0) {
        results.push({ wallet, status: "invalid", error: "vestingStart must be a valid ISO date" });
        continue;
      }

      const totalWei = parseUnits(totalIdia, 18);
      const immediateWei = (totalWei * BigInt(immediatePercent)) / 100n;
      const vestingWei = totalWei - immediateWei;

      console.info(
        `[team-dist] ${i + 1}/${allocations.length}: ${wallet} — ` +
        `total=${totalIdia}, immediate=${immediatePercent}%, vesting start=${vestingStart}`,
      );

      // ── Create DB audit record ────────────────────────────
      const { data: dbRecord, error: insertErr } = await supabase
        .from("team_distributions")
        .insert({
          wallet_address: wallet.toLowerCase(),
          total_idia: totalWei.toString(),
          immediate_percent: immediatePercent,
          immediate_amount: immediateWei.toString(),
          vesting_amount: vestingWei.toString(),
          vesting_start: new Date(vestingStart).toISOString(),
          status: "processing",
        })
        .select("id")
        .single();

      if (insertErr) {
        console.error(`[team-dist] DB insert failed for ${wallet}: ${insertErr.message}`);
      }
      const recordId = dbRecord?.id;

      const updateRecord = async (updates: Record<string, unknown>) => {
        if (!recordId) return;
        await supabase.from("team_distributions").update(updates).eq("id", recordId);
      };

      // ── Step 1: Send immediate portion from Escrow ────────
      if (immediateWei > 0n) {
        try {
          const immHash = await walletClient.writeContract({
            address: TEAM_ESCROW as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: "automatedDistribute",
            args: [
              wallet as `0x${string}`,
              immediateWei,
              `Team initial ${immediatePercent}%: ${totalIdia} IDIA total allocation`,
            ],
          });

          console.info(`[team-dist] Immediate TX: ${immHash}`);
          const receipt = await publicClient.waitForTransactionReceipt({ hash: immHash, confirmations: 1 });

          if (receipt.status !== "success") {
            await updateRecord({ status: "immediate_failed", error_message: "Immediate transfer reverted" });
            results.push({ wallet, status: "immediate_failed" });
            continue;
          }

          await updateRecord({ immediate_tx_hash: immHash });
          console.info(`[team-dist] Immediate confirmed at block ${receipt.blockNumber}`);
          await delay(DELAY_BETWEEN_TXS_MS);
        } catch (err: any) {
          console.error(`[team-dist] Immediate failed for ${wallet}: ${err.message}`);
          await updateRecord({ status: "immediate_failed", error_message: err.message.slice(0, 500) });
          results.push({ wallet, status: "immediate_failed", error: err.message.slice(0, 200) });
          continue;
        }
      } else {
        console.info(`[team-dist] Skipping immediate (${immediatePercent}%) for ${wallet}`);
        await updateRecord({ immediate_tx_hash: "skipped_0_percent" });
      }

      // ── Step 2: Pull vesting portion from Escrow to relayer ──
      if (vestingWei > 0n) {
        try {
          const pullHash = await walletClient.writeContract({
            address: TEAM_ESCROW as `0x${string}`,
            abi: ESCROW_ABI,
            functionName: "automatedDistribute",
            args: [account.address, vestingWei, `Team vesting prep for ${wallet}`],
          });

          console.info(`[team-dist] Vesting pull TX: ${pullHash}`);
          const receipt = await publicClient.waitForTransactionReceipt({ hash: pullHash, confirmations: 1 });

          if (receipt.status !== "success") {
            await updateRecord({ status: "vesting_pull_failed", error_message: "Vesting pull reverted" });
            results.push({ wallet, status: "vesting_pull_failed" });
            continue;
          }

          await updateRecord({ vesting_pull_tx_hash: pullHash });
          await delay(DELAY_BETWEEN_TXS_MS);
        } catch (err: any) {
          console.error(`[team-dist] Vesting pull failed: ${err.message}`);
          await updateRecord({ status: "vesting_pull_failed", error_message: err.message.slice(0, 500) });
          results.push({ wallet, status: "vesting_pull_failed", error: err.message.slice(0, 200) });
          continue;
        }

        // ── Step 3: Approve VestingManager ──
        try {
          const approveHash = await walletClient.writeContract({
            address: IDIA_TOKEN as `0x${string}`,
            abi: IDIA_ABI,
            functionName: "approve",
            args: [VESTING_MANAGER as `0x${string}`, vestingWei],
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash, confirmations: 1 });
          await delay(DELAY_BETWEEN_TXS_MS);
        } catch (err: any) {
          console.error(`[team-dist] Approve failed: ${err.message}`);
          await updateRecord({ status: "approve_failed", error_message: err.message.slice(0, 500) });
          results.push({ wallet, status: "approve_failed", error: err.message.slice(0, 200) });
          continue;
        }

        // ── Step 4: Deposit into VestingManager ──
        try {
          const depositHash = await walletClient.writeContract({
            address: VESTING_MANAGER as `0x${string}`,
            abi: VESTING_ABI,
            functionName: "depositFor",
            args: [wallet as `0x${string}`, vestingWei, BigInt(vestingStartTimestamp)],
          });

          console.info(`[team-dist] Deposit TX: ${depositHash}`);
          const receipt = await publicClient.waitForTransactionReceipt({ hash: depositHash, confirmations: 1 });

          if (receipt.status !== "success") {
            await updateRecord({ status: "vesting_deposit_failed", error_message: "Deposit reverted" });
            results.push({ wallet, status: "vesting_deposit_failed" });
            continue;
          }

          await updateRecord({
            vesting_deposit_tx_hash: depositHash,
            status: "completed",
            completed_at: new Date().toISOString(),
          });
          console.info(`[team-dist] ✓ ${wallet} fully distributed`);
          results.push({ wallet, status: "completed", immediateTx: immediateWei > 0n ? "sent" : "skipped", depositTx: depositHash });
        } catch (err: any) {
          console.error(`[team-dist] Deposit failed: ${err.message}`);
          await updateRecord({ status: "vesting_deposit_failed", error_message: err.message.slice(0, 500) });
          results.push({ wallet, status: "vesting_deposit_failed", error: err.message.slice(0, 200) });
          continue;
        }
      } else {
        await updateRecord({ status: "completed", completed_at: new Date().toISOString() });
        results.push({ wallet, status: "completed", note: "immediate_only" });
      }

      await delay(DELAY_BETWEEN_TXS_MS);
    }

    const completed = results.filter((r) => r.status === "completed").length;
    const failed = results.filter((r) => r.status !== "completed" && r.status !== "invalid").length;

    console.info(`[team-dist] Done: ${completed} completed, ${failed} failed`);

    return new Response(
      JSON.stringify({ completed, failed, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error(`[team-dist] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
