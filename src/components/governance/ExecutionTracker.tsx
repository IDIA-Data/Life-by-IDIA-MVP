/**
 * ExecutionTracker — Delaware MSA panel that manages the post-timelock
 * execution lifecycle of DAO-approved proposals.
 *
 * Read: any authenticated user (via RLS on dao_execution_tasks).
 * Write: only L2 (oversight_chair) / L3 (tophat) — enforced server-side by
 *        the `execution-tracker-manage` edge function AND the write policies
 *        (there are none for authenticated), and mirrored in the UI so
 *        non-officers only see status + countdown.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, Timer, CheckCircle2, XCircle, Clock3, AlertTriangle, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { getAscensionLevel, type AscensionLevel } from "@/utils/governanceGate";
import { cn } from "@/lib/utils";

type TaskStatus = "ready" | "executing" | "executed" | "failed" | "overdue" | "extension_pending";

interface ExecutionTask {
  id: string;
  proposal_id: string;
  onchain_proposal_id: string | null;
  title: string;
  category: string | null;
  execution_deadline_at: string | null;
  initial_deadline_at: string | null;
  granted_extension_seconds: number;
  status: TaskStatus;
  execution_tx_hash: string | null;
  failure_reason: string | null;
  created_at: string;
}

const STATUS_META: Record<TaskStatus, { label: string; className: string; icon: React.ComponentType<any> }> = {
  ready:              { label: "Ready to Execute",  className: "text-sky-700 bg-sky-50 border-sky-200 dark:text-sky-300 dark:bg-sky-950/30 dark:border-sky-900/40", icon: Play },
  executing:          { label: "Executing",         className: "text-indigo-700 bg-indigo-50 border-indigo-200 dark:text-indigo-300 dark:bg-indigo-950/30 dark:border-indigo-900/40", icon: Timer },
  executed:           { label: "Executed",          className: "text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-300 dark:bg-emerald-950/30 dark:border-emerald-900/40", icon: CheckCircle2 },
  failed:             { label: "Failed",            className: "text-red-700 bg-red-50 border-red-200 dark:text-red-300 dark:bg-red-950/30 dark:border-red-900/40", icon: XCircle },
  overdue:            { label: "Overdue",           className: "text-orange-700 bg-orange-50 border-orange-200 dark:text-orange-300 dark:bg-orange-950/30 dark:border-orange-900/40", icon: AlertTriangle },
  extension_pending:  { label: "Extension Pending", className: "text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-300 dark:bg-amber-950/30 dark:border-amber-900/40", icon: Clock3 },
};

function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function formatCountdown(deadlineISO: string | null, now: number): { text: string; expired: boolean } {
  if (!deadlineISO) return { text: "No deadline set", expired: false };
  const diff = new Date(deadlineISO).getTime() - now;
  const expired = diff <= 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const parts = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return { text: expired ? `Overdue by ${parts}` : `${parts} remaining`, expired };
}

const ExecutionTracker: React.FC = () => {
  const [tasks, setTasks] = useState<ExecutionTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [ascensionLevel, setAscensionLevel] = useState<AscensionLevel>(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const now = useNow();
  const canManage = ascensionLevel >= 2;

  // Dialog state
  const [selected, setSelected] = useState<ExecutionTask | null>(null);
  const [dialogMode, setDialogMode] = useState<null | "clock" | "extension" | "executed" | "failed">(null);
  const [busy, setBusy] = useState(false);
  const [formHours, setFormHours] = useState("72");
  const [formNote, setFormNote] = useState("");
  const [formTxHash, setFormTxHash] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: hats } = await (supabase as any)
            .from("dao_hats")
            .select("hat_type")
            .eq("user_id", user.id)
            .eq("eligibility_status", "active")
            .is("revoked_at", null);
          const hatSet = new Set<string>((hats || []).map((h: any) => h.hat_type));
          if (alive) setAscensionLevel(getAscensionLevel(hatSet));
        }

        const { data, error } = await (supabase as any)
          .from("dao_execution_tasks")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        if (alive) setTasks((data || []) as ExecutionTask[]);
      } catch (err: any) {
        console.error("[EXECUTION_TRACKER] fetch failed", err);
        toast({ title: "Execution tracker sync failed", description: err.message, variant: "destructive" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [refreshKey]);

  const displayed = useMemo(() => {
    return tasks.map((t) => {
      // Client-side overdue flag when server hasn't updated status yet.
      if ((t.status === "ready" || t.status === "executing") && t.execution_deadline_at
          && new Date(t.execution_deadline_at).getTime() < now) {
        return { ...t, status: "overdue" as TaskStatus };
      }
      return t;
    });
  }, [tasks, now]);

  const invoke = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("execution-tracker-manage", { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Execution tracker updated" });
      setDialogMode(null);
      setSelected(null);
      setFormHours("72");
      setFormNote("");
      setFormTxHash("");
      setRefreshKey((k) => k + 1);
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const openDialog = (task: ExecutionTask, mode: "clock" | "extension" | "executed" | "failed") => {
    setSelected(task);
    setDialogMode(mode);
    setFormHours(mode === "clock" ? "72" : "48");
    setFormNote("");
    setFormTxHash("");
  };

  return (
    <>
      <Card className="border-amber-200/70 dark:border-amber-900/40 bg-gradient-to-br from-amber-50/60 to-orange-50/40 dark:from-amber-950/20 dark:to-orange-950/10 rounded-3xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Timer className="w-4 h-4 text-amber-600" />
              <h3 className="text-[11px] font-black uppercase tracking-widest text-amber-900 dark:text-amber-200">
                Execution Tracker
              </h3>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-800/70 dark:text-amber-200/60">
              {canManage ? "Officer Console" : "Public View"}
            </span>
          </div>
          <p className="text-[10px] text-amber-900/70 dark:text-amber-200/60 -mt-2">
            Tracks proposals that have cleared all timelocks and are ready for execution.
            {canManage ? " Set clocks, log outcomes, and request/grant additional time." : " Visible to all members; officers manage the clock."}
          </p>

          {loading ? (
            <div className="flex items-center gap-2 py-6 justify-center text-amber-800/70 dark:text-amber-200/60">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest">Loading tracker…</span>
            </div>
          ) : displayed.length === 0 ? (
            <div className="px-4 py-6 text-center rounded-2xl border border-dashed border-amber-300/60 dark:border-amber-900/40 bg-white/50 dark:bg-amber-950/10">
              <p className="text-[10px] font-black uppercase tracking-widest text-amber-800 dark:text-amber-200">
                No executions in flight
              </p>
              <p className="text-[10px] text-amber-800/70 dark:text-amber-200/60 mt-1">
                Approved proposals appear here after the timelock clears them.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {displayed.map((task) => {
                const meta = STATUS_META[task.status];
                const Icon = meta.icon;
                const countdown = formatCountdown(task.execution_deadline_at, now);
                const terminal = task.status === "executed" || task.status === "failed";
                return (
                  <div
                    key={task.id}
                    className="rounded-2xl bg-white/80 dark:bg-neutral-900/60 border border-amber-200/60 dark:border-amber-900/40 p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 line-clamp-2">
                          {task.title}
                        </p>
                        {task.category && (
                          <p className="text-[10px] font-black uppercase tracking-widest text-amber-700/70 dark:text-amber-300/60 mt-1">
                            {task.category}
                          </p>
                        )}
                      </div>
                      <span className={cn("shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[9px] font-black uppercase tracking-widest", meta.className)}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className={cn(
                        "font-black uppercase tracking-widest",
                        countdown.expired ? "text-orange-700 dark:text-orange-300" : "text-amber-800 dark:text-amber-200",
                      )}>
                        {countdown.text}
                      </span>
                      {task.granted_extension_seconds > 0 && (
                        <span className="text-[9px] text-amber-700/70 dark:text-amber-300/60">
                          +{Math.round(task.granted_extension_seconds / 3600)}h granted
                        </span>
                      )}
                    </div>

                    {task.execution_tx_hash && (
                      <a
                        href={`https://basescan.org/tx/${task.execution_tx_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-[10px] text-emerald-700 dark:text-emerald-300 truncate hover:underline"
                      >
                        tx: {task.execution_tx_hash}
                      </a>
                    )}
                    {task.failure_reason && (
                      <p className="text-[10px] text-red-700 dark:text-red-300 whitespace-pre-wrap">
                        {task.failure_reason}
                      </p>
                    )}

                    {canManage && !terminal && (
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                                onClick={() => openDialog(task, "clock")}>
                          Set Clock
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                                onClick={() => openDialog(task, "executed")}>
                          Mark Executed
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                                onClick={() => openDialog(task, "failed")}>
                          Mark Failed
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[10px]"
                                onClick={() => openDialog(task, "extension")}
                                disabled={task.status === "extension_pending"}>
                          {task.status === "extension_pending" ? "Extension Requested" : "Request Extension"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogMode !== null} onOpenChange={(o) => !o && setDialogMode(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "clock" && "Set Execution Clock"}
              {dialogMode === "extension" && "Request Additional Time"}
              {dialogMode === "executed" && "Mark as Executed"}
              {dialogMode === "failed" && "Mark as Failed"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {selected?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {(dialogMode === "clock" || dialogMode === "extension") && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Duration (hours)
                </label>
                <Input type="number" min="1" value={formHours}
                       onChange={(e) => setFormHours(e.target.value)} />
              </div>
            )}
            {dialogMode === "extension" && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Reasoning (becomes on-chain proposal)
                </label>
                <Textarea rows={4} value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          placeholder="Why does the execution window need more time?" />
              </div>
            )}
            {dialogMode === "executed" && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Execution Tx Hash (optional)
                </label>
                <Input value={formTxHash} onChange={(e) => setFormTxHash(e.target.value)}
                       placeholder="0x…" />
              </div>
            )}
            {dialogMode === "failed" && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  Failure Reason
                </label>
                <Textarea rows={4} value={formNote}
                          onChange={(e) => setFormNote(e.target.value)}
                          placeholder="What went wrong?" />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogMode(null)} disabled={busy}>
              Cancel
            </Button>
            <Button
              disabled={busy || !selected}
              onClick={() => {
                if (!selected) return;
                if (dialogMode === "clock") {
                  const hours = Number(formHours);
                  if (!Number.isFinite(hours) || hours <= 0) {
                    toast({ title: "Enter a valid duration", variant: "destructive" }); return;
                  }
                  invoke({
                    action: "set_clock", task_id: selected.id,
                    execution_deadline_at: new Date(Date.now() + hours * 3600 * 1000).toISOString(),
                    note: formNote || undefined,
                  });
                } else if (dialogMode === "extension") {
                  const hours = Number(formHours);
                  if (!Number.isFinite(hours) || hours <= 0 || !formNote.trim()) {
                    toast({ title: "Duration and reasoning required", variant: "destructive" }); return;
                  }
                  invoke({
                    action: "request_extension", task_id: selected.id,
                    requested_seconds: Math.round(hours * 3600),
                    reason: formNote.trim(),
                  });
                } else if (dialogMode === "executed") {
                  invoke({
                    action: "mark_executed", task_id: selected.id,
                    tx_hash: formTxHash.trim() || undefined,
                  });
                } else if (dialogMode === "failed") {
                  if (!formNote.trim()) {
                    toast({ title: "Failure reason required", variant: "destructive" }); return;
                  }
                  invoke({
                    action: "mark_failed", task_id: selected.id,
                    failure_reason: formNote.trim(),
                  });
                }
              }}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExecutionTracker;
