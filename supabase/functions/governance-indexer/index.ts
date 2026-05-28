/**
 * governance-indexer — Indexes on-chain proposals into Supabase.
 *
 * Scans the IDIAGovernor contract for ProposalCreated events,
 * stores them in the governance_proposals table, and updates
 * vote tallies and state for all non-final proposals.
 *
 * Deploy:  supabase functions deploy governance-indexer --no-verify-jwt
 * Invoke:  curl -X POST https://<project>.supabase.co/functions/v1/governance-indexer
 *
 * Schedule via pg_cron or Supabase cron to run every 30-60 seconds.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Config ──────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Contract addresses per network
const CONFIG: Record<string, {
  rpcUrl: string;
  governor: string;
  deployBlock: number;
}> = {
  mainnet: {
    rpcUrl: "https://mainnet.base.org",
    governor: "0x9777067CAd2892D20decAf1a5ccb78e6B291B87a",
    deployBlock: 46303500,
  },
  testnet: {
    rpcUrl: "https://sepolia.base.org",
    governor: "0x9777067CAd2892D20decAf1a5ccb78e6B291B87a",
    deployBlock: 0,
  },
};

// Base free RPC limit
const MAX_BLOCK_RANGE = 9999;

// ProposalCreated event topic
const PROPOSAL_CREATED_TOPIC =
  "0x7d84a6263ae0d98d3329bd7b46bb4e8d6f98cd35a7adb45c274c8b7fd5ebd5e0";

// Proposal states (matches Governor.sol)
const STATE_NAMES: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
};

// States that are final — no need to re-check
const FINAL_STATES = new Set([2, 3, 6, 7]);

// ── RPC helpers ─────────────────────────────────────────────────────

async function rpc(url: string, method: string, params: any[]): Promise<any> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${json.error.message}`);
  return json.result;
}

async function getCurrentBlock(rpcUrl: string): Promise<number> {
  const hex = await rpc(rpcUrl, "eth_blockNumber", []);
  return parseInt(hex, 16);
}

async function getLogs(
  rpcUrl: string,
  address: string,
  topics: string[],
  fromBlock: number,
  toBlock: number,
): Promise<any[]> {
  return await rpc(rpcUrl, "eth_getLogs", [
    {
      address,
      topics,
      fromBlock: "0x" + fromBlock.toString(16),
      toBlock: "0x" + toBlock.toString(16),
    },
  ]);
}

async function callContract(
  rpcUrl: string,
  to: string,
  data: string,
): Promise<string> {
  return await rpc(rpcUrl, "eth_call", [{ to, data }, "latest"]);
}

// ── ABI encoding helpers ────────────────────────────────────────────

function encodeFunctionCall(selector: string, proposalId: string): string {
  // Pad proposal ID to 32 bytes (uint256)
  const idHex = BigInt(proposalId).toString(16).padStart(64, "0");
  return selector + idHex;
}

function decodeUint8(hex: string): number {
  return parseInt(hex.slice(-2), 16);
}

function decodeUint256(hex: string): string {
  return BigInt("0x" + hex.replace(/^0x/, "")).toString();
}

function decodeThreeUint256(hex: string): [string, string, string] {
  const clean = hex.replace(/^0x/, "");
  return [
    BigInt("0x" + clean.slice(0, 64)).toString(),
    BigInt("0x" + clean.slice(64, 128)).toString(),
    BigInt("0x" + clean.slice(128, 192)).toString(),
  ];
}

// Format wei to human-readable token amount (18 decimals)
function formatTokens(wei: string): string {
  const n = BigInt(wei);
  const whole = n / BigInt(10 ** 18);
  const frac = n % BigInt(10 ** 18);
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").replace(/0+$/, "");
  return `${whole}.${fracStr}`;
}

// ── Event log decoder ───────────────────────────────────────────────

interface ParsedProposal {
  proposalId: string;
  proposer: string;
  targets: string[];
  values: string[];
  calldatas: string[];
  voteStart: number;
  voteEnd: number;
  description: string;
  blockNumber: number;
  txHash: string;
}

function decodeProposalCreatedLog(log: any): ParsedProposal | null {
  try {
    const data = log.data.replace(/^0x/, "");
    // ProposalCreated event has a complex ABI-encoded structure
    // The proposal ID is the first 32 bytes of the data
    // But the full event signature is:
    // ProposalCreated(uint256 proposalId, address proposer, address[] targets,
    //   uint256[] values, string[] signatures, bytes[] calldatas,
    //   uint256 voteStart, uint256 voteEnd, string description)
    //
    // Since this is complex ABI encoding, let's extract the key fields:

    // proposalId: first 32 bytes
    const proposalId = BigInt("0x" + data.slice(0, 64)).toString();

    // proposer: second 32 bytes (address, last 20 bytes)
    const proposer = "0x" + data.slice(88, 128);

    // The rest uses dynamic encoding with offsets.
    // For targets array: offset at position 2 (bytes 128-192)
    const targetsOffset = parseInt(data.slice(128, 192), 16) * 2;
    const targetsLength = parseInt(data.slice(targetsOffset, targetsOffset + 64), 16);
    const targets: string[] = [];
    for (let i = 0; i < targetsLength; i++) {
      const start = targetsOffset + 64 + i * 64;
      targets.push("0x" + data.slice(start + 24, start + 64));
    }

    // values array: offset at position 3
    const valuesOffset = parseInt(data.slice(192, 256), 16) * 2;
    const valuesLength = parseInt(data.slice(valuesOffset, valuesOffset + 64), 16);
    const values: string[] = [];
    for (let i = 0; i < valuesLength; i++) {
      const start = valuesOffset + 64 + i * 64;
      values.push(BigInt("0x" + data.slice(start, start + 64)).toString());
    }

    // Skip signatures (position 4), go to calldatas (position 5)
    const calldatasOffset = parseInt(data.slice(320, 384), 16) * 2;
    const calldatasLength = parseInt(data.slice(calldatasOffset, calldatasOffset + 64), 16);
    const calldatas: string[] = [];
    // Calldatas is bytes[], more complex — store simplified
    for (let i = 0; i < calldatasLength; i++) {
      calldatas.push("0x"); // Simplified — full decode not needed for display
    }

    // voteStart: position 6 (bytes 384-448)
    const voteStart = parseInt(data.slice(384, 448), 16);

    // voteEnd: position 7 (bytes 448-512)
    const voteEnd = parseInt(data.slice(448, 512), 16);

    // description: offset at position 8
    const descOffset = parseInt(data.slice(512, 576), 16) * 2;
    const descLength = parseInt(data.slice(descOffset, descOffset + 64), 16);
    const descHex = data.slice(descOffset + 64, descOffset + 64 + descLength * 2);
    let description = "";
    try {
      description = new TextDecoder().decode(
        new Uint8Array(descHex.match(/.{2}/g)!.map((b) => parseInt(b, 16))),
      );
    } catch {
      description = "(unable to decode)";
    }

    return {
      proposalId,
      proposer,
      targets,
      values,
      calldatas,
      voteStart,
      voteEnd,
      description,
      blockNumber: parseInt(log.blockNumber, 16),
      txHash: log.transactionHash,
    };
  } catch (e) {
    console.error("[governance-indexer] Failed to decode log:", e);
    return null;
  }
}

// ── Main indexer logic ──────────────────────────────────────────────

async function indexProposals(network: string) {
  const config = CONFIG[network];
  if (!config) throw new Error(`Unknown network: ${network}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // 1. Get the last scanned block
  const { data: indexerState, error: stateError } = await supabase
    .from("governance_indexer_state")
    .select("last_scanned_block")
    .eq("id", network)
    .single();

  if (stateError) throw new Error(`Failed to read indexer state: ${stateError.message}`);

  let lastScanned = indexerState?.last_scanned_block || config.deployBlock;
  const currentBlock = await getCurrentBlock(config.rpcUrl);

  console.log(
    `[governance-indexer] ${network}: scanning blocks ${lastScanned} → ${currentBlock} (${currentBlock - lastScanned} blocks)`,
  );

  // 2. Scan for new ProposalCreated events in chunks
  const newProposals: ParsedProposal[] = [];
  const startBlock = lastScanned + 1;

  for (let from = startBlock; from <= currentBlock; from += MAX_BLOCK_RANGE + 1) {
    const to = Math.min(from + MAX_BLOCK_RANGE, currentBlock);

    try {
      const logs = await getLogs(
        config.rpcUrl,
        config.governor,
        [PROPOSAL_CREATED_TOPIC],
        from,
        to,
      );

      for (const log of logs) {
        const parsed = decodeProposalCreatedLog(log);
        if (parsed) {
          newProposals.push(parsed);
          console.log(
            `[governance-indexer] Found proposal ${parsed.proposalId} at block ${parsed.blockNumber}`,
          );
        }
      }
    } catch (e: any) {
      console.warn(`[governance-indexer] getLogs failed for ${from}-${to}: ${e.message}`);
      // Continue with next chunk
    }
  }

  // 3. Upsert new proposals
  for (const p of newProposals) {
    // Parse title from description
    const lines = p.description.split("\n");
    const title = lines[0].replace(/^#\s*/, "").trim().slice(0, 200) || "Untitled Proposal";

    const { error: upsertError } = await supabase
      .from("governance_proposals")
      .upsert(
        {
          proposal_id: p.proposalId,
          proposer: p.proposer,
          description: p.description,
          title,
          targets: p.targets,
          callvalues: p.values,
          calldatas: p.calldatas,
          vote_start: p.voteStart,
          vote_end: p.voteEnd,
          block_created: p.blockNumber,
          tx_hash: p.txHash,
          network,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "proposal_id" },
      );

    if (upsertError) {
      console.error(
        `[governance-indexer] Failed to upsert proposal ${p.proposalId}: ${upsertError.message}`,
      );
    }
  }

  // 4. Update state and vote tallies for all non-final proposals
  const { data: activeProposals, error: activeError } = await supabase
    .from("governance_proposals")
    .select("proposal_id, state")
    .eq("network", network)
    .not("state", "in", `(${[...FINAL_STATES].join(",")})`);

  if (activeError) {
    console.warn(`[governance-indexer] Failed to fetch active proposals: ${activeError.message}`);
  } else if (activeProposals && activeProposals.length > 0) {
    console.log(
      `[governance-indexer] Updating ${activeProposals.length} non-final proposals`,
    );

    for (const prop of activeProposals) {
      try {
        // state(uint256) — selector: 0x3e4f49e6
        const stateHex = await callContract(
          config.rpcUrl,
          config.governor,
          encodeFunctionCall("0x3e4f49e6", prop.proposal_id),
        );
        const state = decodeUint8(stateHex);

        // proposalVotes(uint256) — selector: 0x544ffc9c
        const votesHex = await callContract(
          config.rpcUrl,
          config.governor,
          encodeFunctionCall("0x544ffc9c", prop.proposal_id),
        );
        const [againstVotes, forVotes, abstainVotes] = decodeThreeUint256(votesHex);

        const { error: updateError } = await supabase
          .from("governance_proposals")
          .update({
            state,
            state_name: STATE_NAMES[state] || "Unknown",
            for_votes: formatTokens(forVotes),
            against_votes: formatTokens(againstVotes),
            abstain_votes: formatTokens(abstainVotes),
            updated_at: new Date().toISOString(),
          })
          .eq("proposal_id", prop.proposal_id);

        if (updateError) {
          console.warn(
            `[governance-indexer] Failed to update proposal ${prop.proposal_id}: ${updateError.message}`,
          );
        }
      } catch (e: any) {
        console.warn(
          `[governance-indexer] Failed to read state for ${prop.proposal_id}: ${e.message}`,
        );
      }
    }
  }

  // 5. Update the last scanned block
  const { error: updateStateError } = await supabase
    .from("governance_indexer_state")
    .update({
      last_scanned_block: currentBlock,
      updated_at: new Date().toISOString(),
    })
    .eq("id", network);

  if (updateStateError) {
    console.warn(`[governance-indexer] Failed to update indexer state: ${updateStateError.message}`);
  }

  return {
    network,
    blocksScanned: currentBlock - lastScanned,
    newProposals: newProposals.length,
    activeUpdated: activeProposals?.length || 0,
    currentBlock,
  };
}

// ── HTTP handler ────────────────────────────────────────────────────

serve(async (req: Request) => {
  try {
    // Default to mainnet, allow ?network=testnet
    const url = new URL(req.url);
    const network = url.searchParams.get("network") || "mainnet";

    const result = await indexProposals(network);

    console.log(`[governance-indexer] Completed:`, result);

    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error(`[governance-indexer] Fatal error:`, e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
