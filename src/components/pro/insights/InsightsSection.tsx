import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  Brain,
  ClipboardList,
  Flame,
  Gauge,
  Loader2,
  MessageSquare,
  Sparkles,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useInsights, type InsightsTier } from "@/hooks/useInsights";
import { stage } from "@/lib/stageLogger";

interface Props {
  tier: InsightsTier;
  isMasked?: boolean;
}

const Card: React.FC<{
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  accent?: "primary" | "amber" | "rose";
}> = ({ title, icon: Icon, children, accent = "primary" }) => {
  const accentClass =
    accent === "amber"
      ? "text-[hsl(28,80%,55%)]"
      : accent === "rose"
      ? "text-rose-500"
      : "text-primary";
  return (
    <div className="rounded-2xl border border-border bg-white/80 backdrop-blur-sm shadow-sm p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-3.5 h-3.5 ${accentClass}`} />
        <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
};

const EmptyState: React.FC = () => (
  <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 text-center">
    <Brain className="w-5 h-5 mx-auto mb-2 text-muted-foreground" />
    <p className="text-xs font-semibold text-foreground mb-1">
      AI Insights — Awaiting First Sync
    </p>
    <p className="text-[11px] text-muted-foreground leading-snug max-w-xs mx-auto">
      Connect Apple Health, Google Fit, or Ford under the Data tab. The
      predictive engine begins working as soon as live readings reach the
      sovereign pipeline.
    </p>
  </div>
);

const AgenticChat: React.FC = () => {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (!input.trim()) return;
    const s = stage("INSIGHTS", "AGENTIC_CHAT");
    s.start();
    setBusy(true);
    setErr(null);
    setReply(null);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user) throw new Error("Not authenticated");
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          message: input,
          user_id: u.user.id,
          mode: "text",
          trigger_context: "pro_insights_agentic",
        },
      });
      if (error) throw error;
      const text =
        (data as any)?.message ||
        (data as any)?.reply ||
        (data as any)?.response ||
        "Agent replied.";
      setReply(text);
      s.ok();
    } catch (e: any) {
      setErr(e?.message ?? "Agent unavailable");
      s.fail(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-[11px]"
          placeholder="Ask the agent about your trajectory…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <Button size="sm" disabled={busy || !input.trim()} onClick={send}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Send"}
        </Button>
      </div>
      {reply && (
        <div className="rounded-md border border-border bg-muted/20 p-2 text-[11px] leading-snug whitespace-pre-wrap">
          {reply}
        </div>
      )}
      {err && (
        <p className="text-[10px] text-rose-500 font-semibold">{err}</p>
      )}
    </div>
  );
};

const InsightsSection: React.FC<Props> = ({ tier, isMasked = false }) => {
  const { payload, empty, loading, error, generatedAt, refresh } =
    useInsights(tier);

  if (isMasked) return null;

  if (loading && !payload) {
    return (
      <div className="rounded-2xl border border-border bg-muted/20 p-6 text-center">
        <Loader2 className="w-4 h-4 mx-auto animate-spin text-muted-foreground" />
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">
          Synthesizing Predictive Insights…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/60 p-4 text-center">
        <AlertTriangle className="w-4 h-4 mx-auto text-rose-500 mb-1" />
        <p className="text-[11px] font-semibold text-rose-700">{error}</p>
        <Button
          size="sm"
          variant="outline"
          className="mt-2 h-7 text-[10px]"
          onClick={refresh}
        >
          Retry
        </Button>
      </div>
    );
  }

  if (empty || !payload) return <EmptyState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <h2 className="text-xs font-bold text-foreground uppercase tracking-widest">
            AI Predictive Insights
          </h2>
        </div>
        <Badge variant="outline" className="text-[9px] font-black uppercase">
          {tier === "pure_alpha"
            ? "Pure Alpha"
            : tier === "pro_plus"
            ? "Pro+"
            : "Pro"}
        </Badge>
      </div>

      <Card title="24h Forecast" icon={Gauge}>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="rounded-lg bg-muted/30 p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Stress
            </p>
            <p className="text-lg font-black text-foreground">
              {payload.forecast.stress_24h}
            </p>
          </div>
          <div className="rounded-lg bg-muted/30 p-2 text-center">
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
              Fatigue
            </p>
            <p className="text-lg font-black text-foreground">
              {payload.forecast.fatigue_24h}
            </p>
          </div>
        </div>
        <p className="text-[11px] leading-snug text-foreground/90">
          {payload.forecast.summary}
        </p>
        <p className="text-[9px] text-muted-foreground uppercase tracking-widest mt-1">
          Confidence {(payload.forecast.confidence * 100).toFixed(0)}%
        </p>
      </Card>

      <Card title="Longitudinal Trends" icon={TrendingUp}>
        <ul className="space-y-1.5">
          {payload.trends.map((t, i) => (
            <li
              key={i}
              className="text-[11px] flex items-start gap-2 border-l-2 border-primary/30 pl-2"
            >
              <span className="font-semibold text-foreground uppercase tracking-wide text-[10px]">
                {t.metric}
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="text-foreground/80">{t.interpretation}</span>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Explainable Recommendation" icon={Activity}>
        <p className="text-[11px] font-semibold text-foreground mb-1">
          {payload.recommendation.title}
        </p>
        <p className="text-[11px] leading-snug text-foreground/85">
          {payload.recommendation.body}
        </p>
        {payload.recommendation.evidence_refs?.length ? (
          <div className="flex flex-wrap gap-1 mt-2">
            {payload.recommendation.evidence_refs.map((r, i) => (
              <Badge
                key={i}
                variant="outline"
                className="text-[9px] uppercase tracking-wider"
              >
                {r}
              </Badge>
            ))}
          </div>
        ) : null}
      </Card>

      <Card title="Smart Intervention" icon={Flame} accent="amber">
        <div className="flex items-start gap-2">
          <Badge
            variant="outline"
            className="text-[9px] font-black uppercase border-[hsl(28,80%,55%)] text-[hsl(28,80%,55%)]"
          >
            {payload.intervention.urgency}
          </Badge>
          <div className="flex-1">
            <p className="text-[11px] font-semibold text-foreground">
              {payload.intervention.trigger}
            </p>
            <p className="text-[11px] text-foreground/85 leading-snug">
              {payload.intervention.action}
            </p>
          </div>
        </div>
      </Card>

      {payload.coaching && (
        <Card title="Personalized Coaching" icon={ClipboardList}>
          <p className="text-[11px] font-semibold text-foreground">
            {payload.coaching.plan_name}
          </p>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">
            Focus: {payload.coaching.weekly_focus}
          </p>
          <ul className="space-y-1">
            {payload.coaching.actions.map((a, i) => (
              <li
                key={i}
                className="text-[11px] text-foreground/85 leading-snug pl-3 relative before:absolute before:left-0 before:top-1.5 before:w-1 before:h-1 before:rounded-full before:bg-primary"
              >
                {a}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {payload.clinical_report && (
        <Card title="Clinical-Style Report" icon={Stethoscope} accent="rose">
          <p className="text-[11px] font-bold text-foreground mb-1">
            {payload.clinical_report.headline}
          </p>
          <pre className="text-[11px] leading-snug text-foreground/85 whitespace-pre-wrap font-sans">
            {payload.clinical_report.findings_markdown}
          </pre>
          {payload.clinical_report.red_flags?.length ? (
            <div className="mt-2">
              <p className="text-[9px] uppercase tracking-widest text-rose-500 font-black mb-1">
                Red Flags
              </p>
              <ul className="space-y-0.5">
                {payload.clinical_report.red_flags.map((r, i) => (
                  <li key={i} className="text-[11px] text-rose-700">
                    • {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      )}

      {tier !== "pro" && (
        <Card title="Agentic Assistant" icon={MessageSquare}>
          <AgenticChat />
        </Card>
      )}

      {payload.cohort && (
        <Card title="Enterprise Cohort Analytics" icon={Users}>
          <p className="text-[11px] font-semibold text-foreground mb-1">
            {payload.cohort.cohort_label}
          </p>
          <p className="text-[11px] text-foreground/85 leading-snug">
            {payload.cohort.percentile_summary}
          </p>
          {payload.cohort.callouts?.length ? (
            <ul className="mt-2 space-y-0.5">
              {payload.cohort.callouts.map((c, i) => (
                <li key={i} className="text-[11px] text-foreground/80">
                  · {c}
                </li>
              ))}
            </ul>
          ) : null}
        </Card>
      )}

      {generatedAt && (
        <p className="text-[9px] text-muted-foreground text-center uppercase tracking-widest">
          Generated {new Date(generatedAt).toLocaleString()}
        </p>
      )}
    </div>
  );
};

export default InsightsSection;
