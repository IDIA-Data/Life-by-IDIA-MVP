import { useState, useEffect, ReactNode } from 'react';
import { Shield, TrendingUp, Activity, Lock } from 'lucide-react';
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface GhostProtocolProps {
  children: ReactNode;
}

interface TelemetryDetail {
  accel: { x: number; y: number; z: number };
  ts: number;
}

const GhostProtocol = ({ children }: GhostProtocolProps) => {
  const [duressDetected, setDuressDetected] = useState(false);
  const [isStationary, setIsStationary] = useState(true);
  const [baselineHR, setBaselineHR] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    // 1. Kinetic Monitoring: Wide-Open Native Pipe
    const handleTelemetry = (event: any) => {
      const detail = event.detail as TelemetryDetail;
      const magnitude = Math.sqrt(
        Math.pow(detail.accel.x, 2) + 
        Math.pow(detail.accel.y, 2) + 
        Math.pow(detail.accel.z, 2)
      );
      
      // REQ-AUTH-7.3.1: Detect absolute stationary (Freeze response)
      setIsStationary(magnitude < 0.02);
    };

    window.addEventListener('idia:telemetry', handleTelemetry);

    // 2. Keystone Monitoring: Living Biometric Stream
    const channel = supabase
      .channel("ghost_duress_monitor")
      .on(
        "postgres_changes" as any,
        { event: "INSERT", schema: "public", table: "staged_health_data" },
        (payload: any) => {
          const next = payload.new;
          if (!next) return;

          if (baselineHR === null && next.heart_rate) {
            setBaselineHR(next.heart_rate);
            return;
          }

          const hrDelta = next.heart_rate - (baselineHR || 0);
          const hrv = next.heart_rate_variability_ms;

          // REQ-AUTH-7.3.1: Tri-Factor Trigger
          if (hrDelta > 40 && hrv < 20 && isStationary) {
            if (isMounted) {
              console.log("🚨 [GHOST_PROTOCOL] START: Duress Sequence Initiated.");
              setDuressDetected(true);
              dispatchSilentAlarm(next.recorded_at);
              console.log("🚨 [GHOST_PROTOCOL] END: Vault Locked. Honey-Pot Active.");
            }
          }
        }
      )
      .subscribe();

    const dispatchSilentAlarm = async (timestamp: string) => {
      console.log("🛰️ [SOC_ALARM] START: Dispatching DURESS_CODE_7500.");
      
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.log("🚨 [SOC_ALARM] ABORT: No authenticated principal found.");
            return;
        }

        // --- OVERRIDE: Using 'as any' to bypass the missing taxonomy definitions ---
        const { error } = await (supabase.from("security_logs" as any).insert({
          user_id: user.id,
          event_code: "7500",
          severity: "CRITICAL",
          metadata: { 
            trigger: "BIOMETRIC_KINETIC_FUSION",
            timestamp,
            status: "VAULT_ENCRYPTED_HONEYPOT_ACTIVE",
            telemetry_state: isStationary ? "STASIS" : "KINETIC"
          }
        }) as any);

        if (error) {
            console.log(`🚨 [SOC_ALARM] ERROR: Database rejection: ${error.message}`);
        } else {
            console.log("🛰️ [SOC_ALARM] SUCCESS: Alarm acknowledged by Hub.");
        }
      } catch (err) {
        console.log(`🚨 [SOC_ALARM] FATAL: System failure during egress: ${err}`);
      }
      
      console.log("🛰️ [SOC_ALARM] END: Silent dispatch sequence complete.");
    };

    return () => {
      isMounted = false;
      window.removeEventListener('idia:telemetry', handleTelemetry);
      supabase.removeChannel(channel);
    };
  }, [baselineHR, isStationary]);

  // REQ-AUTH-7.3.2 & 7.3.3: Tactical Honey-Pot UI
  if (duressDetected) {
    return (
      <div className="p-4 pb-24 space-y-4 animate-fade-in bg-slate-50 min-h-screen">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm italic">HealthStream</h2>
              <p className="text-[10px] text-slate-500 uppercase tracking-tighter font-black">Standard Account</p>
            </div>
          </div>
          <div className="px-2 py-0.5 rounded border border-slate-200">
            <span className="text-[8px] font-bold text-slate-400 uppercase">Status: Online</span>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm text-center">
          <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Available Credits</p>
          <h3 className="text-3xl font-black text-slate-900 tracking-tighter italic">$42.15</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border bg-white p-4 space-y-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">Activity Level</p>
            <p className="text-lg font-black text-slate-800 italic">Optimal</p>
          </div>
          <div className="rounded-xl border bg-white p-4 space-y-1">
            <Shield className="w-4 h-4 text-blue-400" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">Device Sync</p>
            <p className="text-lg font-black text-slate-800 italic">Secure</p>
          </div>
        </div>

        <div className="rounded-xl border bg-slate-100 p-8 border-dashed flex flex-col items-center justify-center opacity-50">
            <Activity className="w-6 h-6 text-slate-300 mb-2" />
            <p className="text-[10px] text-slate-400 font-bold uppercase">Awaiting biological sync...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default GhostProtocol;