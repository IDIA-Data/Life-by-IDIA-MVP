import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Activity, TrendingUp } from "lucide-react";
import { localPIIVault, type ConnectionLabel } from "@/lib/localPIIVault";

// Stable hash → hue (mirrors LifeScreen helper so peers map to consistent colors)
function hueFromToken(token: string): number {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
  return h % 360;
}

interface PulseNode {
  id: string;
  label: string;
  hue: number;
  // Polar position around the user, computed by index
  x: number;
  y: number;
}

interface SpherePoint {
  date: string;
  score: number;
}

interface Friend {
  id: string;
  user_id_1: string;
  user_id_2: string;
  status: string;
  friend_profile?: { display_name?: string | null; first_name?: string | null } | null;
}

interface SphereOfInfluenceProps {
  friends: Friend[];
  currentScore: number | null | undefined;
}

const SphereOfInfluence: React.FC<SphereOfInfluenceProps> = ({ friends, currentScore }) => {
  const [view, setView] = useState<"pulse" | "trend">("pulse");
  const [history, setHistory] = useState<SpherePoint[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pulseTick, setPulseTick] = useState(0);

  // Slow heartbeat for the Pulse Map nodes
  useEffect(() => {
    const id = setInterval(() => setPulseTick((t) => t + 1), 1400);
    return () => clearInterval(id);
  }, []);

  // Load 30-day trust score history when the Trend view opens
  useEffect(() => {
    if (view !== "trend") return;
    let cancelled = false;
    (async () => {
      console.log("[SPHERE_TREND_FETCH_START]");
      setHistoryLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) setHistory([]);
          return;
        }
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const { data, error } = await supabase
          .from("trust_score_history")
          .select("score, recorded_at")
          .eq("user_id", user.id)
          .gte("recorded_at", since)
          .order("recorded_at", { ascending: true });
        if (error) throw error;
        const points: SpherePoint[] = (data ?? []).map((row) => ({
          date: new Date(row.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
          score: row.score,
        }));
        // If we have a current score but no history yet, show a single point so the chart is not blank
        if (points.length === 0 && typeof currentScore === "number") {
          points.push({ date: "Today", score: currentScore });
        }
        if (!cancelled) setHistory(points);
      } catch (e) {
        console.warn("[SPHERE_TREND_FETCH_FAILED]", e);
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
        console.log("[SPHERE_TREND_FETCH_END]");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [view, currentScore]);

  const [labels, setLabels] = useState<Record<string, ConnectionLabel>>({});

  useEffect(() => {
    const accepted = friends.filter((f) => f.status === "accepted");
    if (!accepted.length) return;
    localPIIVault.lookupBatch(accepted.map((f) => f.id)).then(setLabels);
  }, [friends]);

  // Compute pulse nodes laid out in a ring around the user
  const nodes: PulseNode[] = useMemo(() => {
    const accepted = friends.filter((f) => f.status === "accepted");
    const count = accepted.length;
    if (count === 0) return [];
    const radius = 38; // % of container
    return accepted.slice(0, 24).map((f, i) => {
      const angle = (i / Math.min(count, 24)) * Math.PI * 2 - Math.PI / 2;
      const x = 50 + Math.cos(angle) * radius;
      const y = 50 + Math.sin(angle) * radius;
      const label = localPIIVault.displayName(f.id, labels[f.id] ?? null);
      return { id: f.id, label, hue: hueFromToken(f.id), x, y };
    });
  }, [friends, labels]);

  return (
    <Card className="bg-white shadow-sm border-none h-full flex flex-col">
      <CardContent className="p-4 flex-1 min-h-0 flex flex-col gap-3">
        {/* Toggle */}
        <div className="grid grid-cols-2 gap-2 shrink-0">
          <Button
            size="sm"
            variant={view === "pulse" ? "default" : "outline"}
            className={
              view === "pulse"
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "border-teal-200 text-teal-700"
            }
            onClick={() => setView("pulse")}
          >
            <Activity className="w-4 h-4 mr-2" />
            Pulse Map
          </Button>
          <Button
            size="sm"
            variant={view === "trend" ? "default" : "outline"}
            className={
              view === "trend"
                ? "bg-teal-600 hover:bg-teal-700 text-white"
                : "border-teal-200 text-teal-700"
            }
            onClick={() => setView("trend")}
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Trend (30 Days)
          </Button>
        </div>

        {/* Body */}
        {view === "pulse" ? (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-center mb-2">
              <h3 className="text-base font-semibold text-foreground">Your Sphere of Influence</h3>
              <p className="text-[11px] text-muted-foreground">
                Each dot is a Connection you made by Syncing in person.
              </p>
            </div>
            <div className="relative flex-1 min-h-0 rounded-2xl bg-gradient-to-br from-teal-50 via-white to-orange-50 border border-teal-100 overflow-hidden">
              {/* Center: the user */}
              <div
                className="absolute"
                style={{
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                <div
                  className="rounded-full bg-gradient-to-br from-teal-500 to-orange-500 shadow-lg shadow-teal-500/30 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: 44, height: 44 }}
                >
                  You
                </div>
              </div>

              {/* Concentric rings */}
              {[20, 32, 44].map((r) => (
                <div
                  key={r}
                  className="absolute rounded-full border border-teal-200/40"
                  style={{
                    left: "50%",
                    top: "50%",
                    width: `${r * 2}%`,
                    height: `${r * 2}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}

              {/* Connection nodes */}
              {nodes.length === 0 ? (
                <div className="absolute inset-0 flex items-end justify-center pb-4">
                  <p className="text-xs text-muted-foreground text-center px-6">
                    You do not have any Connections yet. Tap two phones together to start Syncing.
                  </p>
                </div>
              ) : (
                nodes.map((n, i) => {
                  // Slow heartbeat: alternate scale per node based on tick
                  const beating = (pulseTick + i) % 2 === 0;
                  return (
                    <div
                      key={n.id}
                      className="absolute transition-transform duration-700 ease-in-out"
                      style={{
                        left: `${n.x}%`,
                        top: `${n.y}%`,
                        transform: `translate(-50%, -50%) scale(${beating ? 1.15 : 1})`,
                      }}
                      title={n.label}
                    >
                      <div
                        className="rounded-full shadow"
                        style={{
                          width: 18,
                          height: 18,
                          background: `hsl(${n.hue}, 80%, 60%)`,
                          boxShadow: `0 0 12px hsla(${n.hue}, 80%, 60%, 0.55)`,
                        }}
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="text-center mb-2">
              <h3 className="text-base font-semibold text-foreground">Your Trust Score Over Time</h3>
              <p className="text-[11px] text-muted-foreground">
                See how your score changed over the last 30 days.
              </p>
            </div>
            <div className="flex-1 min-h-0 rounded-2xl bg-white border border-teal-100 p-2">
              {historyLoading ? (
                <div className="h-full flex items-center justify-center">
                  <p className="text-sm text-muted-foreground">Loading your trend…</p>
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex items-center justify-center px-6">
                  <p className="text-xs text-muted-foreground text-center">
                    You do not have any score history yet. Your trend will appear after your next update.
                  </p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                    <CartesianGrid stroke="hsl(180, 30%, 90%)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: "hsl(215, 15%, 45%)" }}
                      axisLine={{ stroke: "hsl(180, 30%, 85%)" }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={["dataMin - 20", "dataMax + 20"]}
                      tick={{ fontSize: 10, fill: "hsl(215, 15%, 45%)" }}
                      axisLine={{ stroke: "hsl(180, 30%, 85%)" }}
                      tickLine={false}
                      width={32}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "white",
                        border: "1px solid hsl(180, 30%, 88%)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "hsl(215, 15%, 30%)" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="hsl(180, 65%, 40%)"
                      strokeWidth={2.5}
                      dot={{ r: 3, fill: "hsl(25, 90%, 55%)" }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SphereOfInfluence;
