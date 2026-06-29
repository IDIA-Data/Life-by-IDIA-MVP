/**
 * relay-governance-action
 *
 * Relayer-First Governance: routes authenticated UI commands to an on-chain
 * approveAndExecute() call signed by RELAYER_PRIVATE_KEY on Base Mainnet.
 *
 * Mirrors the structural pattern of relay-usdc-transfer with stage-tagged
 * logging so Apple App Review (and our own ops) can trace every step.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6.13.0";

const ESCROW_ABI = [
  "function approveAndExecute(uint256 proposalId) external returns (bool)",
];

const IDIA_TOKEN_READ_ABI = [
  "function getPastVotes(address account, uint256 blockNumber) view returns (uint256)",
  "function getVotes(address account) view returns (uint256)",
  "function delegates(address account) view returns (address)",
];

const PROPOSAL_STATE_NAMES = [
  "Pending", "Active", "Canceled", "Defeated",
  "Succeeded", "Queued", "Expired", "Executed",
];

const IDIA_TOKEN_ADDR_FOR_VOTES = "0x6526F939D257E67896821c25B6C24Daa404a01FB";
<<<<<<< Updated upstream

=======
>>>>>>> Stashed changes
const GOVERNOR_ABI = [
  "function castVote(uint256 proposalId, uint8 support) returns (uint256)",
  "function castVoteBySig(uint256 proposalId, uint8 support, address voter, bytes signature) returns (uint256)",
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalProposer(uint256 proposalId) view returns (address)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
  "function getVotes(address account, uint256 blockNumber) view returns (uint256)",
  "function hasVoted(uint256 proposalId, address account) view returns (bool)",
  "function cancel(address[] targets, uint256[] values, bytes[] calldatas, bytes32 descriptionHash) returns (uint256)",
<<<<<<< Updated upstream
  // OpenZeppelin v5 Governor custom errors — required so ethers can decode
  // contract reverts (e.g. 0x94ab6c07) instead of dropping them as
  // "unknown custom error". Any selector not in this list will still surface
  // as raw hex via err.data in the catch handler below.
=======
  // OZ v5 Governor errors (unchanged)
>>>>>>> Stashed changes
  "error GovernorAlreadyCastVote(address voter)",
  "error GovernorAlreadyQueuedProposal(uint256 proposalId)",
  "error GovernorDisabledDeposit()",
  "error GovernorInsufficientProposerVotes(address proposer, uint256 votes, uint256 threshold)",
  "error GovernorInvalidProposalLength(uint256 targets, uint256 calldatas, uint256 values)",
<<<<<<< Updated upstream
  "error GovernorInvalidQuorumFraction(uint256 quorumNumerator, uint256 quorumDenominator)",
=======
>>>>>>> Stashed changes
  "error GovernorInvalidSignature(address voter)",
  "error GovernorInvalidVoteParams()",
  "error GovernorInvalidVoteType()",
  "error GovernorInvalidVotingPeriod(uint256 votingPeriod)",
  "error GovernorNonexistentProposal(uint256 proposalId)",
  "error GovernorNotQueuedProposal(uint256 proposalId)",
  "error GovernorOnlyExecutor(address account)",
  "error GovernorOnlyProposer(address account)",
  "error GovernorQueueNotImplemented()",
  "error GovernorRestrictedProposer(address proposer)",
  "error GovernorUnexpectedProposalState(uint256 proposalId, uint8 current, bytes32 expectedStates)",
  "error QueueEmpty()",
  "error QueueFull()",
<<<<<<< Updated upstream
=======
  // V3 adjustable quorum errors
  "error NotExecutor()",
  "error NotSafe()",
  "error BelowFloor(uint256 proposed, uint256 floor)",
  "error AboveCeiling(uint256 proposed, uint256 ceiling)",
>>>>>>> Stashed changes
];

// Decode an ethers v6 contract revert into { name, args, selector } using the
// fragments registered in GOVERNOR_ABI. Falls back to the 4-byte selector when
// the revert is not in our ABI so we still log something actionable.
function decodeGovernorRevert(err: any): { name: string | null; args: string[]; selector: string | null } {
  const name = err?.revert?.name ?? err?.errorName ?? null;
  const rawArgs = err?.revert?.args;
  const args = rawArgs ? Array.from(rawArgs).map((v: unknown) => String(v)) : [];
  const data: string | undefined = err?.data ?? err?.info?.error?.data ?? err?.error?.data;
  const selector = typeof data === "string" && data.startsWith("0x") ? data.slice(0, 10) : null;
  return { name, args, selector };
}


// Default fallback target for basic signaling proposals — matches
// governanceService.propose() defaults so descriptionHash + arrays line up.
const IDIA_TOKEN_ADDRESS = "0x6526F939D257E67896821c25B6C24Daa404a01FB";

const NETWORKS: Record<
  number,
  { rpcUrlFallback: string; targets: Record<string, string>; governor: string; name: string }
> = {
  8453: {
    name: "Base",
    rpcUrlFallback: "https://mainnet.base.org",
<<<<<<< Updated upstream
    governor: "0x9777067CAd2892D20decAF1a5ccb78e6B291B87a",
=======
    governor: Deno.env.get("GOVERNOR_ADDRESS") || "0x9777067CAd2892D20decAF1a5ccb78e6B291B87a",
>>>>>>> Stashed changes
    targets: {
      team: "0xF0E67683783ef5879b43ef99ab04Bc27A9a71074",
      ecosystem: "0xd052C6F3846b4Fe56E579880Ec9ea2764ABDe708",
    },
  },
};

const ALLOWED_ACTIONS = new Set(["APPROVE_AND_EXECUTE", "CAST_VOTE", "CANCEL_PROPOSAL"]);
const ALLOWED_TARGETS = new Set(["team", "ecosystem"]);
// L3 Tophat clearance — hat types that may carry the vote with Treasury weight
const TOPHAT_HAT_TYPES = ["tophat", "security_council", "admin"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}


serve(async (req) => {
  try {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  console.log("[GOV_RELAY][INIT] Inbound governance relay request received.");
  let stage = "INITIALIZATION";

  try {
    // ─── STAGE 1: PARSE_REQUEST ─────────────────────────────────────────────
    stage = "PARSE_REQUEST";
    console.log(`[GOV_RELAY][${stage}][START] Validating headers and body payload.`);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Missing user authentication token.", failed_at: stage }, 401);
    }

    console.log(
      `[GOV_RELAY][${stage}][HEADERS] method=${req.method} content-type=${req.headers.get("content-type")} content-length=${req.headers.get("content-length")}`,
    );
    console.log(`[GOV_RELAY][${stage}][AWAIT_JSON_START] Awaiting req.json()`);
    let body: any;
    try {
      body = await withTimeout(req.json(), 10_000, "req.json()");
      console.log(`[GOV_RELAY][${stage}][AWAIT_JSON_END] Successfully parsed body`);
    } catch (e: any) {
      console.error(`[GOV_RELAY][${stage}][JSON_ERROR]`, e?.message || e);
      return jsonResponse({ error: "Invalid JSON body", failed_at: stage }, 400);
    }
    const {
      actionType,
      escrowTarget,
      proposalId,
      chainId,
      actionId,
      support,
      voteWeight,
      tophatOverride,
      acaHash,
      acaPayload,
      title,
      description,
      signature: sigHex,
      voter: voterFromBody,
      voterAddress,
    } = body ?? {};
    console.log(`[GOV_RELAY][${stage}][DESTRUCTURE_OK] keys=${Object.keys(body ?? {}).join(",")}`);

    if (!actionType || !ALLOWED_ACTIONS.has(actionType)) {
      return jsonResponse({ error: `Invalid actionType: ${actionType}`, failed_at: stage }, 400);
    }
    if (actionType === "APPROVE_AND_EXECUTE" && (!escrowTarget || !ALLOWED_TARGETS.has(escrowTarget))) {
      return jsonResponse({ error: `Invalid escrowTarget: ${escrowTarget}`, failed_at: stage }, 400);
    }
    if (proposalId === undefined || proposalId === null) {
      return jsonResponse({ error: "Missing proposalId", failed_at: stage }, 400);
    }
    console.log(`[GOV_RELAY][${stage}][ACTION_VALIDATED] actionType=${actionType} escrowTarget=${escrowTarget ?? "n/a"}`);
    let onchainId: bigint;
    try {
      onchainId = BigInt(proposalId);
    } catch {
      return jsonResponse({ error: `proposalId must be numeric: ${proposalId}`, failed_at: stage }, 400);
    }
    console.log(`[GOV_RELAY][${stage}][PROPOSAL_BIGINT_OK] onchainId=${onchainId}`);
    const networkId = Number(chainId ?? 8453);
    if (networkId !== 8453) {
      return jsonResponse({ error: `Unsupported chainId: ${networkId}`, failed_at: stage }, 400);
    }
    console.log(`[GOV_RELAY][${stage}][CHAIN_VALIDATED] networkId=${networkId}`);

    // CAST_VOTE-specific validation
    let supportValue: 0 | 1 | 2 = 0;
    let signatureHex: string | null = null;
    let voteWeightNum = 0;
    if (actionType === "CAST_VOTE") {
      const normalizedSupport = support === undefined || support === null ? NaN : Number(support);
      console.log(
        `[GOV_RELAY][${stage}][VOTE_NORMALIZE] rawSupport=${support} normalizedSupport=${normalizedSupport} hasSignature=${typeof sigHex === "string" && sigHex.startsWith("0x")} sigLen=${typeof sigHex === "string" ? sigHex.length : 0}`,
      );
      if (support === undefined || support === null) {
        return jsonResponse({ error: "Missing support value before vote serialization.", failed_at: stage }, 400);
      }
      if (normalizedSupport !== 0 && normalizedSupport !== 1 && normalizedSupport !== 2) {
        return jsonResponse({ error: `Invalid support value: ${support}`, failed_at: stage }, 400);
      }
      supportValue = normalizedSupport as 0 | 1 | 2;
      // voteWeight is informational only — OpenZeppelin Governor reads weight
      // from the snapshot block on-chain. Do NOT reject when missing/zero.
      const parsedWeight = Number(voteWeight);
      voteWeightNum = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0;
      if (!acaHash || typeof acaHash !== "string") {
        return jsonResponse({ error: "Missing acaHash", failed_at: stage }, 400);
      }
      // Standard (non-override) votes are gasless: client MUST supply an
      // EIP-712 Ballot signature (OZ v5: single packed bytes). Tophat override skips this.
      if (tophatOverride !== true) {
        const sigOk = typeof sigHex === "string" && sigHex.startsWith("0x") && sigHex.length === 132;
        if (!sigOk) {
          return jsonResponse(
            { error: `Invalid or missing EIP-712 Ballot signature (expected 65-byte hex). got=${typeof sigHex === "string" ? `${sigHex.length}chars` : typeof sigHex}`, failed_at: stage },
            400,
          );
        }
        signatureHex = sigHex as string;
      }
    }

    // CANCEL_PROPOSAL-specific validation
    if (actionType === "CANCEL_PROPOSAL") {
      if (!title || typeof title !== "string") {
        return jsonResponse({ error: "Missing proposal title", failed_at: stage }, 400);
      }
      if (!description || typeof description !== "string") {
        return jsonResponse({ error: "Missing proposal description", failed_at: stage }, 400);
      }
      if (!acaHash || typeof acaHash !== "string") {
        return jsonResponse({ error: "Missing acaHash", failed_at: stage }, 400);
      }
      if (!acaPayload || typeof acaPayload !== "object") {
        return jsonResponse({ error: "Missing acaPayload", failed_at: stage }, 400);
      }
    }
    console.log(`[GOV_RELAY][${stage}][BRANCH_VALIDATED] branch=${actionType}`);
    if (actionType === "CAST_VOTE") {
      console.log(
        `[GOV_RELAY][${stage}][VOTE_INGEST_LAYOUT] rawSupport=${support} normalizedSupport=${supportValue} hasSignature=${!!signatureHex} sigLen=${signatureHex?.length ?? 0} voter=${voterFromBody ?? voterAddress ?? "(missing)"} tophatOverride=${!!tophatOverride}`,
      );
    }
    console.log(
      `[GOV_RELAY][${stage}][SUCCESS] action=${actionType} proposalId=${onchainId} chainId=${networkId} override=${!!tophatOverride}`,
    );

    // ─── STAGE 2: VERIFY_IDENTITY ───────────────────────────────────────────
    stage = "VERIFY_IDENTITY";
    console.log(`[GOV_RELAY][${stage}][START] Confirming session validity via Supabase Auth.`);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    console.log(
      `[GOV_RELAY][${stage}][ENV_CHECK] hasUrl=${!!SUPABASE_URL} hasServiceKey=${!!SERVICE_ROLE_KEY}`,
    );
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      return jsonResponse({ error: "Supabase env vars missing.", failed_at: stage }, 500);
    }

    console.log(`[GOV_RELAY][${stage}][CREATE_CLIENT_START]`);
    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log(`[GOV_RELAY][${stage}][CREATE_CLIENT_END]`);

    const token = authHeader.replace("Bearer ", "");
    console.log(`[GOV_RELAY][${stage}][TOKEN_EXTRACT_OK] tokenLen=${token.length}`);
    console.log(
      `[GOV_RELAY][${stage}][AUTH_API_PROBE] hasAuth=${!!supabaseAdmin.auth} hasGetUser=${typeof supabaseAdmin.auth?.getUser === "function"}`,
    );

    console.log(`[GOV_RELAY][${stage}][AWAIT_CLAIMS_START]`);
    const { data: userData, error: userError } = await withTimeout(
      supabaseAdmin.auth.getUser(token),
      8_000,
      "auth.getUser()",
    );
    console.log(`[GOV_RELAY][${stage}][AWAIT_CLAIMS_END] error=${!!userError}`);
    if (userError || !userData?.user?.id) {
      return jsonResponse({ error: "Session verification failed.", failed_at: stage }, 401);
    }
    const userId = userData.user.id;
    console.log(`[GOV_RELAY][${stage}][SUCCESS] Authorized user ${userId}`);

    // ─── STAGE 3: CONNECT_BLOCKCHAIN ────────────────────────────────────────
    stage = "CONNECT_BLOCKCHAIN";
    console.log(`[GOV_RELAY][${stage}][START] Initializing JSON-RPC provider.`);

    const networkConfig = NETWORKS[networkId]!;
    const rpcUrl = Deno.env.get("ALCHEMY_BASE_RPC_URL") || networkConfig.rpcUrlFallback;
    console.log(`[GOV_RELAY][RPC_SETUP][URL] using=${rpcUrl.includes("alchemy") ? "alchemy" : "public-base"}`);
    const relayerKey = Deno.env.get("RELAYER_PRIVATE_KEY");
    if (!relayerKey) {
      return jsonResponse({ error: "RELAYER_PRIVATE_KEY unbound.", failed_at: stage }, 500);
    }

    console.log(`[GOV_RELAY][RPC_SETUP][PROVIDER_INIT_START]`);
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    console.log(`[GOV_RELAY][RPC_SETUP][PROVIDER_INIT_END]`);

    console.log(`[GOV_RELAY][RPC_SETUP][WALLET_BIND_START]`);
    const relayerWallet = new ethers.Wallet(relayerKey, provider);
    console.log(`[GOV_RELAY][RPC_SETUP][WALLET_BIND_END] address=${relayerWallet.address}`);

    console.log(`[GOV_RELAY][RPC_SETUP][GET_BALANCE_START]`);
    const gasBalance = await withTimeout(
      provider.getBalance(relayerWallet.address),
      8_000,
      "provider.getBalance()",
    );
    console.log(`[GOV_RELAY][RPC_SETUP][GET_BALANCE_END] balance=${ethers.formatEther(gasBalance)} ETH`);
    if (gasBalance === 0n) {
      return jsonResponse({ error: "Relayer wallet has no gas funds.", failed_at: stage }, 500);
    }
    console.log(`[GOV_RELAY][${stage}][SUCCESS] Provider and wallet bound.`);

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH: CANCEL_PROPOSAL (only the proposer may cancel while Pending)
    // ════════════════════════════════════════════════════════════════════════
    if (actionType === "CANCEL_PROPOSAL") {
      const TAG = "CANCEL_PROPOSAL";

      // STAGE 3.5: AUTHORIZE — DB row ownership + Governor state + Relayer proposer parity
      stage = "AUTHORIZE_CANCEL";
      console.log(`[GOV_RELAY][${TAG}][${stage}][START] proposalId=${onchainId} user=${userId}`);

      const { data: row, error: rowErr } = await supabaseAdmin
        .from("dao_proposals")
        .select("id, proposer_id, on_chain_id, proposal_targets, proposal_values, proposal_calldatas")
        .eq("on_chain_id", onchainId.toString())
        .maybeSingle();
      if (rowErr) {
        console.error(`[GOV_RELAY][${TAG}][${stage}] dao_proposals lookup failed: ${rowErr.message}`);
        return jsonResponse({ error: "Proposal lookup failed.", failed_at: stage }, 500);
      }
      const { data: indexedRow, error: indexedErr } = !row
        ? await supabaseAdmin
            .from("governance_proposals")
            .select("proposal_id, proposer, targets, callvalues, calldatas, description")
            .eq("proposal_id", onchainId.toString())
            .maybeSingle()
        : { data: null, error: null };
      if (indexedErr) {
        console.error(`[GOV_RELAY][${TAG}][${stage}] governance_proposals lookup failed: ${indexedErr.message}`);
        return jsonResponse({ error: "Indexed proposal lookup failed.", failed_at: stage }, 500);
      }
      if (!row && !indexedRow) {
        return jsonResponse({ error: "Proposal not found in ledger.", failed_at: stage }, 404);
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("wallet_address")
        .eq("id", userId)
        .maybeSingle();
      const requesterWallet = String(profile?.wallet_address || "").toLowerCase();
      const indexedProposer = String(indexedRow?.proposer || "").toLowerCase();
      if (row?.proposer_id !== userId && (!indexedProposer || indexedProposer !== requesterWallet)) {
        return jsonResponse({ error: "Only the proposer may cancel this proposal.", failed_at: stage }, 403);
      }

      const govRead = new ethers.Contract(networkConfig.governor, GOVERNOR_ABI, provider);
      let chainState: number;
      let onchainProposer: string;
      try {
        console.log(`[GOV_RELAY][${TAG}][CONTRACT_READ][START] state(${onchainId}) + proposalProposer(${onchainId})`);
        const [s, p] = await withTimeout(
          Promise.all([
            govRead.state(onchainId),
            govRead.proposalProposer(onchainId),
          ]),
          10_000,
          "governor.state+proposer",
        );
        chainState = Number(s);
        onchainProposer = String(p);
        console.log(`[GOV_RELAY][${TAG}][CONTRACT_READ][END] state=${chainState} proposer=${onchainProposer}`);
      } catch (readErr: any) {
        console.error(`[GOV_RELAY][${TAG}][${stage}] chain read failed: ${readErr.message}`);
        return jsonResponse({ error: "Could not read proposal state on-chain.", failed_at: stage }, 502);
      }
      if (chainState !== 0) {
        return jsonResponse(
          { error: `Proposal is no longer in Pending (state=${chainState}). Cancellation window closed.`, failed_at: stage },
          409,
        );
      }
      if (onchainProposer.toLowerCase() !== relayerWallet.address.toLowerCase()) {
        return jsonResponse(
          { error: "Relayer is not the on-chain proposer. Cancellation refused.", failed_at: stage },
          409,
        );
      }
      console.log(`[GOV_RELAY][${TAG}][${stage}][SUCCESS] state=0, proposer parity OK`);

      // STAGE 4: REBUILD_ARGS — prefer stored arrays, fall back to signaling defaults
      stage = "REBUILD_ARGS";
      const storedTargets = Array.isArray(row?.proposal_targets)
        ? row.proposal_targets
        : Array.isArray(indexedRow?.targets) ? indexedRow.targets : null;
      const storedValues = Array.isArray(row?.proposal_values)
        ? row.proposal_values
        : Array.isArray(indexedRow?.callvalues) ? indexedRow.callvalues.map((v: unknown) => String(v)) : null;
      const storedCalldatas = Array.isArray(row?.proposal_calldatas)
        ? row.proposal_calldatas
        : Array.isArray(indexedRow?.calldatas) ? indexedRow.calldatas : null;

      const hasStored = !!(storedTargets && storedValues && storedCalldatas
        && storedTargets.length > 0
        && storedTargets.length === storedValues.length
        && storedTargets.length === storedCalldatas.length);

      const targets: string[] = hasStored ? storedTargets! : [IDIA_TOKEN_ADDRESS];
      const values: bigint[] = hasStored
        ? storedValues!.map((v: string) => BigInt(v))
        : [0n];
      const calldatas: string[] = hasStored ? storedCalldatas! : ["0x"];

      const originalDescription = indexedRow?.description || (row
        ? `# ${title}\n\n${description}\n\n---\n*System Ref: ${row.id}*`
        : String(description || ""));
      const descriptionHash = ethers.keccak256(ethers.toUtf8Bytes(originalDescription));
      console.log(
        `[GOV_RELAY][${TAG}][${stage}] mode=${hasStored ? "stored" : "defaults"} arity=${targets.length} descHash=${descriptionHash.substring(0, 10)}…`,
      );

      // STAGE 5: BROADCAST_TRANSACTION
      stage = "BROADCAST_TRANSACTION";
      const gov = new ethers.Contract(networkConfig.governor, GOVERNOR_ABI, relayerWallet);
      let tx: any;
      let receipt: any;
      try {
        console.log(`[GOV_RELAY][${TAG}][${stage}][AWAIT_SUBMIT_START] gov.cancel()`);
        tx = await gov.cancel(targets, values, calldatas, descriptionHash);
        console.log(`[GOV_RELAY][${TAG}][${stage}] Tx submitted: ${tx.hash}`);

        stage = "AWAIT_CONFIRMATION";
        receipt = await tx.wait();
        console.log(`[GOV_RELAY][${TAG}][${stage}][SUCCESS] Block ${receipt.blockNumber}`);
      } catch (txErr: any) {
        const { name: decodedName, args: decodedArgs, selector } = decodeGovernorRevert(txErr);
        console.error(
          `[GOV_RELAY][${TAG}][FATAL_STALL] cancel() reverted. ` +
            `Reason: ${decodedName ?? "Unknown"} selector=${selector ?? "n/a"} ` +
            `args=[${decodedArgs.join(",")}] raw=${txErr?.shortMessage ?? txErr?.message}`,
        );
        return jsonResponse(
          {
            error: "Governor reverted cancel(). Arguments may not match the original propose() or proposal is no longer cancellable.",
            failed_at: stage,
            decoded_error: decodedName,
            decoded_args: decodedArgs,
            error_selector: selector,
            detail: txErr.shortMessage || txErr.message,
          },
          409,
        );
      }



      // STAGE 6: RECONCILE_DATABASE — flip row + ACA ledger + audit log
      stage = "RECONCILE_DATABASE";
      const { error: updErr } = row
        ? await supabaseAdmin
            .from("dao_proposals")
            .update({ status: "cancelled", lifecycle_phase: "cancelled" })
            .eq("id", row.id)
        : await supabaseAdmin
            .from("governance_proposals")
            .update({ state: 2, state_name: "Canceled" })
            .eq("proposal_id", onchainId.toString());
      if (updErr) {
        console.error(`[GOV_RELAY][${TAG}][${stage}] proposal update failed: ${updErr.message}`);
      }

      try {
        const { recordACA } = await import("../_shared/recordACA.ts");
        await recordACA(supabaseAdmin, {
          userId,
          sourceId: "GOV_PROPOSAL_CANCEL",
          consentType: "governance_cancel",
          hash: acaHash,
          payload: acaPayload,
          txHash: tx.hash,
        });
      } catch (acaErr: any) {
        console.error(`[GOV_RELAY][${TAG}][${stage}] recordACA failed: ${acaErr.message}`);
      }

      try {
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          transaction_type: "governance_cancel",
          amount: 0,
          description: `Cancelled proposal ${onchainId}`,
          metadata: {
            tx_hash: tx.hash,
            block_number: receipt.blockNumber,
            target_contract: networkConfig.governor,
            proposal_id: onchainId.toString(),
            action_type: actionType,
            chain_id: networkId,
            network: networkConfig.name,
            relayed_by: relayerWallet.address,
            arg_mode: hasStored ? "stored" : "defaults",
            arg_arity: targets.length,
            aca_hash: acaHash,
          },
        });
      } catch (auditErr: any) {
        console.error(`[GOV_RELAY][${TAG}][${stage}] transactions insert failed: ${auditErr.message}`);
      }
      console.log(`[GOV_RELAY][${TAG}][${stage}][SUCCESS] Cancellation reconciled.`);

      return jsonResponse({
        success: true,
        mode: "cancel_proposal",
        tx_hash: tx.hash,
        block_number: receipt.blockNumber,
        target_contract: networkConfig.governor,
        network: networkConfig.name,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH: CAST_VOTE (standard or Tophat Override)
    // ════════════════════════════════════════════════════════════════════════
    if (actionType === "CAST_VOTE") {
      // STAGE 3.5: ROLE_CHECK (only when override requested — never trust client flag)
      let overrideAuthorized = false;
      if (tophatOverride === true) {
        stage = "ROLE_CHECK";
        console.log(`[GOV_RELAY][TOPHAT_OVERRIDE][${stage}][START] Validating L3 clearance for ${userId}`);
        const { data: hats, error: hatsErr } = await supabaseAdmin
          .from("dao_hats")
          .select("hat_type")
          .eq("user_id", userId)
          .eq("eligibility_status", "active")
          .is("revoked_at", null)
          .in("hat_type", TOPHAT_HAT_TYPES);
        if (hatsErr) {
          console.error(`[GOV_RELAY][TOPHAT_OVERRIDE][${stage}] dao_hats query failed: ${hatsErr.message}`);
          return jsonResponse({ error: "Role verification failed.", failed_at: stage }, 500);
        }
        if (!hats || hats.length === 0) {
          console.warn(`[GOV_RELAY][TOPHAT_OVERRIDE][${stage}][DENIED] user ${userId} lacks L3 hat`);
          return jsonResponse(
            { error: "Tophat clearance required to carry the vote.", failed_at: stage },
            403,
          );
        }
        overrideAuthorized = true;
        console.log(`[GOV_RELAY][TOPHAT_OVERRIDE][${stage}][SUCCESS] hats=${hats.map((h: any) => h.hat_type).join(",")}`);
      }

      // STAGE 3.7: PREFLIGHT_SNAPSHOT — gasless path only. Hard-stop any
      // wallet that had zero voting weight at the snapshot block (or has
      // already voted) BEFORE the relayer wastes a single wei of gas.
      let preflightAddr: string | null = null;
      let preflightSnapshotBlock: bigint | null = null;
      let preflightWeight: bigint | null = null;
      let preflightProposalState: number | null = null;
      if (!overrideAuthorized) {
        stage = "PREFLIGHT_SNAPSHOT";
        console.log(`[GOV_RELAY][STANDARD_VOTE][${stage}][START]`);
        const govRead = new ethers.Contract(networkConfig.governor, GOVERNOR_ABI, provider);
        const tokenRead = new ethers.Contract(IDIA_TOKEN_ADDR_FOR_VOTES, IDIA_TOKEN_READ_ABI, provider);

        const snapshotBlock = await withTimeout(
          govRead.proposalSnapshot(onchainId),
          8_000,
          "governor.proposalSnapshot()",
        );
        preflightSnapshotBlock = BigInt(snapshotBlock);

        // Proposal state check
        const propState = Number(await withTimeout(
          govRead.state(onchainId),
          8_000,
          "governor.state()",
        ));
        preflightProposalState = propState;
        const propStateName = PROPOSAL_STATE_NAMES[propState] ?? `Unknown(${propState})`;
        console.log(`[GOV_RELAY][STATE_CHECK] proposal=${onchainId} state=${propState} (${propStateName}) snapshotBlock=${preflightSnapshotBlock}`);

        if (propState !== 1) {
          console.error(`[GOV_RELAY][STATE_CHECK][FATAL] Proposal not Active. state=${propState} (${propStateName})`);
          return jsonResponse(
            {
              error: `Voting is not open. Proposal state: ${propStateName}.`,
              failed_at: stage,
              state_conflict: "inactive_proposal",
              proposal_state: propState,
              proposal_state_name: propStateName,
              snapshot_block: preflightSnapshotBlock.toString(),
            },
            409,
          );
        }

        let checkAddr: string | undefined =
          typeof voterAddress === "string" && voterAddress.startsWith("0x")
            ? voterAddress
            : undefined;
        if (!checkAddr) {
          const { data: profile } = await supabaseAdmin
            .from("profiles")
            .select("wallet_address")
            .eq("id", userId)
            .maybeSingle();
          checkAddr = (profile?.wallet_address as string | undefined) ?? undefined;
        }
        if (!checkAddr || !ethers.isAddress(checkAddr)) {
          console.error(
            `[GOV_RELAY][STANDARD_VOTE][${stage}][FATAL] No wallet address resolvable for user ${userId}.`,
          );
          return jsonResponse(
            { error: "No sovereign wallet on profile for snapshot verification.", failed_at: stage },
            400,
          );
        }
        preflightAddr = checkAddr;

        // 1. Strict weight enforcement — zero weight is a fatal rejection.
        // Prefer token.getPastVotes (canonical ERC20Votes); fallback to gov.getVotes.
        let weight: bigint;
        try {
          weight = await withTimeout(
            tokenRead.getPastVotes(checkAddr, preflightSnapshotBlock),
            8_000,
            "token.getPastVotes()",
          );
          console.log(`[GOV_RELAY][STATE_CHECK] Voter weight at snapshot block ${preflightSnapshotBlock}: ${weight} (via token.getPastVotes)`);
        } catch (e: any) {
          console.warn(`[GOV_RELAY][STATE_CHECK] token.getPastVotes failed, falling back to gov.getVotes: ${e?.message}`);
          weight = await withTimeout(
            govRead.getVotes(checkAddr, preflightSnapshotBlock),
            8_000,
            "governor.getVotes()",
          );
          console.log(`[GOV_RELAY][STATE_CHECK] Voter weight at snapshot block ${preflightSnapshotBlock}: ${weight} (via gov.getVotes)`);
        }
        preflightWeight = BigInt(weight);

        try {
          const currentDelegate = await tokenRead.delegates(checkAddr);
          console.log(`[GOV_RELAY][STATE_CHECK] Voter ${checkAddr} current delegate=${currentDelegate}`);
        } catch { /* non-fatal */ }

        if (preflightWeight === 0n) {
          console.error(
            `[GOV_RELAY][STANDARD_VOTE][${stage}][FATAL] Wallet ${checkAddr} attempted to vote with 0 weight at block ${preflightSnapshotBlock}. Reverting.`,
          );
          return jsonResponse(
            {
              error: "Wallet had zero voting power at this proposal's snapshot block. Delegate to self BEFORE the next proposal is created, then vote on the next one.",
              failed_at: stage,
              state_conflict: "zero_snapshot_power",
              snapshot_block: preflightSnapshotBlock.toString(),
              snapshot_weight: "0",
              voter: checkAddr,
            },
            409,
          );
        }

        // 2. Double-vote protection — only runs if they have weight.
        const alreadyVoted = await withTimeout(
          govRead.hasVoted(onchainId, checkAddr),
          8_000,
          "governor.hasVoted()",
        );
        if (alreadyVoted) {
          console.warn(
            `[GOV_RELAY][STANDARD_VOTE][${stage}][WARN] Wallet ${checkAddr} has already cast a ballot.`,
          );
          return jsonResponse(
            {
              error: "This wallet has already voted on-chain for this proposal.",
              failed_at: stage,
              state_conflict: "already_voted",
              voter: checkAddr,
            },
            409,
          );
        }

        console.log(
          `[GOV_RELAY][STANDARD_VOTE][${stage}][SUCCESS] Wallet ${checkAddr} verified weight=${preflightWeight} state=${propStateName}`,
        );
      }

      // STAGE 4: BROADCAST_TRANSACTION — Treasury/Relayer wallet broadcasts the vote
      stage = "BROADCAST_TRANSACTION";
      const tag = overrideAuthorized ? "TOPHAT_OVERRIDE" : "STANDARD_VOTE";
      const via = overrideAuthorized ? "castVote" : "castVoteBySig";
      console.log(
        `[GOV_RELAY][${tag}][${stage}][START] ${via}(${onchainId}, ${supportValue}) -> ${networkConfig.governor}`,
      );
      const gov = new ethers.Contract(networkConfig.governor, GOVERNOR_ABI, relayerWallet);
      console.log(`[GOV_RELAY][${tag}][${stage}][AWAIT_SUBMIT_START] gov.${via}()`);
      let tx: any;
      let receipt: any;
      try {
        if (overrideAuthorized) {
          tx = await gov.castVote(onchainId, supportValue);
        } else {
          if (!signatureHex) {
            return jsonResponse({ error: "Missing EIP-712 signature for gasless vote.", failed_at: stage }, 400);
          }
          if (!preflightAddr || !ethers.isAddress(preflightAddr)) {
            return jsonResponse({ error: "Missing or invalid voter address for v5 castVoteBySig broadcast.", failed_at: stage }, 400);
          }

          // Surgical v-byte normalization on the raw 65-byte hex suffix.
          // OZ v5 SignatureChecker requires v ∈ {27, 28}; wallets sometimes emit 0/1.
          console.log("[GOV_RELAY][STANDARD_VOTE][NORMALIZE][START] Inspecting raw signature hex for y-parity anomalies.");
          let finalSignatureHex = signatureHex;
          if (finalSignatureHex && finalSignatureHex.startsWith("0x") && finalSignatureHex.length === 132) {
            const vHex = finalSignatureHex.slice(-2);
            let vNum = parseInt(vHex, 16);
            if (vNum === 0 || vNum === 1) {
              vNum += 27;
              finalSignatureHex = finalSignatureHex.slice(0, -2) + vNum.toString(16).padStart(2, "0");
              console.log(`[GOV_RELAY][STANDARD_VOTE][NORMALIZE][SUCCESS] Mutated signature hex suffix from ${vHex} to ${vNum.toString(16)}`);
            } else {
              console.log(`[GOV_RELAY][STANDARD_VOTE][NORMALIZE][SKIP] Signature v-byte is already normalized: ${vNum}`);
            }
          } else {
            console.warn(`[GOV_RELAY][STANDARD_VOTE][NORMALIZE][WARN] Signature length irregular: ${finalSignatureHex?.length}. Proceeding without mutation.`);
          }

          console.log("[GOV_RELAY][STANDARD_VOTE][BROADCAST][START] Pushing v5 payload to EVM mempool.");
          console.log(
            `[GOV_VOTE][ALIGNMENT][SUCCESS] castVoteBySig(${onchainId}, ${supportValue}, ${preflightAddr}, <bytes>) -> ${networkConfig.governor}`,
          );
          tx = await gov.castVoteBySig(onchainId, supportValue, preflightAddr, finalSignatureHex);
          console.log(`[GOV_RELAY][STANDARD_VOTE][BROADCAST][SUCCESS] Transaction acquired hash: ${tx.hash}`);
        }
        console.log(`[GOV_RELAY][${tag}][${stage}] Tx submitted: ${tx.hash}`);

        stage = "AWAIT_CONFIRMATION";
        receipt = await tx.wait();
        if (receipt.status === 0) {
          console.error(`[GOV_RELAY][${tag}][AWAIT_CONFIRMATION][REVERT_ON_CHAIN] tx=${tx.hash} block=${receipt.blockNumber} — mined but reverted. Inspect BaseScan trace.`);
          return jsonResponse(
            {
              error: "Vote transaction was mined but reverted on-chain. Inspect BaseScan trace for exact reason.",
              failed_at: "AWAIT_CONFIRMATION",
              state_conflict: "onchain_revert",
              tx_hash: tx.hash,
              block_number: receipt.blockNumber,
              voter: preflightAddr,
              snapshot_block: preflightSnapshotBlock?.toString() ?? null,
              snapshot_weight: preflightWeight?.toString() ?? null,
              proposal_state: preflightProposalState,
              proposal_state_name: preflightProposalState != null ? (PROPOSAL_STATE_NAMES[preflightProposalState] ?? null) : null,
            },
            409,
          );
        }
        console.log(`[GOV_RELAY][${tag}][${stage}][SUCCESS] Block ${receipt.blockNumber}`);
      } catch (txErr: any) {
        const { name: decodedName, args: decodedArgs, selector } = decodeGovernorRevert(txErr);
        console.error(
          `[GOV_RELAY][${tag}][FATAL_STALL] Governor rejected vote for ${preflightAddr}. ` +
            `Reason: ${decodedName ?? "Unknown"} selector=${selector ?? "n/a"} ` +
            `args=[${decodedArgs.join(",")}] raw=${txErr?.shortMessage ?? txErr?.message}`,
        );
        return jsonResponse(
          {
            error: "Governor reverted the vote transaction.",
            failed_at: "BROADCAST_TRANSACTION",
            decoded_error: decodedName,
            decoded_args: decodedArgs,
            error_selector: selector,
            voter: preflightAddr,
            snapshot_block: preflightSnapshotBlock?.toString() ?? null,
            snapshot_weight: preflightWeight?.toString() ?? null,
            proposal_state: preflightProposalState,
            proposal_state_name: preflightProposalState != null ? (PROPOSAL_STATE_NAMES[preflightProposalState] ?? null) : null,
            via,
            detail: txErr?.shortMessage ?? txErr?.message,
          },
          409,
        );
      }


      // STAGE 6: RECONCILE_DATABASE
      stage = "RECONCILE_DATABASE";
      try {
        await supabaseAdmin.from("transactions").insert({
          user_id: userId,
          transaction_type: overrideAuthorized ? "governance_tophat_override" : "governance_vote",
          amount: 0,
          description: `Governance ${tag} on proposal ${onchainId}`,
          metadata: {
            tx_hash: tx.hash,
            block_number: receipt.blockNumber,
            target_contract: networkConfig.governor,
            proposal_id: onchainId.toString(),
            support: supportValue,
            vote_weight: voteWeightNum,
            tophat_override: overrideAuthorized,
            voter_address: preflightAddr,
            via,
            aca_hash: acaHash,
            action_type: actionType,
            chain_id: networkId,
            network: networkConfig.name,
            relayed_by: relayerWallet.address,
          },
        });
      } catch (auditErr: any) {
        console.error(`[GOV_RELAY][${tag}][${stage}] transactions insert failed: ${auditErr.message}`);
      }
      console.log(`[GOV_RELAY][${tag}][${stage}][SUCCESS] Reconciliation complete.`);

      return jsonResponse({
        success: true,
        mode: overrideAuthorized ? "tophat_override" : "standard_vote",
        tx_hash: tx.hash,
        block_number: receipt.blockNumber,
        target_contract: networkConfig.governor,
        network: networkConfig.name,
      });
    }

    // ════════════════════════════════════════════════════════════════════════
    // BRANCH: APPROVE_AND_EXECUTE (existing escrow flow)
    // ════════════════════════════════════════════════════════════════════════
    // ─── STAGE 4: BROADCAST_TRANSACTION ─────────────────────────────────────
    stage = "BROADCAST_TRANSACTION";
    const targetContractAddress = networkConfig.targets[escrowTarget];
    console.log(
      `[GOV_RELAY][${stage}][START] approveAndExecute(${onchainId}) -> ${targetContractAddress}`,
    );

    const escrowContract = new ethers.Contract(targetContractAddress, ESCROW_ABI, relayerWallet);
    console.log(`[GOV_RELAY][${stage}][AWAIT_SUBMIT_START] escrow.approveAndExecute()`);
    const tx = await escrowContract.approveAndExecute(onchainId);
    console.log(`[GOV_RELAY][${stage}] Tx submitted: ${tx.hash}`);

    // ─── STAGE 5: AWAIT_CONFIRMATION ────────────────────────────────────────
    stage = "AWAIT_CONFIRMATION";
    console.log(`[GOV_RELAY][${stage}][START] Awaiting receipt.`);
    const receipt = await tx.wait();
    console.log(`[GOV_RELAY][${stage}][SUCCESS] Block ${receipt.blockNumber}`);

    // ─── STAGE 6: RECONCILE_DATABASE ────────────────────────────────────────
    stage = "RECONCILE_DATABASE";
    console.log(`[GOV_RELAY][${stage}][START] Reconciling local DB state.`);

    if (actionId) {
      const { error: updErr } = await supabaseAdmin
        .from("dao_pending_actions")
        .update({
          status: "executed",
          tx_hash: tx.hash,
          processed_at: new Date().toISOString(),
        })
        .eq("id", actionId);
      if (updErr) console.error(`[GOV_RELAY][${stage}] dao_pending_actions update failed: ${updErr.message}`);
    }

    try {
      await supabaseAdmin.from("transactions").insert({
        user_id: userId,
        transaction_type: "governance_execution",
        amount: 0,
        description: `Governance ${actionType} on ${escrowTarget}`,
        metadata: {
          tx_hash: tx.hash,
          block_number: receipt.blockNumber,
          target_contract: targetContractAddress,
          proposal_id: onchainId.toString(),
          action_type: actionType,
          escrow_target: escrowTarget,
          chain_id: networkId,
          network: networkConfig.name,
          relayed_by: relayerWallet.address,
        },
      });
    } catch (auditErr: any) {
      console.error(`[GOV_RELAY][${stage}] transactions insert failed: ${auditErr.message}`);
    }

    console.log(`[GOV_RELAY][${stage}][SUCCESS] Reconciliation complete.`);

    return jsonResponse({
      success: true,
      tx_hash: tx.hash,
      block_number: receipt.blockNumber,
      target_contract: targetContractAddress,
      network: networkConfig.name,
    });
  } catch (err: any) {
    console.error(`[GOV_RELAY][FAILED] at [${stage}]: ${err.message}`);
    return jsonResponse(
      { error: err.message || "Governance relay failed.", failed_at: stage },
      500,
    );
  }
  } catch (error: any) {
    console.error("[GOV_RELAY][FATAL_CRASH] Uncaught exception in edge function:", error?.message || error, error?.stack);
    return new Response(
      JSON.stringify({ error: "Internal Server Error", details: error?.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
