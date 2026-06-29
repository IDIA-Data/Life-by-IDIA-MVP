// dao-proposal-tally — off-chain quorum + simple-majority tally.
// Reads dao_proposals where status='active' and (end_date is null OR end_date <= now()),
// tallies dao_votes, and advances lifecycle_phase to 'passed' or 'failed'.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();

    // Pull active proposals whose voting window has closed (or have no end_date — fallback policy).
    const { data: proposals, error: pErr } = await admin
      .from("dao_proposals")
      .select("id, on_chain_id, end_date, quorum_threshold, status, lifecycle_phase")
      .eq("status", "active")
      .or(`end_date.lte.${nowIso},end_date.is.null`)
      .limit(200);

    if (pErr) {
      console.error("[PROPOSAL_TALLY] fetch failed", pErr);
      return new Response(JSON.stringify({ error: pErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const p of proposals || []) {
      // Skip proposals that haven't actually expired (end_date is null without grace)
      if (!p.end_date) continue;

      const proposalRef = p.on_chain_id ?? p.id;
      const { data: votes, error: vErr } = await admin
        .from("dao_votes")
        .select("vote_type, vote_weight")
        .eq("proposal_ref", proposalRef);
      if (vErr) {
        console.error("[PROPOSAL_TALLY] votes fetch failed", p.id, vErr);
        continue;
      }

      let forWeight = 0, againstWeight = 0, voterCount = 0;
      for (const v of votes || []) {
        const w = Number(v.vote_weight || 0);
        if (v.vote_type === "for") forWeight += w;
        else if (v.vote_type === "against") againstWeight += w;
        voterCount += 1;
      }
      const totalWeight = forWeight + againstWeight;
      const quorum = Number(p.quorum_threshold || 0);
      const quorumMet = voterCount >= quorum;
      const passed = quorumMet && forWeight > againstWeight;
      const nextPhase = quorumMet ? (passed ? "passed" : "failed") : "failed_quorum";
      const nextStatus = quorumMet ? (passed ? "passed" : "failed") : "failed";

      const { error: updErr } = await admin
        .from("dao_proposals")
        .update({ status: nextStatus, lifecycle_phase: nextPhase })
        .eq("id", p.id)
        .eq("status", "active");
      if (updErr) {
        console.error("[PROPOSAL_TALLY] update failed", p.id, updErr);
        continue;
      }

      results.push({
        id: p.id, voters: voterCount, forWeight, againstWeight, totalWeight,
        quorum, quorumMet, passed, phase: nextPhase,
      });
      console.log("[PROPOSAL_TALLY] RESOLVED", p.id, nextPhase, { voterCount, forWeight, againstWeight });
    }

    return new Response(JSON.stringify({ ok: true, count: results.length, results }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[PROPOSAL_TALLY] FATAL", e);
    return new Response(JSON.stringify({ error: e?.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
