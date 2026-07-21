// Sweeps dao_pending_actions whose timelock has expired and veto_count < veto_threshold.
// Marks them 'executed' and enrols survivors into the Execution Tracker.
// Intended to be invoked by pg_cron every minute.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

async function enrollExecutionTask(
  supabase: ReturnType<typeof createClient>,
  actionId: string,
) {
  try {
    const { data: action } = await supabase
      .from("dao_pending_actions")
      .select("onchain_proposal_id, title, category")
      .eq("id", actionId)
      .maybeSingle();
    if (!action?.onchain_proposal_id) return;

    const { data: prop } = await supabase
      .from("dao_proposals")
      .select("id, title, category")
      .eq("on_chain_id", action.onchain_proposal_id)
      .maybeSingle();
    if (!prop) return;

    await supabase
      .from("dao_proposals")
      .update({ status: "awaiting_execution", lifecycle_phase: "awaiting_execution" })
      .eq("id", prop.id);

    const { data: existing } = await supabase
      .from("dao_execution_tasks")
      .select("id")
      .eq("proposal_id", prop.id)
      .maybeSingle();
    if (existing) return;

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
    if (taskErr) console.warn("[SWEEP][EXEC_ENROL] insert warn:", taskErr.message);
  } catch (e) {
    console.warn("[SWEEP][EXEC_ENROL] warn:", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { data: ready, error } = await supabase
      .from("dao_pending_actions")
      .select("id, veto_count, veto_threshold, timelock_expires_at, status")
      .eq("status", "pending")
      .lte("timelock_expires_at", new Date().toISOString());

    if (error) throw error;

    const executed: string[] = [];
    const vetoed: string[] = [];

    for (const a of ready ?? []) {
      const next =
        (a.veto_count ?? 0) >= (a.veto_threshold ?? 0) ? "vetoed" : "executed";
      const { error: upErr } = await supabase
        .from("dao_pending_actions")
        .update({ status: next })
        .eq("id", a.id)
        .eq("status", "pending");
      if (!upErr) {
        (next === "executed" ? executed : vetoed).push(a.id);
        if (next === "executed") await enrollExecutionTask(supabase, a.id);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, executed, vetoed, scanned: ready?.length ?? 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
