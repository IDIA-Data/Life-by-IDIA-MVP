import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Zap, Info, Lock, Volume2, Target, RotateCcw, Smartphone,
  Heart, Activity, Wind, Accessibility, Shield, Trophy, ShieldCheck, ShieldAlert
} from "lucide-react";
import { ComposedChart, Line, Bar, XAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// UI Components
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";

// IDIA Protocol Components
import GhostProtocolWrapper from "./GhostProtocol";
import { GammaPhotosensitivityWarning } from "./GammaPhotosensitivityWarning";
import InsightsSection from "./insights/InsightsSection";

// --- EXPANDED SOVEREIGN SCHEMA ---
interface StagedHealthData {
  heart_rate: number | null;
  heart_rate_variability_ms: number | null;
  respiratory_rate: number | null;
  environmental_audio_exposure_db: number | null;
  walking_asymmetry_percentage: number | null;
  data_quality_score: number | null;
  effort_score: number | null;
  created_at: string;
  steps_count: number | null;
  double_support_percentage: number | null;
  step_length_cm: number | null;
  walking_speed_kmh: number | null;
  uv_exposure_index: number | null;
  resting_heart_rate: number | null;
  blood_oxygen_percentage: number | null;
  walking_steadiness_percentage: number | null;
  active_energy_kcal: number | null;
  basal_energy_kcal: number | null;
  body_temperature_f: number | null;
  vo2_max: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  sleep_analysis_value: number | null;
}

interface FiatLedgerEntry {
  amount_usd: number;
  created_at: string;
}

// Live-Wired Event Logs
interface SecurityEventLog {
  id: string;
  protocol: 'ghost' | 'acoustic';
  event_type: string;
  severity: 'info' | 'warning' | 'critical';
  description: string;
  created_at: string;
}

interface PureAlphaDashboardProps {
  isMasked?: boolean;
}

const RSVP_WORDS = ["FOCUS", "CLARITY", "RESOLVE", "EXECUTE", "DOMINATE", "OPTIMIZE", "TRANSCEND", "SOVEREIGN", "VELOCITY", "BASELINE", "INTEGRITY", "ALPHA"];

// Minimalist Info Helper
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

const PureAlphaDashboard = ({ isMasked = false }: PureAlphaDashboardProps) => {
  // --- CORE STATE ---
  const [userId, setUserId] = useState<string | null>(null);
  const [fusionData, setFusionData] = useState<any[]>([]);
  const [hasIdiaPayOrgAdmin, setHasIdiaPayOrgAdmin] = useState(false);
  
  const [pureAlphaView, setPureAlphaView] = useState<'fusion' | 'balance' | 'cash' | 'ghost' | 'acoustics'>('fusion');

  // --- LOGS STATE ---
  const [ghostLogs, setGhostLogs] = useState<SecurityEventLog[]>([]);
  const [acousticLogs, setAcousticLogs] = useState<SecurityEventLog[]>([]);

  // --- CORE BIOMETRICS STATE ---
  const [metrics, setMetrics] = useState({
    hr: null as number | null, hrv: null as number | null, resp: null as number | null, noise: null as number | null, asymmetry: null as number | null,
    focusScore: null as number | null, stressIndex: null as number | null, recovery: null as number | null, hriScore: null as number | null,
    status: "CALIBRATING" as "CALIBRATING" | "ARMED" | "TRIGGERED"
  });

  const [telemetry, setTelemetry] = useState({
    steps: null as number | null, restingHr: null as number | null, spo2: null as number | null, vo2Max: null as number | null,
    temp: null as number | null, bpSys: null as number | null, bpDia: null as number | null, activeEnergy: null as number | null,
    basalEnergy: null as number | null, steadiness: null as number | null, doubleSupport: null as number | null,
    stepLength: null as number | null, uv: null as number | null, sleep: null as number | null,
  });

  // --- GAMMA & RSVP STATE ---
  const [gammaActive, setGammaActive] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [gammaWarningOpen, setGammaWarningOpen] = useState(false);
  
  const [rsvpPhase, setRsvpPhase] = useState<'IDLE' | 'CALIBRATING' | 'PRESENTING' | 'MASK' | 'RECALL' | 'ROUND_COMPLETE' | 'RESULT'>('IDLE');
  const [testRound, setTestRound] = useState(1);
  const [rsvpWordIndex, setRsvpWordIndex] = useState(0);
  const [rsvpSpeed, setRsvpSpeed] = useState(300);
  const [activeSequence, setActiveSequence] = useState<string[]>([]);
  const [userRecall, setUserInput] = useState<string[]>([]);
  const [cumulativeScore, setCumulativeScore] = useState(0);

  // --- ADJUSTABLE SETTINGS STATE ---
  const [settings, setSettings] = useState({
    honey_pot: true,
    digital_ward: false,
    silver_sentinel: false,
    aegis_protocol: true,
    ambient_isolation: true,
    coercion_detector: true,
    impact_trauma_sync: true,
  });

  // Live-Wired Settings Sync
  const toggleSetting = async (key: keyof typeof settings) => {
    const newValue = !settings[key];
    
    // Optimistic UI Update
    setSettings(prev => ({ ...prev, [key]: newValue }));

    if (!userId) return;

    try {
      // Upsert configuration directly to DB
      const { error } = await supabase
        .from('security_preferences' as any)
        .upsert({ user_id: userId, [key]: newValue }, { onConflict: 'user_id' });
      
      if (error) throw error;

      toast({
        title: "Protocol Configuration Updated",
        description: `${key.replace('_', ' ').toUpperCase()} is now ${newValue ? 'ARMED' : 'DISARMED'}.`,
        variant: newValue ? "default" : "destructive",
      });
    } catch (err) {
      console.error("Failed to sync security preference:", err);
      // Revert on failure
      setSettings(prev => ({ ...prev, [key]: !newValue }));
    }
  };

  // --- DATA FETCHING (Zero Mock Data) ---
  useEffect(() => {
    if (isMasked) return;
    let isMounted = true;

    const fetchExecutiveData = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          if (isMounted) setUserId(userData.user.id);
          if (userData.user.app_metadata?.role === 'org_admin') {
            setHasIdiaPayOrgAdmin(true);
          }

          // Fetch Live Settings
          const { data: prefsRawData } = await supabase
            .from("security_preferences" as any)
            .select("*")
            .eq("user_id", userData.user.id)
            .maybeSingle();
          const prefsRaw = prefsRawData as any;

          if (prefsRaw && isMounted) {
            setSettings({
              honey_pot: prefsRaw.honey_pot ?? true,
              digital_ward: prefsRaw.digital_ward ?? false,
              silver_sentinel: prefsRaw.silver_sentinel ?? false,
              aegis_protocol: prefsRaw.aegis_protocol ?? true,
              ambient_isolation: prefsRaw.ambient_isolation ?? true,
              coercion_detector: prefsRaw.coercion_detector ?? true,
              impact_trauma_sync: prefsRaw.impact_trauma_sync ?? true,
            });
          }
        }

        // Fetch Event Logs
        const { data: logsRaw } = await supabase
          .from("security_event_logs" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20);
        
        const logs = logsRaw as unknown as SecurityEventLog[] | null;
        if (logs && isMounted) {
          setGhostLogs(logs.filter(l => l.protocol === 'ghost'));
          setAcousticLogs(logs.filter(l => l.protocol === 'acoustic'));
        }

        const { data: healthRaw } = await supabase
          .from("staged_health_data" as any)
          .select("*")
          .order("created_at", { ascending: false })
          .limit(7);
        
        const healthLogs = healthRaw as unknown as StagedHealthData[] | null;

        if (isMounted && healthLogs && healthLogs.length > 0) {
          const latest = healthLogs[0];
          
          setMetrics({
            hr: latest.heart_rate, hrv: latest.heart_rate_variability_ms, resp: latest.respiratory_rate, 
            noise: latest.environmental_audio_exposure_db, asymmetry: latest.walking_asymmetry_percentage,
            focusScore: latest.data_quality_score ? Math.round(latest.data_quality_score * 100) : null,
            stressIndex: latest.heart_rate_variability_ms ? Number((100 / latest.heart_rate_variability_ms).toFixed(2)) : null,
            recovery: latest.effort_score ? Math.round(latest.effort_score) : null,
            hriScore: latest.data_quality_score ? Math.round(latest.data_quality_score * 100) : null,
            status: latest.heart_rate ? "ARMED" : "CALIBRATING",
          });

          setTelemetry({
            steps: latest.steps_count, restingHr: latest.resting_heart_rate, spo2: latest.blood_oxygen_percentage,
            vo2Max: latest.vo2_max, temp: latest.body_temperature_f, bpSys: latest.blood_pressure_systolic,
            bpDia: latest.blood_pressure_diastolic, activeEnergy: latest.active_energy_kcal, basalEnergy: latest.basal_energy_kcal,
            steadiness: latest.walking_steadiness_percentage, doubleSupport: latest.double_support_percentage,
            stepLength: latest.step_length_cm, uv: latest.uv_exposure_index, sleep: latest.sleep_analysis_value
          });
        }

        const { data: ledgerRaw } = await supabase
          .from("fiat_ledger" as any)
          .select("amount_usd, created_at")
          .order("created_at", { ascending: false })
          .limit(7);
        
        const ledger = ledgerRaw as unknown as FiatLedgerEntry[] | null;

        if (isMounted && healthLogs && ledger) {
          const chartData = healthLogs
            .map((log, i) => ({
              day: new Date(log.created_at).toLocaleDateString("en-US", { weekday: "short" }),
              hrv: log.heart_rate_variability_ms ? Math.round(log.heart_rate_variability_ms) : 0,
              revenue: ledger[i]?.amount_usd || 0,
            }))
            .reverse();

          setFusionData(chartData);
        }
      } catch (err) {
        console.error("Pure Alpha Egress Stalled:", err);
      }
    };

    fetchExecutiveData();

    // Live Synapse Subscriptions
    const healthChannel = supabase.channel("pure_alpha_live")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "staged_health_data" }, (payload: any) => {
        const next = payload.new as StagedHealthData;
        if (isMounted && next) {
          setMetrics(prev => ({
            ...prev,
            hr: next.heart_rate !== null ? next.heart_rate : prev.hr, 
            hrv: next.heart_rate_variability_ms !== null ? next.heart_rate_variability_ms : prev.hrv,
            resp: next.respiratory_rate !== null ? next.respiratory_rate : prev.resp, 
            noise: next.environmental_audio_exposure_db !== null ? next.environmental_audio_exposure_db : prev.noise,
            asymmetry: next.walking_asymmetry_percentage !== null ? next.walking_asymmetry_percentage : prev.asymmetry,
            hriScore: next.data_quality_score ? Math.round(next.data_quality_score * 100) : prev.hriScore,
          }));
        }
      })
      .subscribe();

    const logsChannel = supabase.channel("pure_alpha_logs")
      .on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "security_event_logs" }, (payload: any) => {
        const newLog = payload.new as SecurityEventLog;
        if (isMounted && newLog) {
          if (newLog.protocol === 'ghost') setGhostLogs(prev => [newLog, ...prev]);
          if (newLog.protocol === 'acoustic') setAcousticLogs(prev => [newLog, ...prev]);
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(healthChannel);
      supabase.removeChannel(logsChannel);
    };
  }, [isMasked]);

  // --- GAMMA & RSVP LOGIC ---
  const getDynamicFontSize = (word: string) => {
    const len = word.length;
    if (len > 10) return "text-[8vw]"; 
    if (len > 8) return "text-[10vw]"; 
    return "text-[12vw]"; 
  };

  useEffect(() => {
    if (rsvpPhase === 'PRESENTING') {
      const timer = setTimeout(() => setRsvpPhase('MASK'), rsvpSpeed);
      return () => clearTimeout(timer);
    }
    if (rsvpPhase === 'MASK') {
      const timer = setTimeout(() => {
        if (rsvpWordIndex >= activeSequence.length - 1) {
          setRsvpPhase('RECALL');
        } else {
          setRsvpWordIndex(prev => prev + 1);
          setRsvpPhase('PRESENTING');
        }
      }, 40);
      return () => clearTimeout(timer);
    }
  }, [rsvpPhase, rsvpSpeed, rsvpWordIndex, activeSequence]);

  const toggleOrientation = (landscape: boolean) => {
    if (window.webkit?.messageHandlers?.syncHealthData) {
      window.webkit.messageHandlers.syncHealthData.postMessage({ 
        action: landscape ? "CMD_LOCK_LANDSCAPE" : "CMD_LOCK_PORTRAIT" 
      });
    }
  };

  const startNewRound = (round: number) => {
    const sequence = [...RSVP_WORDS].sort(() => 0.5 - Math.random()).slice(0, 5);
    setActiveSequence(sequence);
    setUserInput([]);
    setRsvpWordIndex(0);
    setTestRound(round);
    setRsvpPhase('CALIBRATING');
    setTimeout(() => setRsvpPhase('PRESENTING'), 1000);
  };

  const resetFullTest = () => {
    setCumulativeScore(0);
    toggleOrientation(true);
    startNewRound(1);
  };

  const endTest = () => {
    setRsvpPhase('IDLE');
    toggleOrientation(false);
  };

  const handleRecallSelection = (word: string) => {
    if (userRecall.includes(word)) return;
    const newRecall = [...userRecall, word];
    setUserInput(newRecall);
    
    if (newRecall.length === activeSequence.length) {
      const correct = newRecall.filter((w, i) => w === activeSequence[i]).length;
      const roundScore = Math.round((correct / activeSequence.length * 100) * (1000 / rsvpSpeed));
      setCumulativeScore(prev => prev + roundScore);
      
      if (testRound < 5) {
        setRsvpPhase('ROUND_COMPLETE');
        setTimeout(() => startNewRound(testRound + 1), 1200);
      } else {
        setRsvpPhase('RESULT');
      }
    }
  };

  const triggerGammaSequence = async (active: boolean) => {
    setGammaActive(active);
    if (active) {
      if (window.webkit?.messageHandlers?.syncHealthData) {
        window.webkit.messageHandlers.syncHealthData.postMessage({
          action: "CMD_INIT_FLASHBULB", frequency: 40, force_brightness: 1.0, audio_enabled: true
        });
      }
      setIsFlashing(true);
    } else {
      if (window.webkit?.messageHandlers?.syncHealthData) {
        window.webkit.messageHandlers.syncHealthData.postMessage({ action: "CMD_STOP_FLASHBULB" });
      }
      setIsFlashing(false);
    }
  };

  const handleGammaToggle = (checked: boolean) => {
    if (checked) {
      console.log("[PureAlphaDashboard:UI] Gamma requested. Opening safety gate.");
      setGammaWarningOpen(true);
    } else {
      console.log("[PureAlphaDashboard:UI] Disabling Gamma sequence.");
      triggerGammaSequence(false);
    }
  };

  // --- RENDER ---
  return (
    <GhostProtocolWrapper>
      <GammaPhotosensitivityWarning
        open={gammaWarningOpen}
        surface="PureAlphaDashboard"
        onCancel={() => setGammaWarningOpen(false)}
        onAcknowledge={() => { setGammaWarningOpen(false); triggerGammaSequence(true); }}
      />
      {isFlashing && createPortal(
        <div 
          className="fixed -inset-[200%] z-[99999] pointer-events-none animate-[seizure-rgb_25ms_linear_infinite]" 
          style={{ mixBlendMode: 'difference' }}
        />,
        document.body
      )}

      <div className={`p-4 pb-24 space-y-4 animate-fade-in bg-background min-h-screen font-sans ${isMasked ? "blur-md pointer-events-none" : ""}`}>
        
        {/* Sovereign Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(178,42%,42%)] flex items-center justify-center shadow-sm">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-tighter">Executive Sovereignty</h2>
              <p className="text-[10px] text-teal-600 uppercase font-black tracking-widest">Pure Alpha Access</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[8px] border-teal-100 text-teal-600 font-bold px-2 py-0 uppercase">
            Auth Active
          </Badge>
        </div>

        {/* TOP LEVEL NAVIGATION */}
        <Tabs defaultValue="pure-alpha" className="w-full">
          <TabsList className="flex w-full bg-transparent border-b border-slate-100 p-0 rounded-none h-10 mb-6 gap-6 overflow-x-auto no-scrollbar justify-start">
            <TabsTrigger value="pure-alpha" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all whitespace-nowrap">Pure Alpha</TabsTrigger>
            <TabsTrigger value="biometrics" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all whitespace-nowrap">Biometrics</TabsTrigger>
            <TabsTrigger value="gamma" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all whitespace-nowrap">Gamma</TabsTrigger>
            <TabsTrigger value="memory" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all whitespace-nowrap">Anchor</TabsTrigger>
          </TabsList>

          {/* 1. PURE ALPHA TAB */}
          <TabsContent value="pure-alpha" className="space-y-6 focus-visible:outline-none">
            
            <div className="flex items-center gap-2 mb-2 overflow-x-auto no-scrollbar pb-2">
              <Badge 
                onClick={() => setPureAlphaView('fusion')}
                className={`text-[10px] uppercase font-bold cursor-pointer whitespace-nowrap px-3 py-1 ${pureAlphaView === 'fusion' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-muted-foreground hover:bg-muted border border-border'}`}
              >
                P&L Fusion
              </Badge>
              <Badge 
                onClick={() => setPureAlphaView('balance')}
                className={`text-[10px] uppercase font-bold cursor-pointer whitespace-nowrap px-3 py-1 ${pureAlphaView === 'balance' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-muted-foreground hover:bg-muted border border-border'}`}
              >
                Balance Sheet
              </Badge>
              <Badge 
                onClick={() => setPureAlphaView('cash')}
                className={`text-[10px] uppercase font-bold cursor-pointer whitespace-nowrap px-3 py-1 ${pureAlphaView === 'cash' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-muted-foreground hover:bg-muted border border-border'}`}
              >
                Cash Flow
              </Badge>
              <Badge 
                onClick={() => setPureAlphaView('ghost')}
                className={`text-[10px] uppercase font-bold cursor-pointer whitespace-nowrap px-3 py-1 ${pureAlphaView === 'ghost' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-muted-foreground hover:bg-muted border border-border'}`}
              >
                Ghost Protocol
              </Badge>
              <Badge 
                onClick={() => setPureAlphaView('acoustics')}
                className={`text-[10px] uppercase font-bold cursor-pointer whitespace-nowrap px-3 py-1 ${pureAlphaView === 'acoustics' ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-card text-muted-foreground hover:bg-muted border border-border'}`}
              >
                Acoustics
              </Badge>
            </div>

            {pureAlphaView === 'fusion' && (
              <Card className="border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <CardHeader className="p-5 pb-2">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center text-slate-900">
                    P&L Fusion Ledger
                    <InfoIcon text="Real-time correlation between your Autonomic Resilience (HRV) and Capital Generation." />
                  </CardTitle>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Bio-State vs Liquid Revenue</p>
                </CardHeader>
                <CardContent className="p-0 h-56">
                  {hasIdiaPayOrgAdmin ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={fusionData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: "#94a3b8", fontWeight: "900" }} axisLine={false} tickLine={false} />
                        <RechartsTooltip
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1)", fontSize: "10px", fontWeight: "bold" }}
                        />
                        <Bar yAxisId="r" dataKey="revenue" fill="hsl(178, 42%, 42%)" radius={[4, 4, 0, 0]} opacity={0.8} />
                        <Line yAxisId="l" type="monotone" dataKey="hrv" stroke="#f97316" strokeWidth={3} dot={{ r: 4, fill: "#f97316", strokeWidth: 2, stroke: "#fff" }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-center p-4">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">IDIA Pay Org Admin <br/> Sync Required</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {pureAlphaView === 'balance' && (
              <Card className="border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <CardHeader className="p-5">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center text-slate-900">
                    Balance Sheet
                  </CardTitle>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Asset & Liability Overview</p>
                </CardHeader>
                <CardContent className="p-10 text-center text-slate-300 text-[10px] uppercase font-black">
                  {hasIdiaPayOrgAdmin ? "No active ledger entries." : "IDIA Pay Org Admin Sync Required."}
                </CardContent>
              </Card>
            )}

            {pureAlphaView === 'cash' && (
              <Card className="border-slate-100 shadow-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <CardHeader className="p-5">
                  <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center text-slate-900">
                    Cash Flow
                  </CardTitle>
                  <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tighter">Liquidity Velocity</p>
                </CardHeader>
                <CardContent className="p-10 text-center text-slate-300 text-[10px] uppercase font-black">
                  {hasIdiaPayOrgAdmin ? "No active transaction flow." : "IDIA Pay Org Admin Sync Required."}
                </CardContent>
              </Card>
            )}

            {pureAlphaView === 'ghost' && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <Card className="border-orange-100 bg-orange-50/30 shadow-sm overflow-hidden">
                  <CardHeader className="p-5 pb-2 border-b border-orange-100/50">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                      <Lock className="w-4 h-4 text-orange-500" />
                      Ghost Protocol Configuration
                    </CardTitle>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                      Configure autonomous duress defense and enclave routing.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-4 border-b border-orange-100/50">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Honey-Pot State</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Simulate success & lock true ledger during HRV crash.</p>
                      </div>
                      <Switch checked={settings.honey_pot} onCheckedChange={() => toggleSetting('honey_pot')} className="data-[state=checked]:bg-orange-500" />
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-orange-100/50">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Digital Ward (Minors)</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Segregate data & trigger route deviation alerts.</p>
                      </div>
                      <Switch checked={settings.digital_ward} onCheckedChange={() => toggleSetting('digital_ward')} />
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-orange-100/50">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Silver Sentinel (Elders)</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Cardio-ID verification & beneficiary wall blocks.</p>
                      </div>
                      <Switch checked={settings.silver_sentinel} onCheckedChange={() => toggleSetting('silver_sentinel')} />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Aegis Protocol</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Truman sandbox & foreign IoT tracker sniffing.</p>
                      </div>
                      <Switch checked={settings.aegis_protocol} onCheckedChange={() => toggleSetting('aegis_protocol')} />
                    </div>
                  </CardContent>
                </Card>

                {/* GHOST PROTOCOL LOGS */}
                <Card className="border-slate-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-slate-400" /> Activity Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {ghostLogs.length > 0 ? (
                      <ul className="divide-y divide-slate-50">
                        {ghostLogs.map(log => (
                          <li key={log.id} className="p-4 flex justify-between items-center bg-card">
                            <div>
                              <p className={`text-[10px] font-bold uppercase ${log.severity === 'critical' ? 'text-rose-600' : 'text-slate-900'}`}>{log.event_type}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">{log.description}</p>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-8 text-center bg-card">
                        <ShieldCheck className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Zero Intrusions</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-1">No ghost protocol events detected.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {pureAlphaView === 'acoustics' && (
              <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <Card className="border-slate-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-5 pb-2 border-b border-slate-50 bg-indigo-50/10">
                    <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2 text-slate-900">
                      <Volume2 className="w-4 h-4 text-indigo-500" />
                      Acoustic Configuration
                    </CardTitle>
                    <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                      Manage environmental coercion and ambient threat engines.
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between p-4 border-b border-slate-50">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Ambient Isolation</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Soft-block if unexpected voices are detected.</p>
                      </div>
                      <Switch checked={settings.ambient_isolation} onCheckedChange={() => toggleSetting('ambient_isolation')} />
                    </div>
                    <div className="flex items-center justify-between p-4 border-b border-slate-50">
                      <div>
                        <p className="text-[10px] font-black text-slate-900 uppercase">Coercion Detector</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Analyze voice tremor & acute stress markers.</p>
                      </div>
                      <Switch checked={settings.coercion_detector} onCheckedChange={() => toggleSetting('coercion_detector')} />
                    </div>
                    <div className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-[10px] font-black text-rose-600 uppercase">Impact Trauma Sync</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Log high-decibel audio + physical impact to vault.</p>
                      </div>
                      <Switch checked={settings.impact_trauma_sync} onCheckedChange={() => toggleSetting('impact_trauma_sync')} className="data-[state=checked]:bg-rose-500" />
                    </div>
                  </CardContent>
                </Card>

                {/* ACOUSTICS LOGS */}
                <Card className="border-slate-100 shadow-sm overflow-hidden">
                  <CardHeader className="p-4 border-b border-slate-50 bg-slate-50/50">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-slate-900 flex items-center gap-2">
                      <Volume2 className="w-3.5 h-3.5 text-slate-400" /> Acoustic Logs
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {acousticLogs.length > 0 ? (
                      <ul className="divide-y divide-slate-50">
                        {acousticLogs.map(log => (
                          <li key={log.id} className="p-4 flex justify-between items-center bg-card">
                            <div>
                              <p className={`text-[10px] font-bold uppercase ${log.severity === 'critical' ? 'text-rose-600' : 'text-slate-900'}`}>{log.event_type}</p>
                              <p className="text-[9px] text-slate-500 mt-0.5">{log.description}</p>
                            </div>
                            <span className="text-[9px] font-mono font-bold text-slate-400">{new Date(log.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="p-8 text-center bg-card">
                        <ShieldCheck className="w-6 h-6 text-slate-200 mx-auto mb-2" />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Environment Secure</p>
                        <p className="text-[9px] text-slate-400 font-medium mt-1">No acoustic coercion events logged.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

          </TabsContent>

          {/* 2. BIOMETRICS TAB */}
          <TabsContent value="biometrics" className="space-y-8 focus-visible:outline-none">
            
            {/* Top 6 Core Grid */}
            <div className="grid grid-cols-2 gap-x-8 gap-y-6 pt-4">
              {[
                { label: "Heart Rate", value: metrics.hr !== null ? `${metrics.hr} BPM` : "--", icon: Heart },
                { label: "HRV Index", value: metrics.hrv !== null ? `${metrics.hrv} ms` : "--", icon: Activity },
                { label: "Acoustic", value: metrics.noise !== null ? `${metrics.noise} dB` : "--", icon: Volume2 },
                { label: "Respiratory", value: metrics.resp !== null ? `${metrics.resp} br/m` : "--", icon: Wind },
                { label: "Gait Balance", value: metrics.asymmetry !== null ? `${metrics.asymmetry}%` : "--", icon: Accessibility },
                { label: "HRI Score", value: metrics.hriScore !== null ? `${metrics.hriScore}%` : "--", icon: Shield },
              ].map((b) => (
                <div key={b.label} className="p-0 border-none">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-sans">
                    <b.icon className="w-2.5 h-2.5" /> {b.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 italic tracking-tighter font-sans">{b.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl border border-teal-50 bg-teal-50/20 p-5">
               <div className="flex items-center gap-2 mb-1 text-teal-800">
                  <Activity className="w-4 h-4" />
                  <span className="text-[10px] font-black uppercase tracking-widest italic font-sans">Operational Status</span>
               </div>
               <p className="text-xs font-medium leading-relaxed text-slate-600 font-sans">
                 Cognitive load is currently <span className="font-bold text-teal-600 uppercase">Optimal</span>. 
                 Reaction velocity remains within established personal alpha baseline.
               </p>
            </div>

            {/* Comprehensive HealthKit Telemetry */}
            <div className="pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-slate-400" />
                <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full HealthKit Telemetry</h3>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Steps", value: telemetry.steps !== null ? telemetry.steps : "--", unit: "" },
                  { label: "Resting HR", value: telemetry.restingHr !== null ? telemetry.restingHr : "--", unit: "bpm" },
                  { label: "Blood Oxygen", value: telemetry.spo2 !== null ? `${telemetry.spo2}` : "--", unit: "%" },
                  { label: "VO2 Max", value: telemetry.vo2Max !== null ? telemetry.vo2Max : "--", unit: "mL/kg/min" },
                  { label: "Body Temp", value: telemetry.temp !== null ? telemetry.temp : "--", unit: "°F" },
                  { label: "Blood Pressure", value: (telemetry.bpSys && telemetry.bpDia) ? `${telemetry.bpSys}/${telemetry.bpDia}` : "--", unit: "mmHg" },
                  { label: "Active Energy", value: telemetry.activeEnergy !== null ? telemetry.activeEnergy : "--", unit: "kcal" },
                  { label: "Resting Energy", value: telemetry.basalEnergy !== null ? telemetry.basalEnergy : "--", unit: "kcal" },
                  { label: "Steadiness", value: telemetry.steadiness !== null ? `${telemetry.steadiness}` : "--", unit: "%" },
                  { label: "Double Support", value: telemetry.doubleSupport !== null ? `${telemetry.doubleSupport}` : "--", unit: "%" },
                  { label: "Step Length", value: telemetry.stepLength !== null ? telemetry.stepLength : "--", unit: "cm" },
                  { label: "UV Index", value: telemetry.uv !== null ? telemetry.uv : "--", unit: "" },
                ].map(m => (
                  <div key={m.label} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex flex-col justify-between">
                    <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">{m.label}</p>
                    <p className="text-sm font-bold text-slate-900 italic tracking-tighter">{m.value} <span className="text-[9px] text-slate-400 not-italic">{m.unit}</span></p>
                  </div>
                ))}
              </div>
            </div>
            
          </TabsContent>

          {/* 3. GAMMA TRIGGER TAB */}
          <TabsContent value="gamma" className="space-y-6 focus-visible:outline-none">
            <div className="rounded-3xl border-border bg-muted/30 p-10 text-center shadow-sm">
               <div className={`w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center border-4 transition-all duration-700 ${gammaActive ? 'border-orange-500 bg-orange-50 scale-110 shadow-[0_0_40px_rgba(249,115,22,0.15)]' : 'border-white bg-white'}`}>
                  <Zap className={`w-10 h-10 ${gammaActive ? 'text-orange-500 animate-pulse' : 'text-slate-200'}`} />
               </div>
               <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 font-sans">40Hz Entrainment Trigger</h3>
               <p className="text-[11px] text-slate-400 max-w-[200px] mx-auto mb-10 font-medium leading-relaxed font-sans">Active stimulation for pupillary response testing and neural drive peaking.</p>
               
               <div className="flex items-center justify-between bg-card border-border p-5 rounded-2xl shadow-sm">
                  <div className="text-left font-sans">
                     <p className="text-[10px] font-black text-slate-900 uppercase">Hardware Pulse</p>
                     <p className="text-[9px] text-teal-600 font-bold uppercase tracking-tighter">{gammaActive ? "Transmitting" : "Standby"}</p>
                  </div>
                  <Switch checked={gammaActive} onCheckedChange={handleGammaToggle} className="data-[state=checked]:bg-orange-500" />
               </div>
            </div>
          </TabsContent>

          {/* 4. MEMORY ANCHORING TAB */}
          <TabsContent value="memory" className="space-y-6 focus-visible:outline-none">
             <div className="rounded-3xl border-border bg-card shadow-sm overflow-hidden min-h-[460px] flex flex-col font-sans">
                <div className="p-5 border-b border-slate-50 flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-orange-500" />
                      <span className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Memory Anchor: {rsvpPhase !== 'IDLE' ? `${testRound}/5` : 'Validation'}</span>
                   </div>
                   {rsvpPhase !== 'IDLE' && <Badge className="bg-orange-500 text-white font-black text-[9px] px-2.5 shadow-sm">{cumulativeScore}</Badge>}
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-8 relative">
                   {rsvpPhase === 'IDLE' && (
                      <div className="text-center space-y-10">
                         <div className="space-y-2">
                            <p className="text-[10px] text-slate-400 uppercase font-black tracking-[0.25em]">Operational Calibration</p>
                            <Smartphone className="w-8 h-8 text-slate-300 mx-auto animate-bounce mt-4" />
                            <p className="text-[11px] text-slate-600 font-medium max-w-[190px] mx-auto">Turn device horizontally to lock orientation for validation battery.</p>
                         </div>
                         <Button onClick={resetFullTest} className="bg-slate-900 text-white hover:bg-orange-500 font-black px-12 py-7 rounded-full uppercase italic transition-all shadow-md">Initialize Battery</Button>
                         <div className="flex justify-center gap-4">
                            {[500, 300, 150].map(s => (
                               <button key={s} onClick={() => setRsvpSpeed(s)} className={`text-[9px] font-black px-4 py-2 rounded-full border-2 transition-all ${rsvpSpeed === s ? 'border-teal-600 text-teal-600' : 'border-slate-50 text-slate-300'}`}>{s === 500 ? 'LVL 1' : s === 300 ? 'NORM' : 'ALPHA'}</button>
                            ))}
                         </div>
                      </div>
                   )}

                   {rsvpPhase === 'CALIBRATING' && (
                      <div className="text-center space-y-4">
                         <div className="w-12 h-12 rounded-full border-4 border-teal-500 border-t-transparent animate-spin mx-auto" />
                         <p className="text-[11px] font-black uppercase tracking-[0.5em] text-teal-600">Locking Focus</p>
                      </div>
                   )}

                   {rsvpPhase === 'PRESENTING' && (
                      <div className="w-full text-center px-4 h-32 flex items-center justify-center overflow-hidden">
                         <p className={`${getDynamicFontSize(activeSequence[rsvpWordIndex])} font-black tracking-[0.2em] text-slate-900 uppercase animate-in zoom-in duration-75 whitespace-nowrap drop-shadow-sm leading-none`}>
                            {activeSequence[rsvpWordIndex]}
                         </p>
                      </div>
                   )}

                   {rsvpPhase === 'MASK' && <p className="text-6xl font-black text-slate-50 select-none">#######</p>}

                   {rsvpPhase === 'RECALL' && (
                      <div className="w-full space-y-6">
                         <p className="text-[10px] font-black text-slate-400 text-center uppercase tracking-[0.3em]">Sequence Verification</p>
                         <div className="grid grid-cols-2 gap-3">
                            {[...activeSequence].sort().map(word => (
                               <Button key={word} onClick={() => handleRecallSelection(word)} variant="outline" className={`h-14 border-2 text-[11px] font-black uppercase transition-all ${userRecall.includes(word) ? 'bg-slate-50 text-slate-300 border-slate-50 scale-95 opacity-40' : 'border-slate-50 text-slate-700 hover:border-teal-500 hover:text-teal-600 shadow-sm'}`}>{word}</Button>
                            ))}
                         </div>
                      </div>
                   )}

                   {rsvpPhase === 'ROUND_COMPLETE' && <p className="text-3xl font-black text-teal-600 italic tracking-tighter uppercase animate-pulse">ROUND {testRound} LOGGED</p>}

                   {rsvpPhase === 'RESULT' && (
                      <div className="text-center space-y-10 animate-in zoom-in duration-500">
                         <Trophy className="w-20 h-20 text-orange-500 mx-auto" />
                         <div>
                            <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 text-center">Cumulative Clutch Score</p>
                            <p className="text-9xl font-black italic tracking-tighter text-slate-900 leading-none text-center">{cumulativeScore}</p>
                         </div>
                         <Button variant="ghost" onClick={endTest} className="text-slate-300 font-black uppercase text-[11px] hover:text-teal-600 tracking-[0.2em] text-center"><RotateCcw className="w-4 h-4 mr-2" /> Exit to Portrait</Button>
                      </div>
                   )}
                </div>
             </div>
          </TabsContent>
        </Tabs>

        <div className="mt-4">
          <InsightsSection tier="pure_alpha" />
        </div>

        <style>{`
          @keyframes seizure-rgb {
            0% { background-color: #ff0000; }
            25% { background-color: #00ff00; }
            50% { background-color: #0000ff; }
            75% { background-color: #ffffff; }
            100% { background-color: #ff0000; }
          }
        `}</style>
      </div>
    </GhostProtocolWrapper>
  );
};

export default PureAlphaDashboard;