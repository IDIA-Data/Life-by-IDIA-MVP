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

// Fallback only — request-time resolver below prefers Deno.env.get("GOVERNOR_ADDRESS").
const GOVERNOR_ADDRESS_FALLBACK = "0xc59120a33C9baeF4ee10847e403221C1040773d9";

function resolveGovernorAddress(): { address: string; source: "env" | "fallback" } {
  const fromEnv = Deno.env.get("GOVERNOR_ADDRESS");
  if (fromEnv && ethers.isAddress(fromEnv)) {
    return { address: ethers.getAddress(fromEnv), source: "env" };
  }
  if (fromEnv) {
    console.error(
      `[INDEXER][BOOT][WARN] GOVERNOR_ADDRESS env var present but invalid (${fromEnv}); using literal fallback.`,
    );
  } else {
    console.warn("[INDEXER][BOOT][WARN] GOVERNOR_ADDRESS env var missing; using literal fallback.");
  }
  return { address: GOVERNOR_ADDRESS_FALLBACK, source: "fallback" };
}
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
    const { address: governorAddress, source: governorSource } = resolveGovernorAddress();
    console.log(`[INDEXER][BOOT] governor=${governorAddress} source=${governorSource}`);
    const gov = new ethers.Contract(governorAddress, GOVERNOR_ABI, provider);

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

      // ── DAO_PROPOSALS reconciliation ─────────────────────────────
      // Mirror terminal / near-terminal states into the app-facing
      // dao_proposals table so stale "active" rows can never appear
      // in the Active feed once the chain has moved on.
      const dbPhase =
        stateInt === 7 ? "executed"
        : stateInt === 5 ? "queued"
        : stateInt === 4 ? "succeeded"
        : stateInt === 3 ? "defeated"
        : stateInt === 2 ? "canceled"
        : stateInt === 6 ? "expired"
        : null;
      if (dbPhase) {
        const { error: daoErr } = await supabaseAdmin
          .from("dao_proposals")
          .update({ status: dbPhase, lifecycle_phase: dbPhase })
          .eq("on_chain_id", pid);
        if (daoErr) {
          console.warn(`[INDEXER][DAO_SYNC][WARN] proposal_id=${pid} ${daoErr.message}`);
        } else {
          console.log(`[INDEXER][DAO_SYNC][OK] proposal_id=${pid} → ${dbPhase}`);
        }
      }

      // ── PENDING_ACTIONS enrolment ────────────────────────────────
      // Succeeded (4) and Queued (5) enter the Negative Consent
      // timelock. Insert once, keyed on onchain_proposal_id.
      if (stateInt === 4 || stateInt === 5) {
        const { data: existing } = await supabaseAdmin
          .from("dao_pending_actions")
          .select("id")
          .eq("onchain_proposal_id", pid)
          .maybeSingle();
        if (!existing) {
          const title = (row.description || "Governance action").split("\n")[0].slice(0, 200);
          const { error: pendErr } = await supabaseAdmin
            .from("dao_pending_actions")
            .insert({
              title,
              description: row.description ?? null,
              category: "governance",
              timelock_expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
              onchain_proposal_id: pid,
              status: "pending",
            });
          if (pendErr) {
            console.warn(`[INDEXER][PENDING_ACTIONS][WARN] proposal_id=${pid} ${pendErr.message}`);
          } else {
            console.log(`[INDEXER][PENDING_ACTIONS][OK] proposal_id=${pid} enrolled`);
          }
        }
      }

      // ── EXECUTION_TRACKER enrolment ──────────────────────────────
      // When a proposal enters Queued (5) it's post-timelock and ready
      // to execute — surface it in the Delaware MSA Execution Tracker.
      if (stateInt === 5) {
        // Find the matching dao_proposals row (if any) to seed title/category.
        const { data: daoProp } = await supabaseAdmin
          .from("dao_proposals")
          .select("id, title, category")
          .eq("on_chain_id", pid)
          .maybeSingle();
        if (daoProp) {
          const { data: existingTask } = await supabaseAdmin
            .from("dao_execution_tasks")
            .select("id")
            .eq("proposal_id", daoProp.id)
            .maybeSingle();
          if (!existingTask) {
            const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            const { error: taskErr } = await supabaseAdmin
              .from("dao_execution_tasks")
              .insert({
                proposal_id: daoProp.id,
                onchain_proposal_id: pid,
                title: daoProp.title || (row.description || "Governance action").split("\n")[0].slice(0, 200),
                category: daoProp.category ?? null,
                execution_deadline_at: deadline,
                initial_deadline_at: deadline,
                status: "ready",
              });
            if (taskErr) {
              console.warn(`[INDEXER][EXECUTION_TRACKER][WARN] proposal_id=${pid} ${taskErr.message}`);
            } else {
              console.log(`[INDEXER][EXECUTION_TRACKER][OK] proposal_id=${pid} enrolled`);
            }

          }
        }
      }
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
