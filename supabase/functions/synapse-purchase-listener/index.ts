/**
 * synapse-purchase-listener
 *
 * Indexes CreditsPurchased events from IDIASynapseVault and credits
 * the buyer's synapse_gas_credits in the wallets table.
 *
 * Deploy:  supabase functions deploy synapse-purchase-listener --no-verify-jwt
 * Schedule: pg_cron every 30 seconds
 */
 //  SELECT cron.schedule('synapse-purchase-listener', '*/1 * * * *', $$
 //     SELECT net.http_post(
 //       url := 'https://zxyngqciipcvveigrzqt.supabase.co/functions/v1/synapse-purchase-listener',
 //       headers := '{"Content-Type": "application/json"}'::jsonb,
 //       body := '{}'::jsonb
 //     );
//   $$);
 
 // Requires env vars:
 // SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 //   SYNAPSE_VAULT_ADDRESS (deployed contract address)
 //   SYNAPSE_VAULT_DEPLOY_BLOCK (block number of deployment tx)
 //   BASE_RPC_URL (optional, defaults to public Base RPC)
 //

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAULT_ADDRESS = Deno.env.get("SYNAPSE_VAULT_ADDRESS") || "";
const DEPLOY_BLOCK = parseInt(Deno.env.get("SYNAPSE_VAULT_DEPLOY_BLOCK") || "0");
const RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://mainnet.base.org";

const MAX_BLOCK_RANGE = 9999;

// CreditsPurchased(address indexed buyer, uint256 creditCount, uint256 usdcAmount, uint256 pricePerCredit)
// Update this after contract deployment using: cast sig-event "CreditsPurchased(address,uint256,uint256,uint256)"
const CREDITS_PURCHASED_TOPIC = "0x7852f393fd6a99c61648e39af92ae0e784b77281fc2af871edce1b51304ecd7c"; // REPLACE AFTER DEPLOY

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!VAULT_ADDRESS || CREDITS_PURCHASED_TOPIC.startsWith("0x000000000000000000000000000000000000")) {
      return new Response(
        JSON.stringify({ error: "SYNAPSE_VAULT_ADDRESS or event topic not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    // Get last scanned block
    const { data: state } = await supabase
      .from("funding_indexer_state")
      .select("last_scanned_block")
      .eq("id", "synapse_purchases")
      .single();

    let lastBlock = state?.last_scanned_block || DEPLOY_BLOCK;

    // If no row exists yet, create it
    if (!state) {
      await supabase.from("funding_indexer_state").insert({
        id: "synapse_purchases",
        last_scanned_block: DEPLOY_BLOCK,
      });
      lastBlock = DEPLOY_BLOCK;
    }

    const currentBlockHex = await rpc("eth_blockNumber", []);
    const currentBlock = parseInt(currentBlockHex, 16);
    let found = 0;

    for (let from = lastBlock + 1; from <= currentBlock; from += MAX_BLOCK_RANGE + 1) {
      const to = Math.min(from + MAX_BLOCK_RANGE, currentBlock);

      const logs = await rpc("eth_getLogs", [{
        address: VAULT_ADDRESS,
        topics: [CREDITS_PURCHASED_TOPIC],
        fromBlock: "0x" + from.toString(16),
        toBlock: "0x" + to.toString(16),
      }]);

      for (const log of logs) {
        const buyerAddress = "0x" + log.topics[1].slice(-40).toLowerCase();
        const data = log.data.replace(/^0x/, "");
        const creditCount = Number(BigInt("0x" + data.slice(0, 64)));
        const usdcAmount = Number(BigInt("0x" + data.slice(64, 128)));
        const txHash = log.transactionHash;
        const blockNumber = parseInt(log.blockNumber, 16);

        console.log(`[synapse-listener] Purchase: ${buyerAddress} bought ${creditCount} credits for ${usdcAmount / 1e6} USDC at block ${blockNumber}`);

        // Find the user by wallet address
        const { data: wallet } = await supabase
          .from("wallets")
          .select("user_id, synapse_gas_credits")
          .eq("wallet_address", buyerAddress)
          .single();

        if (!wallet) {
          console.warn(`[synapse-listener] No wallet found for ${buyerAddress} — skipping credit`);
          // Still record the purchase for reconciliation
          await supabase.from("synapse_credit_ledger").insert({
            user_id: null,
            amount: creditCount,
            entry_type: "deposit",
            transaction_type: "SYNAPSE_CREDIT_PURCHASE",
            status: "orphaned",
            blockchain_tx_hash: txHash,
            is_settled: false,
            description: `On-chain purchase: ${creditCount} credits from ${buyerAddress} (no wallet match)`,
          });
          found++;
          continue;
        }

        // Credit the user's synapse_gas_credits
        const newBalance = (wallet.synapse_gas_credits || 0) + creditCount;
        const { error: updateError } = await supabase
          .from("wallets")
          .update({
            synapse_gas_credits: newBalance,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", wallet.user_id);

        if (updateError) {
          console.error(`[synapse-listener] Failed to credit ${buyerAddress}: ${updateError.message}`);
        }

        // Record in ledger
        await supabase.from("synapse_credit_ledger").insert({
          user_id: wallet.user_id,
          amount: creditCount,
          entry_type: "deposit",
          transaction_type: "SYNAPSE_CREDIT_PURCHASE",
          status: "completed",
          blockchain_tx_hash: txHash,
          is_settled: true,
          settled_at: new Date().toISOString(),
          description: `On-chain purchase: ${creditCount} credits at $${(usdcAmount / 1e6).toFixed(2)} USDC`,
        });

        found++;
      }
    }

    // Update scanner position
    await supabase.from("funding_indexer_state")
      .update({ last_scanned_block: currentBlock, updated_at: new Date().toISOString() })
      .eq("id", "synapse_purchases");

    return new Response(
      JSON.stringify({ currentBlock, eventsFound: found }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error(`[synapse-listener] Fatal: ${err.message}`);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
