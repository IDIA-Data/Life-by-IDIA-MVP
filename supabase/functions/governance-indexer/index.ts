/**
 * governance-indexer
 *
 * Log Sync Scanner — reconciles `public.governance_proposals` rows whose
 * on-chain state hasn't been resolved yet. Triggered with an empty body
 * by `governanceService.triggerIndexer()` immediately after a successful
 * propose() / castVote() / cancel() write, and safe to re-run on a cron.
 *
 * For each pending row we poll `governor.state(proposalId)` up to 5x with
 * a 2.5s backoff to absorb Base RPC node latency between block inclusion
 * and node-side proposal indexing. Per-row failures are isolated — one
 * un-anchored proposal does NOT abort the batch; it's left for the next
 * sweep.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "npm:ethers@6.13.0";

const GOVERNOR_ADDRESS = "0x9777067CAd2892D20decAF1a5ccb78e6B291B87a";
const BASE_RPC_FALLBACK = "https://mainnet.base.org";

const GOVERNOR_ABI = [
  "function state(uint256 proposalId) view returns (uint8)",
  "function proposalSnapshot(uint256 proposalId) view returns (uint256)",
  "function proposalDeadline(uint256 proposalId) view returns (uint256)",
  "function proposalProposer(uint256 proposalId) view returns (address)",
  "function proposalVotes(uint256 proposalId) view returns (uint256 againstVotes, uint256 forVotes, uint256 abstainVotes)",
];

const PROPOSAL_STATES = [
  "Pending",
  "Active",
  "Canceled",
  "Defeated",
  "Succeeded",
  "Queued",
  "Expired",
  "Executed",
];

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

    console.log("[INDEXER][INIT] Inbound governance-indexer sweep request.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[INDEXER][FATAL] Missing Supabase env.");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rpcUrl = Deno.env.get("BASE_RPC_URL") ?? BASE_RPC_FALLBACK;
    const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    const gov = new ethers.Contract(GOVERNOR_ADDRESS, GOVERNOR_ABI, provider);

    // ── LOAD_PENDING ────────────────────────────────────────────────
    console.log("[INDEXER][LOAD_PENDING][START] Fetching un-indexed rows from governance_proposals");
    let pendingRows: any[] = [];
    let dbAttempts = 0;
    const maxDbAttempts = 3;
    while (dbAttempts < maxDbAttempts) {
      dbAttempts++;
      // Non-terminal Governor states: 0=Pending, 1=Active, 5=Queued.
      // Terminal (skip): 2=Canceled, 3=Defeated, 4=Succeeded, 6=Expired, 7=Executed.
      const { data, error } = await supabaseAdmin
        .from("governance_proposals")
        .select("proposal_id, description, targets, callvalues, calldatas")
        .in("state", [0, 1, 5])
        .limit(25);

      if (error) {
        console.error(`[INDEXER][LOAD_PENDING][FATAL] Database query error:`, error);
        return jsonResponse({ error: error.message }, 500);
      }

      if (data && data.length > 0) {
        pendingRows = data;
        break;
      }

      if (dbAttempts < maxDbAttempts) {
        console.log(
          `[INDEXER][LOAD_PENDING][RETRY] 0 rows found. Attempt ${dbAttempts}/${maxDbAttempts}. Waiting 1500ms for DB write to commit...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    console.log(
      `[INDEXER][LOAD_PENDING][END:OK] ${pendingRows.length} pending row(s) selected after ${dbAttempts} check(s).`,
    );
    if (pendingRows.length === 0) {
      return jsonResponse(
        { ok: true, processed: 0, message: "No pending rows found to reconcile." },
        200,
serve(async (req) => {
  try {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    console.log("[INDEXER][INIT] Inbound governance-indexer sweep request.");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
      console.error("[INDEXER][FATAL] Missing Supabase env.");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const rpcUrl = Deno.env.get("BASE_RPC_URL") ?? BASE_RPC_FALLBACK;
    const provider = new ethers.JsonRpcProvider(rpcUrl, 8453, { staticNetwork: true });
    const gov = new ethers.Contract(GOVERNOR_ADDRESS, GOVERNOR_ABI, provider);

    // ── LOAD_PENDING ────────────────────────────────────────────────
    console.log("[INDEXER][LOAD_PENDING][START] Fetching un-indexed rows from governance_proposals");
    let pendingRows: any[] = [];
    let dbAttempts = 0;
    const maxDbAttempts = 3;
    while (dbAttempts < maxDbAttempts) {
      dbAttempts++;
      // Non-terminal Governor states: 0=Pending, 1=Active, 5=Queued.
      // Terminal (skip): 2=Canceled, 3=Defeated, 4=Succeeded, 6=Expired, 7=Executed.
      const { data, error } = await supabaseAdmin
        .from("governance_proposals")
        .select("proposal_id, description, targets, callvalues, calldatas")
        .in("state", [0, 1, 5])
        .limit(25);

      if (error) {
        console.error(`[INDEXER][LOAD_PENDING][FATAL] Database query error:`, error);
        return jsonResponse({ error: error.message }, 500);
      }

      if (data && data.length > 0) {
        pendingRows = data;
        break;
      }

      if (dbAttempts < maxDbAttempts) {
        console.log(
          `[INDEXER][LOAD_PENDING][RETRY] 0 rows found. Attempt ${dbAttempts}/${maxDbAttempts}. Waiting 1500ms for DB write to commit...`,
        );
        await new Promise((resolve) => setTimeout(resolve, 1500));
      }
    }

    console.log(
      `[INDEXER][LOAD_PENDING][END:OK] ${pendingRows.length} pending row(s) selected after ${dbAttempts} check(s).`,
    );
    if (pendingRows.length === 0) {
      return jsonResponse(
        { ok: true, processed: 0, message: "No pending rows found to reconcile." },
        200,
      );
    }

    const rows = pendingRows;

    const anchored: Array<{ proposal_id: string; state: number; state_name: string }> = [];
    const failed: Array<{ proposal_id: string; reason: string }> = [];

    for (const row of rows as any[]) {
      const pid = String(row.proposal_id);

      // ── HASH_INPUTS telemetry ────────────────────────────────────
      const targetsArr = Array.isArray(row.targets) ? row.targets : [];
      const valuesArr = Array.isArray(row.callvalues) ? row.callvalues : [];
      const calldatasArr = Array.isArray(row.calldatas) ? row.calldatas : [];
      console.log(
        `[INDEXER][HASH_INPUTS] proposal_id=${pid} targets.len=${targetsArr.length} ` +
          `callvalues.len=${valuesArr.length} calldatas.len=${calldatasArr.length} ` +
          `descriptionLen=${row.description?.length ?? 0}`,
      );
      console.log(`[INDEXER][HASH_INPUTS][DESCRIPTION_RAW] ${row.description}`);

      // ── CHAIN_ANCHOR polling loop ────────────────────────────────
      console.log(`[INDEXER][CHAIN_ANCHOR][START] Verifying on-chain anchor for proposalId: ${pid}`);
      let anchorConfirmed = false;
      let checkAttempts = 0;
      const maxCheckAttempts = 5;
      let currentContractState: any = null;

      while (checkAttempts < maxCheckAttempts && !anchorConfirmed) {
        checkAttempts++;
        try {
    }

    const rows = pendingRows;

    const anchored: Array<{ proposal_id: string; state: number; state_name: string }> = [];
    const failed: Array<{ proposal_id: string; reason: string }> = [];

    for (const row of rows as any[]) {
      const pid = String(row.proposal_id);

      // ── HASH_INPUTS telemetry ────────────────────────────────────
      const targetsArr = Array.isArray(row.targets) ? row.targets : [];
      const valuesArr = Array.isArray(row.callvalues) ? row.callvalues : [];
      const calldatasArr = Array.isArray(row.calldatas) ? row.calldatas : [];
      console.log(
        `[INDEXER][HASH_INPUTS] proposal_id=${pid} targets.len=${targetsArr.length} ` +
          `callvalues.len=${valuesArr.length} calldatas.len=${calldatasArr.length} ` +
          `descriptionLen=${row.description?.length ?? 0}`,
      );
      console.log(`[INDEXER][HASH_INPUTS][DESCRIPTION_RAW] ${row.description}`);

      // ── CHAIN_ANCHOR polling loop ────────────────────────────────
      console.log(`[INDEXER][CHAIN_ANCHOR][START] Verifying on-chain anchor for proposalId: ${pid}`);
      let anchorConfirmed = false;
      let checkAttempts = 0;
      const maxCheckAttempts = 5;
      let currentContractState: any = null;

      while (checkAttempts < maxCheckAttempts && !anchorConfirmed) {
        checkAttempts++;
        try {
          console.log(
            `[INDEXER][CHAIN_ANCHOR][ATTEMPT ${checkAttempts}/${maxCheckAttempts}] gov.state(${pid})`,
          );
          currentContractState = await withTimeout(
            gov.state(pid),
            6000,
            `gov.state attempt ${checkAttempts}`,
          );
          if (currentContractState !== undefined && currentContractState !== null) {
            anchorConfirmed = true;
            console.log(
              `[INDEXER][CHAIN_ANCHOR][SUCCESS] Anchor confirmed for ${pid}. state=${currentContractState}`,
            );
          }
        } catch (err: any) {
            `[INDEXER][CHAIN_ANCHOR][ATTEMPT ${checkAttempts}/${maxCheckAttempts}] gov.state(${pid})`,
          );
          currentContractState = await withTimeout(
            gov.state(pid),
            6000,
            `gov.state attempt ${checkAttempts}`,
          );
          if (currentContractState !== undefined && currentContractState !== null) {
            anchorConfirmed = true;
            console.log(
              `[INDEXER][CHAIN_ANCHOR][SUCCESS] Anchor confirmed for ${pid}. state=${currentContractState}`,
            );
          }
        } catch (err: any) {
          console.warn(
            `[INDEXER][CHAIN_ANCHOR][WARN] Attempt ${checkAttempts} failed:`,
            err?.message || err,
          );
          if (checkAttempts < maxCheckAttempts) {
            console.log(`[INDEXER][CHAIN_ANCHOR] Retrying in 2500ms...`);
            await new Promise((r) => setTimeout(r, 2500));
          }
            `[INDEXER][CHAIN_ANCHOR][WARN] Attempt ${checkAttempts} failed:`,
            err?.message || err,
          );
          if (checkAttempts < maxCheckAttempts) {
            console.log(`[INDEXER][CHAIN_ANCHOR] Retrying in 2500ms...`);
            await new Promise((r) => setTimeout(r, 2500));
          }
        }
      }

      if (!anchorConfirmed) {
        console.error(
          `[INDEXER][CHAIN_ANCHOR][FATAL] All ${maxCheckAttempts} anchoring attempts exhausted for proposal_id: ${pid}`,
        );
        failed.push({
          proposal_id: pid,
          reason: "Chain anchor failed after verification timeout.",
        });
        continue; // per-row isolation
      }

      // ── DB_WRITE — refresh state + auxiliary chain data ──────────
      const stateInt = Number(currentContractState);
      const stateName = PROPOSAL_STATES[stateInt] ?? "Unknown";

      const [snapshot, deadline, proposer, votes] = await Promise.all([
        withTimeout(gov.proposalSnapshot(pid), 6000, "proposalSnapshot").catch(() => null),
        withTimeout(gov.proposalDeadline(pid), 6000, "proposalDeadline").catch(() => null),
        withTimeout(gov.proposalProposer(pid), 6000, "proposalProposer").catch(() => null),
        withTimeout(gov.proposalVotes(pid), 6000, "proposalVotes").catch(() => null),
      ]);

      const update: Record<string, unknown> = {
        state: stateInt,
        state_name: stateName,
      };
      if (snapshot != null) update.vote_start = Number(snapshot);
      if (deadline != null) update.vote_end = Number(deadline);
      if (proposer) update.proposer = proposer;
      // NOTE: governance_proposals has no vote-tally columns (against/for/abstain)
      // and no updated_at column per the authoritative schema. Do not write them.
      void votes;

      console.log(`[INDEXER][DB_WRITE][START] proposal_id=${pid} → ${stateName}(${stateInt})`);
      const { error: updateErr } = await supabaseAdmin
        .from("governance_proposals")
        .update(update)
        .eq("proposal_id", pid);

      if (updateErr) {
        console.error(`[INDEXER][DB_WRITE][FATAL] proposal_id=${pid}`, updateErr.message);
        failed.push({ proposal_id: pid, reason: `DB update failed: ${updateErr.message}` });
        continue;
      }

      console.log(`[INDEXER][DB_WRITE][END:OK] proposal_id=${pid}`);
      anchored.push({ proposal_id: pid, state: stateInt, state_name: stateName });
    }

    console.log(
      `[INDEXER][SWEEP][END:OK] processed=${rows.length} anchored=${anchored.length} failed=${failed.length}`,
    );
    return jsonResponse({ ok: true, processed: rows.length, anchored, failed });
  } catch (err: any) {
    console.error("[INDEXER][FATAL_CRASH]", err?.message || err, err?.stack);
    return jsonResponse({ error: "indexer_crash", details: err?.message || String(err) }, 500);
      }

      if (!anchorConfirmed) {
        console.error(
          `[INDEXER][CHAIN_ANCHOR][FATAL] All ${maxCheckAttempts} anchoring attempts exhausted for proposal_id: ${pid}`,
        );
        failed.push({
          proposal_id: pid,
          reason: "Chain anchor failed after verification timeout.",
        });
        continue; // per-row isolation
      }

      // ── DB_WRITE — refresh state + auxiliary chain data ──────────
      const stateInt = Number(currentContractState);
      const stateName = PROPOSAL_STATES[stateInt] ?? "Unknown";

      const [snapshot, deadline, proposer, votes] = await Promise.all([
        withTimeout(gov.proposalSnapshot(pid), 6000, "proposalSnapshot").catch(() => null),
        withTimeout(gov.proposalDeadline(pid), 6000, "proposalDeadline").catch(() => null),
        withTimeout(gov.proposalProposer(pid), 6000, "proposalProposer").catch(() => null),
        withTimeout(gov.proposalVotes(pid), 6000, "proposalVotes").catch(() => null),
      ]);

      const update: Record<string, unknown> = {
        state: stateInt,
        state_name: stateName,
      };
      if (snapshot != null) update.vote_start = Number(snapshot);
      if (deadline != null) update.vote_end = Number(deadline);
      if (proposer) update.proposer = proposer;
      // NOTE: governance_proposals has no vote-tally columns (against/for/abstain)
      // and no updated_at column per the authoritative schema. Do not write them.
      void votes;

      console.log(`[INDEXER][DB_WRITE][START] proposal_id=${pid} → ${stateName}(${stateInt})`);
      const { error: updateErr } = await supabaseAdmin
        .from("governance_proposals")
        .update(update)
        .eq("proposal_id", pid);

      if (updateErr) {
        console.error(`[INDEXER][DB_WRITE][FATAL] proposal_id=${pid}`, updateErr.message);
        failed.push({ proposal_id: pid, reason: `DB update failed: ${updateErr.message}` });
        continue;
      }

      console.log(`[INDEXER][DB_WRITE][END:OK] proposal_id=${pid}`);
      anchored.push({ proposal_id: pid, state: stateInt, state_name: stateName });
    }

    console.log(
      `[INDEXER][SWEEP][END:OK] processed=${rows.length} anchored=${anchored.length} failed=${failed.length}`,
    );
    return jsonResponse({ ok: true, processed: rows.length, anchored, failed });
  } catch (err: any) {
    console.error("[INDEXER][FATAL_CRASH]", err?.message || err, err?.stack);
    return jsonResponse({ error: "indexer_crash", details: err?.message || String(err) }, 500);
  }
});
