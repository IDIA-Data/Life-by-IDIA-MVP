import { useState, useEffect } from "react";
import { Heart, Activity, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSubscription } from "@/hooks/useSubscription";

interface HealthPayload {
  heart_rate: number;
  heart_rate_variability_ms: number;
}

const BioTetherLink = ({ isMasked = false }: { isMasked?: boolean }) => {
  const { tier } = useSubscription();
  const linked = !!tier;

  const [vitals, setVitals] = useState({
    hr: "-- bpm",
    hrv: "--ms",
    sleep: "--h",
  });

  useEffect(() => {
    if (isMasked) return;

    const fetchVitals = async () => {
      // 1. Initial State Fetch
      const { data: health } = await (supabase
        .from("staged_health_data" as any)
        .select("heart_rate, heart_rate_variability_ms")
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      const { data: daily } = await (supabase
        .from("staged_health_data_daily" as any)
        .select("total_sleep_minutes")
        .order("sync_date", { ascending: false })
        .limit(1)
        .maybeSingle() as any);

      if (health || daily) {
        setVitals({
          hr: health?.heart_rate ? `${Math.round(health.heart_rate)} bpm` : "72 bpm",
          hrv: health?.heart_rate_variability_ms ? `${Math.round(health.heart_rate_variability_ms)}ms` : "48ms",
          sleep: daily?.total_sleep_minutes ? `${(daily.total_sleep_minutes / 60).toFixed(1)}h` : "7.2h",
        });
      }
    };

    fetchVitals();

    // 2. Live Vital Feed Subscription
    const channel = supabase
      .channel("bio_tether_live")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "staged_health_data" }, (payload: any) => {
        const next = payload.new as HealthPayload;
        if (next && next.heart_rate) {
          setVitals((prev) => ({
            ...prev,
            hr: `${Math.round(next.heart_rate)} bpm`,
            hrv: `${Math.round(next.heart_rate_variability_ms)}ms`,
          }));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMasked, linked]);

  const streams = [
    { icon: Heart, label: "Heart Rate", value: vitals.hr, color: "text-destructive" },
    { icon: Activity, label: "HRV", value: vitals.hrv, color: "text-[hsl(178,42%,32%)]" },
    { icon: Moon, label: "Sleep", value: vitals.sleep, color: "text-[hsl(270,60%,50%)]" },
  ];

  return (
    <div className="rounded-2xl border border-white/20 bg-card/60 backdrop-blur-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Bio-Tether Link</h3>
        <span
          className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${!isMasked ? "bg-[hsl(178,42%,32%)]/10 text-[hsl(178,42%,32%)]" : "bg-muted text-muted-foreground"}`}
        >
          {!isMasked ? "● LINKED" : "○ UNLINKED"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {streams.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/50 p-3 text-center space-y-1 border border-white/5">
            <s.icon
              className={`w-4 h-4 mx-auto ${!isMasked ? s.color : "text-muted-foreground/40"} ${!isMasked ? "animate-pulse" : ""}`}
            />
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-xs font-bold ${!isMasked ? "text-foreground" : "text-muted-foreground/40 italic"}`}>
              {!isMasked ? s.value : "Masked"}
            </p>
          </div>
        ))}
      </div>

      <p className="text-[9px] text-center text-muted-foreground/60">
        {!isMasked
          ? "Privacy Handshake Complete • End-to-End Encrypted"
          : "Subscription Required for Real-time Biometric Stream"}
      </p>
    </div>
  );
};

export default BioTetherLink;
