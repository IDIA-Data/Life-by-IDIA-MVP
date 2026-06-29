// Sweeps dao_pending_actions whose timelock has expired and veto_count < veto_threshold.
// Marks them 'executed'. Intended to be invoked by pg_cron every minute.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

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
      if (!upErr) (next === "executed" ? executed : vetoed).push(a.id);
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
