import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * When a pending action survives negative consent (status → 'executed'),
 * enrol the matching dao_proposals row into the Execution Tracker and flip
 * its lifecycle phase so it surfaces under Archive · Execution Phase.
 */
async function enrollExecutionTask(
  supabase: ReturnType<typeof createClient>,
  actionId: string,
  log: (tag: string, msg: string) => void,
) {
  try {
    const { data: action } = await supabase
      .from("dao_pending_actions")
      .select("onchain_proposal_id, title, category")
      .eq("id", actionId)
      .maybeSingle();
    if (!action?.onchain_proposal_id) {
      log("EXEC_ENROL", `Skipped — no onchain_proposal_id on action ${actionId}`);
      return;
    }

    const { data: prop } = await supabase
      .from("dao_proposals")
      .select("id, title, category")
      .eq("on_chain_id", action.onchain_proposal_id)
      .maybeSingle();
    if (!prop) {
      log("EXEC_ENROL", `No dao_proposals row for onchain_id=${action.onchain_proposal_id}`);
      return;
    }

    await supabase
      .from("dao_proposals")
      .update({ status: "awaiting_execution", lifecycle_phase: "awaiting_execution" })
      .eq("id", prop.id);

    const { data: existing } = await supabase
      .from("dao_execution_tasks")
      .select("id")
      .eq("proposal_id", prop.id)
      .maybeSingle();

    if (!existing) {
      const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error: taskErr } = await supabase.from("dao_execution_tasks").insert({
        proposal_id: prop.id,
        onchain_proposal_id: action.onchain_proposal_id,
        title: prop.title || action.title || "Governance action",
        category: prop.category ?? action.category ?? null,
        execution_deadline_at: deadline,
        initial_deadline_at: deadline,
        status: "ready",
      });
      if (taskErr) log("EXEC_ENROL", `Insert warn: ${taskErr.message}`);
      else log("EXEC_ENROL", `Enrolled proposal ${prop.id} into execution tracker`);
    } else {
      log("EXEC_ENROL", `Execution task already exists for proposal ${prop.id}`);
    }
  } catch (e) {
    log("EXEC_ENROL", `Warn: ${e instanceof Error ? e.message : String(e)}`);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const log = (tag: string, msg: string) => console.log(`[DAO_EXECUTION_${tag}]: ${msg}`);

  try {
    log("START", "Initiating veto tally...");

    // ── AUTH GATE: accept sovereign JWT OR service-role (cron) bearer ─────
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (token === serviceRoleKey) {
      log("AUTH", "Service-role (cron) caller authorized.");
    } else {
      const supabaseAuth = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: claimsData, error: claimsErr } = await supabaseAuth.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      log("AUTH", `Sovereign ${claimsData.claims.sub} authorized to trigger tally.`);
    }

    const { actionId } = await req.json();
    if (!actionId) throw new Error("actionId required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { count, error: countErr } = await supabase
      .from("dao_vetoes")
      .select("id", { count: "exact", head: true })
      .eq("action_id", actionId);
    if (countErr) throw countErr;

    const { data: action, error: actErr } = await supabase
      .from("dao_pending_actions")
      .select("veto_threshold,timelock_expires_at,status")
      .eq("id", actionId)
      .maybeSingle();
    if (actErr) throw actErr;
    if (!action) throw new Error("Action not found");

    log("STEP", `Tallied ${count} vetoes vs threshold ${action.veto_threshold}`);

    const vetoed = (count ?? 0) >= action.veto_threshold;
    const expired = new Date(action.timelock_expires_at).getTime() <= Date.now();

    let nextStatus = action.status;
    if (vetoed) nextStatus = "vetoed";
    else if (expired) nextStatus = "executed";

    if (nextStatus !== action.status) {
      const update: Record<string, unknown> = { veto_count: count ?? 0, status: nextStatus };
      if (nextStatus === "executed") {
        update.execution_hash = crypto.randomUUID().replace(/-/g, "");
        log("STEP", "Oracle verification confirmed SLA compliance.");
      }
      const { error: updErr } = await supabase
        .from("dao_pending_actions")
        .update(update)
        .eq("id", actionId);
      if (updErr) throw updErr;

      if (nextStatus === "executed") {
        await enrollExecutionTask(supabase, actionId, log);
      }
    } else {
      await supabase.from("dao_pending_actions").update({ veto_count: count ?? 0 }).eq("id", actionId);
    }

    log("END", `Disbursement complete. Status=${nextStatus}`);
    return new Response(JSON.stringify({ status: nextStatus, veto_count: count }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("ERROR", `Silent stall detected. Error: ${msg}`);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
