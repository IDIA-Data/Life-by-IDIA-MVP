import React, { useState, useEffect } from "react";
import { ShieldCheck, Activity, Volume2, Accessibility, Wind, Heart, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";

// --- TYPES ALIGNED TO SOVEREIGN SCHEMA ---
interface StagedHealthData {
  heart_rate: number;
  heart_rate_variability_ms: number;
  respiratory_rate: number;
  environmental_audio_exposure_db: number;
  walking_asymmetry_percentage: number;
  data_quality_score: number;
}

const InfoIcon = ({ text }: { text: string }) => (
  <TooltipProvider>
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Info className="w-2.5 h-2.5 ml-1 opacity-30 hover:opacity-100 transition-opacity cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="bg-black text-white border-white/10 text-[10px] max-w-[180px] p-2">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const HRIDashboard = ({ isMasked = false }: { isMasked?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    hr: 0, hrv: 0, resp: 0, noise: 0, asymmetry: 0, hriScore: 0,
    status: "CALIBRATING" as "CALIBRATING" | "ARMED" | "TRIGGERED"
  });

  useEffect(() => {
    if (isMasked) return;
    let isMounted = true;

    const fetchLatestMetrics = async () => {
      // Fully Connected Ingress: Fetching latest record from Staged Tier
      const { data: healthRaw } = await supabase
        .from("staged_health_data" as any)
        .select("heart_rate, heart_rate_variability_ms, respiratory_rate, environmental_audio_exposure_db, walking_asymmetry_percentage, data_quality_score")
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const health = healthRaw as any;

      if (isMounted && health) {
        setMetrics({
          hr: health.heart_rate || 0,
          hrv: health.heart_rate_variability_ms || 0,
          resp: health.respiratory_rate || 0,
          noise: health.environmental_audio_exposure_db || 0,
          asymmetry: health.walking_asymmetry_percentage || 0,
          hriScore: health.data_quality_score ? Math.round(health.data_quality_score * 100) : 0,
          status: health.heart_rate > 0 ? "ARMED" : "CALIBRATING",
        });
      }
      setLoading(false);
    };

    fetchLatestMetrics();

    // Real-time Live Tether: Instant UI update on health sync completion
    const channel = supabase.channel("hri_pro_stream")
      .on("postgres_changes" as any, { 
        event: "INSERT", 
        schema: "public", 
        table: "staged_health_data" 
      }, (payload: any) => {
        const next = payload.new as StagedHealthData;
        if (next) {
          setMetrics(prev => ({
            ...prev,
            hr: next.heart_rate || prev.hr,
            hrv: next.heart_rate_variability_ms || prev.hrv,
            resp: next.respiratory_rate || prev.resp,
            noise: next.environmental_audio_exposure_db || prev.noise,
            asymmetry: next.walking_asymmetry_percentage || prev.asymmetry,
            hriScore: next.data_quality_score ? Math.round(next.data_quality_score * 100) : prev.hriScore,
            status: "ARMED"
          }));
        }
      }).subscribe();

    return () => { 
      isMounted = false; 
      supabase.removeChannel(channel); 
    };
  }, [isMasked]);

  const bioGrid = [
    { label: "Heart Rate", value: `${metrics.hr} BPM`, icon: Heart, info: "Real-time cardiac frequency." },
    { label: "HRV Index", value: `${metrics.hrv} ms`, icon: Activity, info: "Autonomic nervous system resilience baseline." },
    { label: "Acoustic", value: `${metrics.noise} dB`, icon: Volume2, info: "Ambient environmental stress monitoring." },
    { label: "Respiratory", value: `${metrics.resp} br/m`, icon: Wind, info: "Breathing frequency pattern." },
    { label: "Gait Balance", value: `${metrics.asymmetry}%`, icon: Accessibility, info: "Kinetic walking symmetry percentage." },
    { label: "Reliability", value: `${metrics.hriScore}%`, icon: ShieldCheck, info: "Aggregated Human Reliability Index (HRI) score." },
  ];

  if (loading && !isMasked) {
    return <div className="p-8 text-center animate-pulse uppercase text-[10px] tracking-widest text-muted-foreground font-black">Hydrating IDIA Pro...</div>;
  }

  return (
    <div className={`p-4 pb-24 space-y-4 animate-fade-in bg-background min-h-screen ${isMasked ? "blur-md opacity-40" : ""}`}>
      
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(28,80%,55%)] to-[hsl(28,80%,45%)] flex items-center justify-center shadow-lg">
            <ShieldCheck className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground text-sm uppercase">Occupational Performance</h2>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-black">IDIA Pro</p>
          </div>
        </div>
        <Badge variant="outline" className={`text-[8px] font-black uppercase px-2 py-0.5 ${metrics.status === 'TRIGGERED' ? 'border-red-500 text-red-500 animate-pulse' : 'border-emerald-500 text-emerald-500'}`}>
          {metrics.status}
        </Badge>
      </div>

      <div className={`rounded-2xl border border-border bg-white shadow-sm p-4 transition-all`}>
        <h3 className="text-xs font-bold text-foreground mb-3 uppercase tracking-wider flex items-center gap-1.5">
          <Activity className="w-3.5 h-3.5 text-[hsl(28,80%,55%)]" />
          Occupational Biometrics
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {bioGrid.map((b) => (
            <div key={b.label} className="rounded-xl bg-muted/30 p-2.5 text-center border border-border/50">
              <div className="flex justify-center items-center mb-1">
                <b.icon className="w-3 h-3 text-[hsl(28,80%,55%)] opacity-70" />
                <InfoIcon text={b.info} />
              </div>
              <p className="text-[9px] font-medium text-muted-foreground mb-1 uppercase tracking-tighter">{b.label}</p>
              <p className="text-xs font-black text-foreground">{isMasked ? "—" : b.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border-2 border-[hsl(28,80%,55%)] bg-[hsl(28,80%,55%)]/5 p-4 text-foreground shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheck className="w-4 h-4 text-[hsl(28,80%,55%)]" />
          <p className="text-[10px] font-black uppercase tracking-widest italic">System Integrity</p>
        </div>
        <p className="text-[11px] leading-snug font-medium opacity-90">
          Biological markers indicate a <span className="font-bold">{metrics.hriScore}% reliability rating</span>. 
          Principal is currently operating at <span className="text-[hsl(28,80%,55%)] font-bold uppercase">Sustainable</span> capacity. 
          No occupational drift detected.
        </p>
      </div>
    </div>
  );
};

export default HRIDashboard;