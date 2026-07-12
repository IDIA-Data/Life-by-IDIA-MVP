// execution-tracker-manage — L2/L3 gated operations on dao_execution_tasks.
//
// Actions:
//   - enroll         : create a task for a proposal that just entered execution phase
//   - set_clock      : (re)set execution_deadline_at
//   - mark_executed  : record execution_tx_hash and mark executed
//   - mark_failed    : record failure_reason and mark failed
//   - request_extension : create a dao_execution_extensions row + draft proposal
//   - grant_extension   : add granted_extension_seconds to the task, resume
//
// Any authenticated user can READ (RLS allows). Only L2/L3 can call this fn.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const callerId = claims.claims.sub as string;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // L2+ gate — oversight_chair or tophat
    const { data: hats } = await admin
      .from("dao_hats")
      .select("hat_type")
      .eq("user_id", callerId)
      .eq("eligibility_status", "active")
      .is("revoked_at", null)
      .in("hat_type", ["tophat", "oversight_chair"]);
    if (!hats || hats.length === 0) {
      return json({ error: "Insufficient authority — Oversight Chair (L2) or Steward (L3) required" }, 403);
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body.action !== "string") return json({ error: "Missing action" }, 400);

    const action = body.action as string;

    const logEvent = async (task_id: string, event_type: string, payload: Record<string, unknown> = {}) => {
      await admin.from("dao_execution_events").insert({
        task_id, actor_id: callerId, event_type, payload,
      });
    };

    switch (action) {
      case "enroll": {
        const { proposal_id, title, category, onchain_proposal_id, initial_deadline_at } = body;
        if (typeof proposal_id !== "string" || typeof title !== "string") {
          return json({ error: "Missing proposal_id or title" }, 400);
        }
        const { data: existing } = await admin
          .from("dao_execution_tasks").select("id").eq("proposal_id", proposal_id).maybeSingle();
        if (existing) return json({ ok: true, task_id: existing.id, already: true });

        const deadline = initial_deadline_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await admin.from("dao_execution_tasks").insert({
          proposal_id, title, category: category ?? null,
          onchain_proposal_id: onchain_proposal_id ?? null,
          execution_deadline_at: deadline,
          initial_deadline_at: deadline,
          status: "ready",
        }).select("id").single();
        if (error) return json({ error: error.message }, 500);
        await logEvent(data.id, "enrolled", { deadline });
        return json({ ok: true, task_id: data.id });
      }

      case "set_clock": {
        const { task_id, execution_deadline_at, note } = body;
        if (typeof task_id !== "string" || typeof execution_deadline_at !== "string") {
          return json({ error: "Missing task_id or execution_deadline_at" }, 400);
        }
        const { error } = await admin.from("dao_execution_tasks")
          .update({ execution_deadline_at, status: "executing" })
          .eq("id", task_id);
        if (error) return json({ error: error.message }, 500);
        await logEvent(task_id, "clock_set", { execution_deadline_at, note: note ?? null });
        return json({ ok: true });
      }

      case "mark_executed": {
        const { task_id, tx_hash, note } = body;
        if (typeof task_id !== "string") return json({ error: "Missing task_id" }, 400);
        const { error } = await admin.from("dao_execution_tasks")
          .update({ status: "executed", execution_tx_hash: tx_hash ?? null })
          .eq("id", task_id);
        if (error) return json({ error: error.message }, 500);
        await logEvent(task_id, "executed", { tx_hash: tx_hash ?? null, note: note ?? null });
        return json({ ok: true });
      }

      case "mark_failed": {
        const { task_id, failure_reason } = body;
        if (typeof task_id !== "string" || typeof failure_reason !== "string") {
          return json({ error: "Missing task_id or failure_reason" }, 400);
        }
        const { error } = await admin.from("dao_execution_tasks")
          .update({ status: "failed", failure_reason }).eq("id", task_id);
        if (error) return json({ error: error.message }, 500);
        await logEvent(task_id, "failed", { failure_reason });
        return json({ ok: true });
      }

      case "request_extension": {
        const { task_id, requested_seconds, reason } = body;
        if (typeof task_id !== "string" || typeof requested_seconds !== "number" || typeof reason !== "string") {
          return json({ error: "Missing task_id, requested_seconds, or reason" }, 400);
        }
        const { data: task } = await admin.from("dao_execution_tasks")
          .select("id, title, proposal_id").eq("id", task_id).maybeSingle();
        if (!task) return json({ error: "Task not found" }, 404);

        // Create a draft on-chain-bound proposal for the extension request.
        // Follows the motion escalation lifecycle: starts as 'draft', L3 anchors on-chain.
        const { data: prop, error: propErr } = await admin.from("dao_proposals").insert({
          title: `⏰ Extension Request — ${task.title}`.slice(0, 200),
          description: `Additional execution time requested: ${Math.round(requested_seconds / 3600)}h.\n\nReason:\n${reason}`,
          category: "execution_extension",
          proposer_id: callerId,
          status: "draft",
          lifecycle_phase: "draft",
        }).select("id").single();
        if (propErr) return json({ error: propErr.message }, 500);

        const { data: ext, error: extErr } = await admin.from("dao_execution_extensions").insert({
          task_id, extension_proposal_id: prop.id,
          requested_seconds, reason, state: "pending",
        }).select("id").single();
        if (extErr) return json({ error: extErr.message }, 500);

        await admin.from("dao_execution_tasks")
          .update({ status: "extension_pending" }).eq("id", task_id);
        await logEvent(task_id, "extension_requested", {
          extension_id: ext.id, proposal_id: prop.id, requested_seconds, reason,
        });
        return json({ ok: true, extension_id: ext.id, proposal_id: prop.id });
      }

      case "grant_extension": {
        const { extension_id } = body;
        if (typeof extension_id !== "string") return json({ error: "Missing extension_id" }, 400);
        const { data: ext } = await admin.from("dao_execution_extensions")
          .select("id, task_id, requested_seconds, state").eq("id", extension_id).maybeSingle();
        if (!ext) return json({ error: "Extension not found" }, 404);
        if (ext.state !== "pending") return json({ error: `Extension already ${ext.state}` }, 409);

        const { data: task } = await admin.from("dao_execution_tasks")
          .select("id, execution_deadline_at, granted_extension_seconds").eq("id", ext.task_id).maybeSingle();
        if (!task) return json({ error: "Task not found" }, 404);

        const current = task.execution_deadline_at ? new Date(task.execution_deadline_at).getTime() : Date.now();
        const newDeadline = new Date(current + Number(ext.requested_seconds) * 1000).toISOString();

        await admin.from("dao_execution_tasks").update({
          execution_deadline_at: newDeadline,
          granted_extension_seconds: Number(task.granted_extension_seconds || 0) + Number(ext.requested_seconds),
          status: "executing",
        }).eq("id", ext.task_id);

        await admin.from("dao_execution_extensions").update({
          state: "granted", resolved_at: new Date().toISOString(),
        }).eq("id", extension_id);

        await logEvent(ext.task_id, "extension_granted", {
          extension_id, added_seconds: ext.requested_seconds, new_deadline: newDeadline,
        });
        return json({ ok: true, new_deadline: newDeadline });
      }

      default:
        return json({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e: any) {
    console.error("[EXECUTION_TRACKER_MANAGE][FATAL]", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});
