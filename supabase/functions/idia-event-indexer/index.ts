import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.7";
import {
  createPublicClient,
  http,
  parseAbiItem,
  decodeEventLog,
  formatUnits,
  type Log,
} from "npm:viem@2.9.20";
import { base, baseSepolia } from "npm:viem@2.9.20/chains";

// ══════════════════════════════════════════════════════════════
// CONFIGURATION
// ══════════════════════════════════════════════════════════════

const IS_MAINNET = Deno.env.get("BASE_RPC_URL")?.includes("mainnet") ?? false;
const CHAIN = IS_MAINNET ? base : baseSepolia;
const CHAIN_ID = CHAIN.id;
const RPC_URL = Deno.env.get("BASE_RPC_URL") || "https://sepolia.base.org";

// Maximum blocks to scan per invocation (Base ~2s blocks, 500 blocks ≈ 16 min)
const MAX_BLOCK_RANGE = 500;

// ══════════════════════════════════════════════════════════════
// CONTRACT REGISTRY
// Update these addresses after each deployment.
// The edge function reads them from env vars so you can change
// them without redeploying the function.
// ══════════════════════════════════════════════════════════════

interface ContractDef {
  name: string;
  address: `0x${string}`;
}

function getContracts(): ContractDef[] {
  return [
    { name: "IDIAToken",           address: (Deno.env.get("IDIA_TOKEN_ADDRESS")        || "0x18306e920946FA7e42990C5D6F9402750407bF4B") as `0x${string}` },
    { name: "TimelockController",  address: (Deno.env.get("TIMELOCK_ADDRESS")           || "0xab31029D8A9F2b79233E4fAF8eEb80330613af55") as `0x${string}` },
    { name: "IDIAGovernor",        address: (Deno.env.get("GOVERNOR_ADDRESS")           || "0xc91f062d37f178b766F4424df544c3CA1AC3D7FD") as `0x${string}` },
    { name: "IDIARegistry",        address: (Deno.env.get("REGISTRY_ADDRESS")           || "0xDf7e629eb6083FEe5c66DfF3D4b4A682C4cC1C08") as `0x${string}` },
    { name: "IDIAPoolFactory",     address: (Deno.env.get("POOL_FACTORY_ADDRESS")       || "0x9a295Bc1C53B4694dbB10f1b048A770B25b99ab5") as `0x${string}` },
    { name: "LiabilityReceipt",    address: (Deno.env.get("LIABILITY_RECEIPT_ADDRESS")  || "0x9f7aA33e0Cb21252A7E00C570768a4fd72A06A36") as `0x${string}` },
    { name: "EscrowTeam",          address: (Deno.env.get("ESCROW_TEAM")                || "0x5636a3fa473AceD6faaeEC7ebD24c85846A6638B") as `0x${string}` },
    { name: "EscrowEcosystem",     address: (Deno.env.get("ESCROW_ECOSYSTEM")           || "0x465D3395bf827Cc06d366765d2CE2cBd1b54bBB2") as `0x${string}` },
    { name: "EscrowLiquidity",     address: (Deno.env.get("ESCROW_LIQUIDITY")           || "0xF6bbc8a8bcbd80E25a6a37BaA9a0271e9f401136") as `0x${string}` },
    { name: "EscrowInvestors",     address: (Deno.env.get("ESCROW_INVESTORS")           || "0xb4F5bB829FC7492Df7daA44374eda653245C5F6f") as `0x${string}` },
    { name: "EscrowPublic",        address: (Deno.env.get("ESCROW_PUBLIC")              || "0x45BC46e0C52f2d1d2c22BC267Eb5D27c42B8E5f8") as `0x${string}` },
  ];
}

// ══════════════════════════════════════════════════════════════
// EVENT ABIs (all events across all contracts)
// ══════════════════════════════════════════════════════════════

const ALL_EVENTS = [
  // ERC20 standard
  parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)"),
  parseAbiItem("event Approval(address indexed owner, address indexed spender, uint256 value)"),

  // ERC20Votes
  parseAbiItem("event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate)"),
  parseAbiItem("event DelegateVotesChanged(address indexed delegate, uint256 previousVotes, uint256 newVotes)"),

  // IDIA Token custom
  parseAbiItem("event MintSequenceStarted(uint256 totalSupply)"),
  parseAbiItem("event EscrowFunded(string category, address indexed escrow, uint256 amount)"),
  parseAbiItem("event MintSequenceFinished(uint256 totalSupply)"),
  parseAbiItem("event GovernancePulseStarted(bytes32 indexed callId)"),
  parseAbiItem("event GovernancePulseFinished(bytes32 indexed callId)"),

  // IDIAEscrow
  parseAbiItem("event Initialized(address indexed token)"),
  parseAbiItem("event ApproverAdded(address indexed approver)"),
  parseAbiItem("event ApproverRemoved(address indexed approver)"),
  parseAbiItem("event AutomatedDistributorUpdated(address indexed oldDistributor, address indexed newDistributor)"),
  parseAbiItem("event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)"),
  parseAbiItem("event DistributionProposed(uint256 indexed proposalId, address indexed recipient, uint256 amount, string reason)"),
  parseAbiItem("event DistributionApproved(uint256 indexed proposalId, address indexed approvedBy, address indexed recipient, uint256 amount)"),
  parseAbiItem("event DistributionCancelled(uint256 indexed proposalId)"),
  parseAbiItem("event AutomatedDistribution(uint256 indexed proposalId, address indexed recipient, uint256 amount, string reason, address indexed executor)"),
  parseAbiItem("event EscrowMigrated(address indexed oldEscrow, address indexed newEscrow, uint256 amount, uint256 timestamp)"),

  // IDIALiabilityReceipt
  parseAbiItem("event ReceiptMinted(uint256 indexed tokenId, address indexed dataBuyer, bytes32 indexed synapseReceiptId, uint256 acaCount, uint256 purchaseAmount, uint256 timestamp)"),
  parseAbiItem("event Locked(uint256 tokenId)"),

  // IDIARegistry
  parseAbiItem("event LocationRegistered(string indexed locationHash, string location, address pool)"),
  parseAbiItem("event LocationRemoved(string indexed locationHash, string location)"),
  parseAbiItem("event LocationUpdated(string indexed locationHash, string location, address oldPool, address newPool)"),

  // IDIAPoolFactory
  parseAbiItem("event PoolDeployed(string indexed locationHash, string location, address pool, address owner)"),

  // IDIA_LocalizedPool
  parseAbiItem("event AllocationPulseStarted(address indexed recipient, uint256 amount)"),
  parseAbiItem("event AllocationPulseFinished(address indexed recipient, uint256 amount, uint256 remainingBalance)"),
  parseAbiItem("event EmergencyWithdrawal(address indexed to, uint256 amount)"),

  // AccessControl (Timelock, LiabilityReceipt)
  parseAbiItem("event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)"),
  parseAbiItem("event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)"),

  // TimelockController
  parseAbiItem("event CallScheduled(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data, bytes32 predecessor, uint256 delay)"),
  parseAbiItem("event CallExecuted(bytes32 indexed id, uint256 indexed index, address target, uint256 value, bytes data)"),
  parseAbiItem("event Cancelled(bytes32 indexed id)"),
  parseAbiItem("event MinDelayChange(uint256 oldDuration, uint256 newDuration)"),

  // Governor
  parseAbiItem("event ProposalCreated(uint256 proposalId, address proposer, address[] targets, uint256[] values, string[] signatures, bytes[] calldatas, uint256 voteStart, uint256 voteEnd, string description)"),
  parseAbiItem("event ProposalQueued(uint256 proposalId, uint256 etaSeconds)"),
  parseAbiItem("event ProposalExecuted(uint256 proposalId)"),
  parseAbiItem("event ProposalCanceled(uint256 proposalId)"),
  parseAbiItem("event VoteCast(address indexed voter, uint256 proposalId, uint8 support, uint256 weight, string reason)"),
];

// Build a lookup from topic0 → event ABI for decoding
const TOPIC_TO_EVENT = new Map<string, (typeof ALL_EVENTS)[number]>();
for (const evt of ALL_EVENTS) {
  // viem doesn't expose a direct topic hash helper on parseAbiItem result,
  // so we build topic0 manually from the event signature
  const sig = `${evt.name}(${evt.inputs.map(i => i.type).join(",")})`;
  // We'll match by event name instead since topic computation needs keccak
  TOPIC_TO_EVENT.set(evt.name, evt);
}

// ══════════════════════════════════════════════════════════════
// CORS
// ══════════════════════════════════════════════════════════════

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ══════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.info("[BEGIN: event-indexer] Starting event indexing cycle.");

    // Initialize clients
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("IDIA_SECRET_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const publicClient = createPublicClient({
      chain: CHAIN,
      transport: http(RPC_URL),
    });

    // Get current block
    const currentBlock = await publicClient.getBlockNumber();
    console.info(`[TRACE] Current block: ${currentBlock}`);

    // Get cursor (last indexed block)
    const { data: cursor } = await supabase
      .from("indexer_cursor")
      .select("last_block")
      .eq("chain_id", CHAIN_ID)
      .single();

    const fromBlock = BigInt(cursor?.last_block || 0) + 1n;
    const toBlock = currentBlock < fromBlock + BigInt(MAX_BLOCK_RANGE)
      ? currentBlock
      : fromBlock + BigInt(MAX_BLOCK_RANGE);

    if (fromBlock > currentBlock) {
      console.info("[END: event-indexer] Already up to date. No new blocks.");
      return new Response(
        JSON.stringify({ status: "up_to_date", currentBlock: currentBlock.toString() }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.info(`[TRACE] Scanning blocks ${fromBlock} → ${toBlock} (${toBlock - fromBlock + 1n} blocks)`);

    // Get all contracts
    const contracts = getContracts();
    const contractAddresses = contracts.map(c => c.address);
    const addressToName = new Map(contracts.map(c => [c.address.toLowerCase(), c.name]));

    // Fetch all logs from all protocol contracts in one RPC call
    const logs = await publicClient.getLogs({
      address: contractAddresses,
      fromBlock,
      toBlock,
    });

    console.info(`[TRACE] Found ${logs.length} raw log entries.`);

    // Decode and store events
    const events: any[] = [];
    let decoded = 0;
    let failed = 0;

    for (const log of logs) {
      const contractName = addressToName.get(log.address.toLowerCase()) || "Unknown";

      // Try to decode against all known event ABIs
      let eventName = "Unknown";
      let decodedArgs: Record<string, any> = {};

      for (const eventAbi of ALL_EVENTS) {
        try {
          const result = decodeEventLog({
            abi: [eventAbi],
            data: log.data,
            topics: log.topics as [any, ...any[]],
          });
          eventName = result.eventName;
          // Convert BigInt values to strings for JSON storage
          decodedArgs = Object.fromEntries(
            Object.entries(result.args as Record<string, any>).map(([k, v]) => {
              if (typeof v === "bigint") return [k, v.toString()];
              if (Array.isArray(v)) return [k, v.map(x => typeof x === "bigint" ? x.toString() : x)];
              return [k, v];
            })
          );
          decoded++;
          break;
        } catch {
          // Not this event type, try next
        }
      }

      if (eventName === "Unknown") {
        // Store raw but undecodable events for manual inspection
        decodedArgs = { _raw: true, topic0: log.topics[0] };
        failed++;
      }

      // Get block timestamp
      let blockTimestamp: string | null = null;
      try {
        const block = await publicClient.getBlock({ blockNumber: log.blockNumber! });
        blockTimestamp = new Date(Number(block.timestamp) * 1000).toISOString();
      } catch {
        // Block fetch failed; timestamp stays null
      }

      events.push({
        block_number: Number(log.blockNumber),
        block_timestamp: blockTimestamp,
        tx_hash: log.transactionHash,
        log_index: Number(log.logIndex),
        contract_address: log.address,
        contract_name: contractName,
        event_name: eventName,
        event_signature: log.topics[0] || "",
        decoded_args: decodedArgs,
        raw_topics: log.topics,
        raw_data: log.data,
      });
    }

    // Batch insert events (upsert to handle re-runs)
    if (events.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < events.length; i += batchSize) {
        const batch = events.slice(i, i + batchSize);
        const { error } = await supabase
          .from("protocol_events")
          .upsert(batch, { onConflict: "tx_hash,log_index" });

        if (error) {
          console.error(`[ERROR] Batch insert failed at offset ${i}: ${error.message}`);
          throw error;
        }
      }
      console.info(`[TRACE] Inserted ${events.length} events (${decoded} decoded, ${failed} raw).`);
    }

    // Update cursor
    await supabase
      .from("indexer_cursor")
      .upsert({
        chain_id: CHAIN_ID,
        last_block: Number(toBlock),
        updated_at: new Date().toISOString(),
      });

    console.info(`[END: event-indexer] Cursor updated to block ${toBlock}.`);

    const behindBlocks = Number(currentBlock - toBlock);
    return new Response(
      JSON.stringify({
        status: "indexed",
        from_block: fromBlock.toString(),
        to_block: toBlock.toString(),
        events_found: events.length,
        decoded: decoded,
        raw: failed,
        blocks_behind: behindBlocks,
        needs_catchup: behindBlocks > 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error(`[FATAL: event-indexer] ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
