import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.7";
import { privateKeyToAccount } from "https://esm.sh/viem@2.9.20/accounts";
import { base } from "https://esm.sh/viem@2.9.20/chains";
import { createWalletClient, http, parseUnits, publicActions } from "https://esm.sh/viem@2.9.20";

// 🚨 BIGINT SERIALIZATION PATCH 🚨
// Teaches JSON.stringify how to natively parse blockchain BigInt values into strings
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Supabase Edge Runtime global — not in Deno's stdlib type defs. Provides
// post-response background execution via waitUntil().
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

// ══════════════════════════════════════════════════════════════════════
// 1. PROTOCOL CONSTANTS & SPLIT CONFIG
// ══════════════════════════════════════════════════════════════════════

const REVENUE_SPLIT = { CORPORATE: 0.6, WAR_CHEST: 0.1, DATA_YIELD: 0.3 };
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Network — single canonical Alchemy URL, injected exclusively via secret.
// Hardcoded plaintext keys are forbidden in source; the function must stall
// loudly at init if the credential is missing.
const ALCHEMY_BASE_RPC_URL = Deno.env.get("ALCHEMY_BASE_RPC_URL");
if (!ALCHEMY_BASE_RPC_URL) {
  console.error(`[FATAL STALL: INIT] Missing ALCHEMY_BASE_RPC_URL.`);
  throw new Error("Missing RPC credentials.");
}

// Protocol contracts — Base Mainnet (mirrors src/config/contracts.ts)
const REGISTRY_ADDRESS = "0x137D913d89d0D6a5b2d1Db76173770C94d25387B";
const POOL_FACTORY_ADDRESS = "0x0188FCB027D834E03DD0288D360937ceC4d267bb";
const ESCROW_ECOSYSTEM = "0xDc93eca954fD2625001b2fb9E9A098914365ADe9";
// Wallet-as-Source-of-Truth: when location is null/blank, route to the DAO Safe
// (Global War Chest). Funds remain in cryptographically-verifiable governance custody
// even if the database goes dark.
const GLOBAL_WAR_CHEST = "0x0910EF34C9F59A90d90FF505B1036DEed4a25d59";

// USDC on Base Mainnet
const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

// System wallets
const SYSTEM_CASH_REGISTER = "0x649436db4d9352240d1132d9372293e5cc6af0e3";

// ══════════════════════════════════════════════════════════════════════
// 2. ABIs
// ══════════════════════════════════════════════════════════════════════

const ERC20_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const REGISTRY_ABI = [
  {
    name: "getPoolByLocation",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "location", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const POOL_FACTORY_ABI = [
  {
    name: "getPool",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "location", type: "string" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "deployPool",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "location", type: "string" }],
    outputs: [{ name: "pool", type: "address" }],
  },
] as const;

const ESCROW_ABI = [
  {
    name: "proposeDistribution",
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

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ══════════════════════════════════════════════════════════════════════
// PLANCK-SCALE ATOMIC EXECUTOR
// Replaces viem's writeContract wrapper to expose every micro-op
// (Nonce → Simulate → Prepare → Sign → Broadcast) for sequencer diagnostics.
// ══════════════════════════════════════════════════════════════════════
async function executePlanckScaleTransaction(
  client: any,
  account: any,
  contractAddress: string,
  abi: any,
  funcName: string,
  args: any[],
  stepName: string,
): Promise<{ txHash: `0x${string}`; nonce: number }> {
  console.info(`[BEGIN: ${stepName}.Planck.NonceCheck] Interrogating RPC for pending state...`);
  const nextNonce = await client.getTransactionCount({ address: account.address, blockTag: "pending" });
  console.info(`[END: ${stepName}.Planck.NonceCheck] Sequencer assigned Nonce: ${nextNonce}`);

  console.info(`[BEGIN: ${stepName}.Planck.Simulate] Executing dry-run simulation on EVM...`);
  const { request } = await client.simulateContract({
    account,
    address: contractAddress as `0x${string}`,
    abi,
    functionName: funcName,
    args,
  });
  console.info(`[END: ${stepName}.Planck.Simulate] Simulation successful. No reverts detected.`);

  console.info(`[BEGIN: ${stepName}.Planck.Prepare] Constructing raw transaction payload...`);
  const preparedTx = await client.prepareTransactionRequest({
    ...request,
    nonce: nextNonce,
  });
  console.info(`[END: ${stepName}.Planck.Prepare] Payload constructed. Gas Limit: ${preparedTx.gas}`);

  console.info(`[BEGIN: ${stepName}.Planck.Sign] Applying cryptographic signature...`);
  const signedTx = await account.signTransaction(preparedTx);
  console.info(`[END: ${stepName}.Planck.Sign] Signature applied securely.`);

  console.info(`[BEGIN: ${stepName}.Planck.Broadcast] Injecting raw payload to Base mempool...`);
  try {
    const txHash = await client.sendRawTransaction({ serializedTransaction: signedTx });
    console.info(`[END: ${stepName}.Planck.Broadcast] Mempool accepted payload. Hash: ${txHash}`);
    return { txHash, nonce: nextNonce };
  } catch (broadcastError: any) {
    console.error(`[BEGIN: ${stepName}.Planck.FatalDump]`);
    console.error(`🚨 [FATAL STALL: ${stepName}] Sequencer violently rejected payload injection.`);
    console.error(
      `[DIAGNOSTIC] Attempted Nonce: ${nextNonce} | Target: ${contractAddress} | Args: ${JSON.stringify(args)}`,
    );
    console.error(`[DIAGNOSTIC] Raw Error: ${broadcastError.message}`);
    console.error(`[END: ${stepName}.Planck.FatalDump]`);
    throw broadcastError;
  }
}

// Brief mempool clear between sequential transactions in the same execution.
async function forceSequencerDelay(ms = 3500): Promise<void> {
  console.info(`[BEGIN: Sequencer.Delay] Pausing ${ms}ms to clear mempool...`);
  await new Promise((resolve) => setTimeout(resolve, ms));
  console.info(`[END: Sequencer.Delay] Resumed.`);
}

// ══════════════════════════════════════════════════════════════════════
// LEDGER INSERT WITH BOUNDED RETRY + REPAIR-QUEUE FALLBACK
// After a successful on-chain transfer, the ledger row MUST land or be
// deferred to the repair queue. Silent swallowing = missing balances.
// ══════════════════════════════════════════════════════════════════════
async function insertLedgerWithRepair(
  supabase: any,
  opts: {
    reference_id: string;
    user_id: string;
    phase: string;
    blockchain_tx_hash: string | null;
    row: Record<string, unknown>;
  },
): Promise<void> {
  const maxAttempts = 3;
  let lastError: any = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { error } = await supabase.from("synapse_credit_ledger").insert(opts.row);
      if (!error) return;
      lastError = error;
    } catch (err) {
      lastError = err;
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
    }
  }
  console.error(
    `[LEDGER FAILURE] ref=${opts.reference_id} user=${opts.user_id} phase=${opts.phase} tx=${opts.blockchain_tx_hash} :: ${lastError?.message ?? String(lastError)}`,
  );
  try {
    await supabase.from("settlement_ledger_repair_queue").insert({
      reference_id: opts.reference_id,
      user_id: opts.user_id,
      phase: opts.phase,
      blockchain_tx_hash: opts.blockchain_tx_hash,
      error: lastError?.message ?? String(lastError),
      payload: opts.row,
    });
  } catch (repairErr: any) {
    console.error(`[REPAIR QUEUE FAILURE] Unable to queue ledger repair: ${repairErr?.message ?? repairErr}`);
  }
}

// ══════════════════════════════════════════════════════════════════════
// 3. MAIN EXECUTION HANDLER
// ══════════════════════════════════════════════════════════════════════

// Background settlement executor. Runs after the HTTP 202 has been flushed
// to the caller via EdgeRuntime.waitUntil(). All errors are contained here —
// nothing must escape this function or it can crash the Edge isolate.
async function executeSettlement(payoutData: any, runCorrelationId: string): Promise<void> {
  let currentStep = "INIT";
  let queueSupabase: any = null;
  let queueRefId: string | null = null;
  const skippedContributors: Array<{ user_id: string; reason: string }> = [];
  let queueFinalStatus: "completed" | "partial" | "failed" = "completed";
  let queueFinalError: string | null = null;
  try {
    console.info(`[BEGIN: circular-settlement] Pulse detected. runId=${runCorrelationId} ts=${Date.now()}`);

    currentStep = "SUPABASE_CLIENT_INIT";
    console.info(`[BEGIN: ${currentStep}] Instantiating Supabase client payload...`);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseKey) {
      console.error(
        `[FATAL STALL: ${currentStep}] Missing environment variables for DB transport. Cannot construct client. ` +
          `SUPABASE_URL_present=${!!supabaseUrl} SUPABASE_SERVICE_ROLE_KEY_present=${!!supabaseKey}`,
      );
      throw new Error("Missing database connection credentials.");
    }

    let supabase;
    try {
      supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
      queueSupabase = supabase;
      console.info(`[END: ${currentStep}] Supabase client instantiated successfully.`);
    } catch (clientErr: any) {
      console.error(`[FATAL STALL: ${currentStep}] Failed to initialize Supabase client: ${clientErr.message}`);
      throw clientErr;
    }

    currentStep = "EXTRACTING_PAYLOAD";
    const { total_fiat_amount, buyer_id, contributing_users, payment_reference, location_string } = payoutData;

    // Null vs orphaned location distinction:
    //   - missing/blank  → no location intent → route to GLOBAL_WAR_CHEST
    //   - present string → real location → resolve via Registry; if zero, deploy a new pool
    const hasLocation = typeof location_string === "string" && location_string.trim().length > 0;
    const executionLocation = hasLocation ? location_string.trim() : null;
    const ingestionReference = payment_reference || `SYN-${crypto.randomUUID().slice(0, 8)}`;
    queueRefId = ingestionReference;

    // Stamp attempt counter on the settlement_queue row BEFORE any chain work.
    try {
      const { data: existing } = await supabase
        .from("settlement_queue")
        .select("attempts")
        .eq("reference_id", ingestionReference)
        .maybeSingle();
      const nextAttempts = ((existing?.attempts as number | undefined) ?? 0) + 1;
      await supabase
        .from("settlement_queue")
        .update({
          attempts: nextAttempts,
          last_attempt_at: new Date().toISOString(),
          status: "processing",
        })
        .eq("reference_id", ingestionReference);
    } catch (stampErr: any) {
      console.error(`[WARNING: QueueStamp] Could not stamp queue row for ${ingestionReference}: ${stampErr?.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════
    // RELAYER SINGLE-WRITER MUTEX
    // Serializes concurrent settlement invocations so they cannot race on
    // the relayer wallet's pending nonce. Row-based lock is REST-safe
    // across stateless Edge invocations; auto-expires after 3 min if a
    // run dies mid-broadcast.
    // ═══════════════════════════════════════════════════════════════════
    currentStep = "ACQUIRING_RELAYER_LOCK";
    let lockAcquired = false;
    console.info(`[LOCK] Attempting single-writer lock for relayer... runId=${runCorrelationId}`);
    for (let attempt = 0; attempt < 30; attempt++) {
      const { data: acquired, error: lockErr } = await supabase.rpc("acquire_relayer_lock", {
        run_id: runCorrelationId,
        timeout_seconds: 180,
      });
      if (lockErr) console.warn(`[LOCK WARN] ${lockErr.message}`);
      if (acquired) {
        lockAcquired = true;
        console.info(`✅ [LOCK] Acquired. Entering exclusive sequencer mode. runId=${runCorrelationId}`);
        break;
      }
      console.info(`⏳ [LOCK] Relayer busy. Yielding 2000ms... runId=${runCorrelationId}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!lockAcquired) {
      throw new Error("Timeout waiting for relayer lock. Another settlement is occupying the sequencer.");
    }

    try {
      currentStep = "CONFIGURING_BLOCKCHAIN";
      const rawKey = Deno.env.get("RELAYER_PRIVATE_KEY");
      if (!rawKey) throw new Error("RELAYER_PRIVATE_KEY missing.");
      const formattedKey = rawKey.trim().startsWith("0x") ? rawKey.trim() : `0x${rawKey.trim()}`;
      const account = privateKeyToAccount(formattedKey as `0x${string}`);

      const activeRpcUrl = ALCHEMY_BASE_RPC_URL;
      console.log(`[REGIONAL_ROUTING][TRANSPORT_BINDING] Launching wallet client via injected RPC secret.`);

      const client = createWalletClient({
        account,
        chain: base,
        transport: http(activeRpcUrl),
      }).extend(publicActions);

      // Hard-mainnet enforcement: confirm RPC actually returns Base Mainnet chain ID (8453).
      const resolvedChainId = await client.getChainId();
      console.info(`[DIAGNOSTIC: Network] Resolved chain ID: ${resolvedChainId}`);
      if (resolvedChainId !== 8453) {
        throw new Error(
          `CRITICAL: Active RPC route (${activeRpcUrl}) is not Base Mainnet. Expected chain ID 8453, got ${resolvedChainId}. Settlement halted.`,
        );
      }

      // PHASE 1: CORPORATE SETTLEMENT (60%)
      currentStep = "PHASE_1_CORPORATE_SETTLEMENT";
      const corporateRevenue = total_fiat_amount * REVENUE_SPLIT.CORPORATE;

      console.info(`[BEGIN: Phase_1_Corporate.Transfer] amount=${corporateRevenue}`);
      const { txHash: corporateHash } = await executePlanckScaleTransaction(
        client,
        account,
        USDC_ADDRESS,
        ERC20_ABI,
        "transfer",
        [SYSTEM_CASH_REGISTER, parseUnits(corporateRevenue.toFixed(6), 6)],
        "Phase_1_Corporate",
      );
      console.info(
        `[STATUS: Phase_1_Corporate.Transfer] TX Broadcasted. Hash: ${corporateHash}. Awaiting network confirmation...`,
      );
      const corporateReceipt = await client.waitForTransactionReceipt({ hash: corporateHash, confirmations: 1 });
      if (corporateReceipt.status === "success") {
        console.info(`[END: Phase_1_Corporate.Transfer] Transfer successful. Block: ${corporateReceipt.blockNumber}`);
        await forceSequencerDelay();
      } else {
        console.error(`[ERROR: Phase_1_Corporate.Transfer] Transaction reverted on-chain. Hash: ${corporateHash}`);
      }

      // PHASE 2: REGIONAL ROUTING (10%) — Wallet-as-Source-of-Truth
      currentStep = "PHASE_2_REGIONAL_ROUTING";
      const regionalRevenue = total_fiat_amount * REVENUE_SPLIT.WAR_CHEST;

      let finalRegionalAddress: string = GLOBAL_WAR_CHEST;
      let routingMode: "war_chest_null" | "existing_pool" | "deployed_pool" | "war_chest_fallback" = "war_chest_null";

      if (!hasLocation) {
        console.info(`[ROUTING] location_string is null/blank → GLOBAL_WAR_CHEST ${GLOBAL_WAR_CHEST}`);
        routingMode = "war_chest_null";
      } else {
        console.info(`[BEGIN: Registry.getPoolByLocation] location=${executionLocation}`);
        let poolTarget: string | undefined;
        try {
          poolTarget = await client.readContract({
            address: REGISTRY_ADDRESS,
            abi: REGISTRY_ABI,
            functionName: "getPoolByLocation",
            args: [executionLocation as string],
          });
          console.info(`[END: Registry.getPoolByLocation] resolved=${poolTarget}`);
        } catch (routingError: any) {
          console.error(
            `[WARNING: Registry.getPoolByLocation] lookup failed for ${executionLocation}: ${routingError.message}`,
          );
        }

        if (poolTarget && poolTarget !== ZERO_ADDRESS) {
          finalRegionalAddress = poolTarget;
          routingMode = "existing_pool";
          console.info(`[ROUTING] existing pool for ${executionLocation} → ${finalRegionalAddress}`);
        } else {
          // Orphaned but valid location → mint a new pool via PoolFactory
          console.info(`[BEGIN: PoolFactory.deployPool] location=${executionLocation} — orphan detected, minting pool`);
          try {
            const deployHash = await client.writeContract({
              address: POOL_FACTORY_ADDRESS,
              abi: POOL_FACTORY_ABI,
              functionName: "deployPool",
              args: [executionLocation as string],
              account,
            });
            console.info(`[STATUS: PoolFactory.deployPool] TX Broadcasted. Hash: ${deployHash}.`);
            const deployReceipt = await client.waitForTransactionReceipt({ hash: deployHash, confirmations: 1 });
            if (deployReceipt.status !== "success") {
              throw new Error(`deployPool reverted (${deployHash})`);
            }
            // Re-resolve from factory to capture the freshly minted address
            const minted = await client.readContract({
              address: POOL_FACTORY_ADDRESS,
              abi: POOL_FACTORY_ABI,
              functionName: "getPool",
              args: [executionLocation as string],
            });
            if (!minted || minted === ZERO_ADDRESS) {
              throw new Error(`getPool returned zero post-deploy for ${executionLocation}`);
            }
            finalRegionalAddress = minted as string;
            routingMode = "deployed_pool";
            console.info(`[END: PoolFactory.deployPool] minted ${finalRegionalAddress} for ${executionLocation}`);
          } catch (deployError: any) {
            console.error(
              `[WARNING: PoolFactory.deployPool] failed for ${executionLocation}: ${deployError.message} — falling back to GLOBAL_WAR_CHEST`,
            );
            finalRegionalAddress = GLOBAL_WAR_CHEST;
            routingMode = "war_chest_fallback";
          }
        }
      }

      console.info(
        `[BEGIN: Phase_2_Regional.Transfer] amount=${regionalRevenue} target=${finalRegionalAddress} mode=${routingMode}`,
      );
      const { txHash: regionalHash } = await executePlanckScaleTransaction(
        client,
        account,
        USDC_ADDRESS,
        ERC20_ABI,
        "transfer",
        [finalRegionalAddress as `0x${string}`, parseUnits(regionalRevenue.toFixed(6), 6)],
        "Phase_2_Regional",
      );
      console.info(
        `[STATUS: Phase_2_Regional.Transfer] TX Broadcasted. Hash: ${regionalHash}. Awaiting network confirmation...`,
      );
      const regionalReceipt = await client.waitForTransactionReceipt({ hash: regionalHash, confirmations: 1 });
      if (regionalReceipt.status === "success") {
        console.info(`[END: Phase_2_Regional.Transfer] Transfer successful. Block: ${regionalReceipt.blockNumber}`);
        await forceSequencerDelay();
      } else {
        console.error(`[ERROR: Phase_2_Regional.Transfer] Transaction reverted on-chain. Hash: ${regionalHash}`);
      }

      // LEDGER HYDRATION (with retry + repair-queue fallback)
      await Promise.all([
        insertLedgerWithRepair(supabase, {
          reference_id: ingestionReference,
          user_id: buyer_id,
          phase: "corporate_fee",
          blockchain_tx_hash: corporateHash,
          row: {
            user_id: buyer_id,
            amount: corporateRevenue,
            entry_type: "revenue",
            transaction_type: "hub_protocol_fee",
            status: "completed",
            blockchain_tx_hash: corporateHash,
            is_settled: true,
            settled_at: new Date().toISOString(),
            description: `60% Corporate Revenue: ${ingestionReference}`,
          },
        }),
        insertLedgerWithRepair(supabase, {
          reference_id: ingestionReference,
          user_id: buyer_id,
          phase: "regional_war_chest",
          blockchain_tx_hash: regionalHash,
          row: {
            user_id: buyer_id,
            amount: regionalRevenue,
            entry_type: "escrow",
            transaction_type: "ecosystem_war_chest",
            status: "completed",
            blockchain_tx_hash: regionalHash,
            is_settled: true,
            settled_at: new Date().toISOString(),
            description: `10% Regional/War Chest [${routingMode} → ${finalRegionalAddress}]: ${ingestionReference}`,
          },
        }),
      ]);

      // PHASE 3 & 5: ON-CHAIN ROYALTY & AUTONOMOUS IDIA PROPOSAL
      currentStep = "PHASE_3_AND_5_CONTRIBUTOR_DISTRIBUTION";
      const totalRoyaltyPool = total_fiat_amount * REVENUE_SPLIT.DATA_YIELD;
      const perContributorYield = totalRoyaltyPool / contributing_users.length;
      const contributorPayouts = [];
      const idiaAwardAmount = parseUnits("1", 18);

      console.info("[BEGIN: Phase_3_Contributor.BatchExecution] Initializing sequential transaction pipeline.");
      try {
        // Concurrency-safe helper: refetches pending nonce every attempt and retries on
        // nonce/underpriced/in-flight collisions caused by parallel Edge Function containers.
        const sendWithNonceRetry = async (
          txFn: (nonce: number) => Promise<`0x${string}`>,
          label: string,
        ): Promise<{ hash: `0x${string}`; receipt: any }> => {
          const maxRetries = 5;
          let attempt = 0;
          while (attempt < maxRetries) {
            const nonce = await client.getTransactionCount({
              address: account.address,
              blockTag: "pending",
            });
            console.info(`[PROCESS: Batch.Sequencer] Verified nonce: ${nonce} (${label} attempt ${attempt + 1})`);
            try {
              const hash = await txFn(nonce);
              const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 1 });
              return { hash, receipt };
            } catch (err: any) {
              const msg = String(err?.message ?? err ?? "").toLowerCase();
              const isNonceCollision =
                msg.includes("nonce") ||
                msg.includes("underpriced") ||
                msg.includes("in-flight transaction limit") ||
                msg.includes("already known");
              if (!isNonceCollision) throw err;
              attempt++;
              const backoffMs = Math.pow(2, attempt) * 500;
              console.warn(
                `[WARN: Batch.Item.Collision] ${label} attempt ${attempt} nonce collision (${err?.message ?? err}) — yielding ${backoffMs}ms`,
              );
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
            }
          }
          throw new Error(`Max retries exhausted for ${label} due to sequencer congestion.`);
        };

        for (let i = 0; i < contributing_users.length; i++) {
          const contributor = contributing_users[i];
          const { data: profile } = await supabase
            .from("profiles")
            .select("wallet_address")
            .eq("id", contributor.user_id)
            .maybeSingle();

          const lifeWallet = profile?.wallet_address;
          if (!lifeWallet) {
            console.warn(
              `[SKIP: Batch.Item] contributor ${contributor.user_id} has no wallet_address — skipping payout to avoid misroute.`,
            );
            skippedContributors.push({ user_id: contributor.user_id, reason: "missing_wallet" });
            continue;
          }
          console.info(
            `[BEGIN: Batch.Item] Processing transfer ${i + 1}/${contributing_users.length} to ${lifeWallet}`,
          );

          try {
            // 1. Yield transfer (USDC) — nonce-safe with retry
            const { hash: yieldHash, receipt: yieldReceipt } = await sendWithNonceRetry(
              (nonce) =>
                client.writeContract({
                  address: USDC_ADDRESS,
                  abi: ERC20_ABI,
                  functionName: "transfer",
                  args: [lifeWallet as `0x${string}`, parseUnits(perContributorYield.toFixed(6), 6)],
                  account,
                  nonce,
                }),
              "yield",
            );
            console.info(`[STATUS: Batch.Item] Yield TX Broadcasted. Hash: ${yieldHash}. Confirmed.`);
            if (yieldReceipt.status === "success") {
              console.info(`[END: Batch.Item] Yield transfer successful. Block: ${yieldReceipt.blockNumber}`);
            } else {
              console.error(`[ERROR: Batch.Item] Yield transaction reverted on-chain. Hash: ${yieldHash}`);
            }

            // 2. Royalty proposal (escrow) — nonce-safe with retry
            const { hash: proposalHash, receipt: proposalReceipt } = await sendWithNonceRetry(
              (nonce) =>
                client.writeContract({
                  address: ESCROW_ECOSYSTEM,
                  abi: ESCROW_ABI,
                  functionName: "proposeDistribution",
                  args: [
                    lifeWallet as `0x${string}`,
                    idiaAwardAmount,
                    `Automated royalty yield proposal: Ref ${ingestionReference}`,
                  ],
                  account,
                  nonce,
                }),
              "proposal",
            );
            console.info(`[STATUS: Batch.Item] Proposal TX Broadcasted. Hash: ${proposalHash}. Confirmed.`);
            if (proposalReceipt.status === "success") {
              console.info(`[END: Batch.Item] Proposal successful. Block: ${proposalReceipt.blockNumber}`);
            } else {
              console.error(`[ERROR: Batch.Item] Proposal reverted on-chain. Hash: ${proposalHash}`);
            }

            // 3. Ledger insert
            const yieldStatus = yieldReceipt.status === "success" ? "completed" : "failed";
            await insertLedgerWithRepair(supabase, {
              reference_id: ingestionReference,
              user_id: contributor.user_id,
              phase: "contributor_yield",
              blockchain_tx_hash: yieldHash,
              row: {
                user_id: contributor.user_id,
                amount: perContributorYield,
                entry_type: "deposit",
                transaction_type: "data_sale_payout",
                status: yieldStatus,
                blockchain_tx_hash: yieldHash,
                is_settled: true,
                settled_at: new Date().toISOString(),
                description: `Pro-rata yield for Ref: ${ingestionReference}`,
              },
            });

            contributorPayouts.push({
              wallet: lifeWallet,
              yield_hash: yieldHash,
              proposal_hash: proposalHash,
            });

            // 4. RPC rate-limit buffer
            await new Promise((resolve) => setTimeout(resolve, 500));
          } catch (txError: any) {
            console.info(`[BEGIN: Batch.Item.Error]`);
            console.error(`[FATAL STALL: Batch.Item] Failed executing transfer for ${lifeWallet}: ${txError.message}`);
            skippedContributors.push({
              user_id: contributor.user_id,
              reason: `tx_error: ${txError?.message ?? "unknown"}`,
            });
            // Route failure through repair queue so reconciliation can pick it up.
            try {
              await insertLedgerWithRepair(supabase, {
                reference_id: ingestionReference,
                user_id: contributor.user_id,
                phase: "contributor_yield",
                blockchain_tx_hash: null,
                row: {
                  user_id: contributor.user_id,
                  amount: perContributorYield,
                  entry_type: "deposit",
                  transaction_type: "data_sale_payout",
                  status: "failed",
                  blockchain_tx_hash: null,
                  is_settled: false,
                  description: `Failed pro-rata yield for Ref: ${ingestionReference} — ${txError?.message ?? "unknown"}`,
                },
              });
            } catch (repairError: any) {
              console.error(
                `[ERROR: Batch.Item.Repair] repair-queue insert failed: ${repairError?.message ?? repairError}`,
              );
            }
            console.info(`[END: Batch.Item.Error]`);
            continue;
          }
        }
        console.info("[END: Phase_3_Contributor.BatchExecution] Pipeline cleared.");
      } catch (globalError: any) {
        console.error(`[FATAL STALL: Phase_3_Contributor.Global] ${globalError.message}`);
        queueFinalError = globalError?.message ?? String(globalError);
      }

      console.info(
        `[COMPLETE: circular-settlement] runId=${runCorrelationId} corporateHash=${corporateHash} regionalHash=${regionalHash} regionalTarget=${finalRegionalAddress} mode=${routingMode} payouts=${contributorPayouts.length}`,
      );

      if (contributorPayouts.length === 0 && contributing_users.length > 0) {
        queueFinalStatus = "failed";
      } else if (skippedContributors.length > 0) {
        queueFinalStatus = "partial";
      } else {
        queueFinalStatus = "completed";
      }
    } finally {
      // 🚨 CRITICAL: Always release the relayer mutex, even on revert or throw.
      console.info(`[LOCK] Releasing relayer lock. runId=${runCorrelationId}`);
      try {
        await supabase.rpc("release_relayer_lock", { run_id: runCorrelationId });
      } catch (relErr: any) {
        console.error(`[LOCK] Release failed (auto-expire will recover): ${relErr?.message ?? relErr}`);
      }
    }
  } catch (error: any) {
    // Containment: never let an exception escape the background worker.
    console.error(`🚨 [FATAL STALL: ${currentStep}] runId=${runCorrelationId} :: ${error?.message ?? String(error)}`);
    if (error?.stack) console.error(`[STACK] ${error.stack}`);
    queueFinalStatus = "failed";
    queueFinalError = error?.message ?? String(error);
  } finally {
    if (queueSupabase && queueRefId) {
      try {
        await queueSupabase
          .from("settlement_queue")
          .update({
            status: queueFinalStatus,
            completed_at: new Date().toISOString(),
            last_error: queueFinalError,
            skipped_contributors: skippedContributors.length > 0 ? skippedContributors : null,
          })
          .eq("reference_id", queueRefId);
      } catch (writeBackErr: any) {
        console.error(`[WARNING: QueueWriteBack] ${writeBackErr?.message ?? writeBackErr}`);
      }
    }
  }
}

// Fire-and-Forget HTTP handler.
//   1. Validate payload synchronously.
//   2. Return 202 Accepted immediately (<100ms target).
//   3. Hand the 30-second Planck-scale settlement to EdgeRuntime.waitUntil().
serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let payoutData: any;
  try {
    const rawBody = await req.json();
    // Unwrap Postgres database-webhook envelope ({ type, table, record, ... });
    // fall back to raw body for direct/manual invocations.
    payoutData =
      rawBody && typeof rawBody === "object" && rawBody.record && rawBody.record.payload
        ? rawBody.record.payload
        : rawBody;
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON body.", failed_at: "VALIDATING_INPUTS" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { total_fiat_amount, contributing_users } = payoutData ?? {};
  if (!total_fiat_amount || total_fiat_amount <= 0) {
    return new Response(JSON.stringify({ error: "Invalid total_fiat_amount.", failed_at: "VALIDATING_INPUTS" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!contributing_users || !Array.isArray(contributing_users) || contributing_users.length === 0) {
    return new Response(JSON.stringify({ error: "Missing contributing_users.", failed_at: "VALIDATING_INPUTS" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const runCorrelationId = crypto.randomUUID();
  console.info(`[ACCEPTED] circular-settlement queued. runId=${runCorrelationId} ts=${Date.now()}`);

  // Hand off the heavy lifting. The HTTP response flushes immediately;
  // EdgeRuntime keeps the worker alive until the promise resolves.
  EdgeRuntime.waitUntil(executeSettlement(payoutData, runCorrelationId));

  return new Response(
    JSON.stringify({
      accepted: true,
      runId: runCorrelationId,
      message: "Settlement queued for asynchronous execution. Poll synapse_credit_ledger for completion.",
    }),
    { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
