/**
 * funding-round-indexer
 *
 * Scans the FundingRound and VestingManager contracts for events and
 * indexes them into the Supabase database. Provides the data layer
 * for the investor portal dashboard.
 *
 * Events indexed:
 *   - Contributed(investor, usdcAmount, totalContributed)
 *   - TokensDistributed(investor, index, immediateAmount, vestingAmount)
 *   - TokensPushed(beneficiary, amount, totalClaimed, monthsUnlocked)
 *
 * Deploy:  supabase functions deploy funding-round-indexer --no-verify-jwt
 * Invoke:  POST /functions/v1/funding-round-indexer
 *
 * Schedule via pg_cron every 30-60 seconds:
 *   SELECT cron.schedule('funding-indexer', '* * * * *', $$
 *     SELECT net.http_post(
 *       url := 'https://<project>.supabase.co/functions/v1/funding-round-indexer',
 *       headers := '{"Content-Type": "application/json"}'::jsonb,
 *       body := '{}'::jsonb
 *     );
 *   $$);
 *
 * Requires env vars:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 *   FUNDING_ROUND_ADDRESS, VESTING_MANAGER_ADDRESS
 *   FUNDING_ROUND_DEPLOY_BLOCK (block number when FundingRound was deployed)
 *   BASE_RPC_URL (optional)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ──────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNDING_ROUND = Deno.env.get("FUNDING_ROUND_ADDRESS") || "";
const VESTING_MANAGER = Deno.env.get("VESTING_MANAGER_ADDRESS") || "";
const DEPLOY_BLOCK = parseInt(Deno.env.get("FUNDING_ROUND_DEPLOY_BLOCK") || "0");
const RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const MAX_BLOCK_RANGE = 9999; // Base RPC limit

// ── Event signatures ────────────────────────────────────────────

// keccak256 of the event signatures
const TOPICS = {
  Contributed: "0x" + await sha256("Contributed(address,uint256,uint256)"),
  TokensDistributed: "0x" + await sha256("TokensDistributed(address,uint256,uint256,uint256)"),
  TokensPushed: "0x" + await sha256("TokensPushed(address,uint256,uint256,uint256)"),
  BatchDistributed: "0x" + await sha256("BatchDistributed(uint256,uint256,uint256)"),
  BatchPushCompleted: "0x" + await sha256("BatchPushCompleted(uint256,uint256,uint256,uint256)"),
};

// Use crypto.subtle for keccak — but keccak256 isn't available in Deno
// So we compute the topics manually from the Solidity compiler output.
// These MUST match the event signatures in the contracts.
// Hardcode them after deployment by checking the ABI or BaseScan.
async function sha256(_input: string): Promise<string> {
  // Placeholder — replace with actual keccak256 topic hashes after deployment.
  // You can get these from:
  //   1. Remix → compile → ABI → look for topic0 in event logs
  //   2. BaseScan → contract → Events tab
  //   3. cast sig-event "Contributed(address,uint256,uint256)"
  return "0000000000000000000000000000000000000000000000000000000000000000";
}

// IMPORTANT: Replace these with actual topic0 hashes after contract deployment
// Use: cast sig-event "Contributed(address,uint256,uint256)"
const EVENT_TOPICS = {
  Contributed: "0xfa35a310d7113dddce1c275da946348e9aaebf9050b00b372033c4d84b0bd6eb",
  TokensDistributed: "0x0421bad05b498ec1a4fef14f013f2231ff7a9dab27534f5e64f2efbe96b0d32c",
  TokensPushed: "0xb10d4370c1a1d209d7e303c9d0a792729e383e73a5fb9adec13a1edcecb701db",
};

// ── RPC helpers ─────────────────────────────────────────────────

async function rpc(method: string, params: any[]): Promise<any> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC: ${json.error.message}`);
  return json.result;
}

async function getCurrentBlock(): Promise<number> {
  const hex = await rpc("eth_blockNumber", []);
  return parseInt(hex, 16);
}

async function getLogs(address: string, topics: string[], from: number, to: number): Promise<any[]> {
  return await rpc("eth_getLogs", [{
    address,
    topics,
    fromBlock: "0x" + from.toString(16),
    toBlock: "0x" + to.toString(16),
  }]);
}

function hexToDecimal(hex: string): string {
  return BigInt("0x" + hex.replace(/^0x/, "")).toString();
}

function hexToAddress(hex: string): string {
  return "0x" + hex.slice(-40).toLowerCase();
}

function formatUSDC(rawHex: string): number {
  return Number(BigInt("0x" + rawHex.replace(/^0x/, ""))) / 1e6;
}

function formatIDIA(rawHex: string): string {
  const raw = BigInt("0x" + rawHex.replace(/^0x/, ""));
  const whole = raw / BigInt(1e18);
  const frac = raw % BigInt(1e18);
  if (frac === 0n) return whole.toString();
  return `${whole}.${frac.toString().padStart(18, "0").replace(/0+$/, "")}`;
}

// ── Main ────────────────────────────────────────────────────────

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    const currentBlock = await getCurrentBlock();

    const results: Record<string, { scanned: number; found: number }> = {};

    // ── INDEX CONTRIBUTIONS ─────────────────────────────────

    if (FUNDING_ROUND && EVENT_TOPICS.Contributed !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const { data: state } = await supabase
        .from("funding_indexer_state")
        .select("last_scanned_block")
        .eq("id", "contributions")
        .single();

      let lastBlock = state?.last_scanned_block || DEPLOY_BLOCK;
      let found = 0;

      for (let from = lastBlock + 1; from <= currentBlock; from += MAX_BLOCK_RANGE + 1) {
        const to = Math.min(from + MAX_BLOCK_RANGE, currentBlock);
        try {
          const logs = await getLogs(FUNDING_ROUND, [EVENT_TOPICS.Contributed], from, to);
          for (const log of logs) {
            const data = log.data.replace(/^0x/, "");
            const investor = hexToAddress(log.topics[1]);
            const usdcAmount = data.slice(0, 64);
            const totalContributed = data.slice(64, 128);

            await supabase.from("funding_contributions").upsert({
              investor_address: investor,
              usdc_amount: formatUSDC(usdcAmount),
              usdc_amount_raw: hexToDecimal(usdcAmount),
              total_contributed: formatUSDC(totalContributed),
              tx_hash: log.transactionHash,
              block_number: parseInt(log.blockNumber, 16),
              log_index: parseInt(log.logIndex, 16),
            }, { onConflict: "tx_hash,log_index" });

            found++;
          }
        } catch (e: any) {
          console.warn(`[indexer] Contributions chunk ${from}-${to} failed: ${e.message}`);
        }
      }

      await supabase.from("funding_indexer_state")
        .update({ last_scanned_block: currentBlock, updated_at: new Date().toISOString() })
        .eq("id", "contributions");

      results.contributions = { scanned: currentBlock - lastBlock, found };
    }

    // ── INDEX DISTRIBUTIONS ─────────────────────────────────

    if (FUNDING_ROUND && EVENT_TOPICS.TokensDistributed !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const { data: state } = await supabase
        .from("funding_indexer_state")
        .select("last_scanned_block")
        .eq("id", "distributions")
        .single();

      let lastBlock = state?.last_scanned_block || DEPLOY_BLOCK;
      let found = 0;

      for (let from = lastBlock + 1; from <= currentBlock; from += MAX_BLOCK_RANGE + 1) {
        const to = Math.min(from + MAX_BLOCK_RANGE, currentBlock);
        try {
          const logs = await getLogs(FUNDING_ROUND, [EVENT_TOPICS.TokensDistributed], from, to);
          for (const log of logs) {
            const data = log.data.replace(/^0x/, "");
            const investor = hexToAddress(log.topics[1]);
            const investorIndex = parseInt(data.slice(0, 64), 16);
            const immediateAmount = data.slice(64, 128);
            const vestingAmount = data.slice(128, 192);

            await supabase.from("funding_distributions").upsert({
              investor_address: investor,
              investor_index: investorIndex,
              immediate_amount: hexToDecimal(immediateAmount),
              vesting_amount: hexToDecimal(vestingAmount),
              tx_hash: log.transactionHash,
              block_number: parseInt(log.blockNumber, 16),
            }, { onConflict: "investor_address" });

            found++;
          }
        } catch (e: any) {
          console.warn(`[indexer] Distributions chunk ${from}-${to} failed: ${e.message}`);
        }
      }

      await supabase.from("funding_indexer_state")
        .update({ last_scanned_block: currentBlock, updated_at: new Date().toISOString() })
        .eq("id", "distributions");

      results.distributions = { scanned: currentBlock - lastBlock, found };
    }

    // ── INDEX VESTING PUSHES ────────────────────────────────

    if (VESTING_MANAGER && EVENT_TOPICS.TokensPushed !== "0x0000000000000000000000000000000000000000000000000000000000000000") {
      const { data: state } = await supabase
        .from("funding_indexer_state")
        .select("last_scanned_block")
        .eq("id", "vesting_pushes")
        .single();

      let lastBlock = state?.last_scanned_block || DEPLOY_BLOCK;
      let found = 0;

      for (let from = lastBlock + 1; from <= currentBlock; from += MAX_BLOCK_RANGE + 1) {
        const to = Math.min(from + MAX_BLOCK_RANGE, currentBlock);
        try {
          const logs = await getLogs(VESTING_MANAGER, [EVENT_TOPICS.TokensPushed], from, to);
          for (const log of logs) {
            const data = log.data.replace(/^0x/, "");
            const beneficiary = hexToAddress(log.topics[1]);
            const amount = data.slice(0, 64);
            const totalClaimed = data.slice(64, 128);
            const monthsUnlocked = parseInt(data.slice(128, 192), 16);

            await supabase.from("vesting_pushes").insert({
              beneficiary_address: beneficiary,
              amount: hexToDecimal(amount),
              total_claimed: hexToDecimal(totalClaimed),
              months_unlocked: monthsUnlocked,
              tx_hash: log.transactionHash,
              block_number: parseInt(log.blockNumber, 16),
            });

            found++;
          }
        } catch (e: any) {
          console.warn(`[indexer] Vesting pushes chunk ${from}-${to} failed: ${e.message}`);
        }
      }

      await supabase.from("funding_indexer_state")
        .update({ last_scanned_block: currentBlock, updated_at: new Date().toISOString() })
        .eq("id", "vesting_pushes");

      results.vesting_pushes = { scanned: currentBlock - lastBlock, found };
    }

    console.log("[indexer] Complete:", results);

    return new Response(JSON.stringify({ currentBlock, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error(`[indexer] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
