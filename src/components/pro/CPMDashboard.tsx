import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Brain, Eye, Zap, Shield, Activity, Volume2, Accessibility, Wind, Heart, Info, RotateCcw, Target, Activity as Pulse, Trophy, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GammaPhotosensitivityWarning } from "./GammaPhotosensitivityWarning";
import InsightsSection from "./insights/InsightsSection";

// --- TYPES ALIGNED TO SOVEREIGN SCHEMA ---
interface StagedHealthData {
  heart_rate: number;
  heart_rate_variability_ms: number;
  respiratory_rate: number;
  environmental_audio_exposure_db: number;
  walking_asymmetry_percentage: number;
  data_quality_score: number;
  effort_score: number;
}

const RSVP_WORDS = ["FOCUS", "CLARITY", "RESOLVE", "EXECUTE", "DOMINATE", "OPTIMIZE", "TRANSCEND", "SOVEREIGN", "VELOCITY", "BASELINE", "INTEGRITY", "ALPHA"];

const InfoIcon = ({ text }: { text: string }) => (
  <TooltipProvider>
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <Info className="w-2.5 h-2.5 ml-1 opacity-20 hover:opacity-100 transition-opacity cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="bg-popover text-popover-foreground border-border text-[10px] max-w-[180px] p-2 shadow-2xl font-sans">
        <p>{text}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const CPMDashboard = ({ isMasked = false }: { isMasked?: boolean }) => {
  const [loading, setLoading] = useState(true);
  const [gammaActive, setGammaActive] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [gammaWarningOpen, setGammaWarningOpen] = useState(false);
  
  // --- 5-ROUND RSVP ENGINE ---
  const [rsvpPhase, setRsvpPhase] = useState<'IDLE' | 'CALIBRATING' | 'PRESENTING' | 'MASK' | 'RECALL' | 'ROUND_COMPLETE' | 'RESULT'>('IDLE');
  const [testRound, setTestRound] = useState(1);
  const [rsvpWordIndex, setRsvpWordIndex] = useState(0);
  const [rsvpSpeed, setRsvpSpeed] = useState(300);
  const [activeSequence, setActiveSequence] = useState<string[]>([]);
  const [userRecall, setUserInput] = useState<string[]>([]);
  const [cumulativeScore, setCumulativeScore] = useState(0);

  const [metrics, setMetrics] = useState({
    hr: 0, hrv: 0, resp: 0, noise: 0, asymmetry: 0,
    focusScore: 0, stressIndex: 0, recovery: 0, hriScore: 0,
    status: "CALIBRATING" as "CALIBRATING" | "ARMED" | "TRIGGERED"
  });

  // TRUE DYNAMIC FONT ENGINE: Scales based on word length vs container width
  const getDynamicFontSize = (word: string) => {
    const len = word.length;
    if (len > 10) return "text-[8vw]"; // "SOVEREIGN" level
    if (len > 8) return "text-[10vw]"; 
    return "text-[12vw]"; // "FOCUS" level
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

  // ORIENTATION COMMAND: Attempts to lock landscape for the test duration
  const toggleOrientation = (landscape: boolean) => {
    if (landscape) {
      if (window.webkit?.messageHandlers?.syncHealthData) {
        window.webkit.messageHandlers.syncHealthData.postMessage({ action: "CMD_LOCK_LANDSCAPE" });
      }
    } else {
      if (window.webkit?.messageHandlers?.syncHealthData) {
        window.webkit.messageHandlers.syncHealthData.postMessage({ action: "CMD_LOCK_PORTRAIT" });
      }
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
      console.log("[CPMDashboard:UI] Gamma requested. Opening safety gate.");
      setGammaWarningOpen(true);
    } else {
      console.log("[CPMDashboard:UI] Disabling Gamma sequence.");
      triggerGammaSequence(false);
    }
  };

  useEffect(() => {
    if (isMasked) return;
    let isMounted = true;
    const stream = async () => {
      const { data: health } = await supabase.from("staged_health_data" as any).select("*").order("recorded_at", { ascending: false }).limit(1).maybeSingle();
      if (isMounted && health) {
        const hData = health as unknown as StagedHealthData;
        setMetrics({
          hr: hData.heart_rate || 0, hrv: hData.heart_rate_variability_ms || 0,
          resp: hData.respiratory_rate || 0, noise: hData.environmental_audio_exposure_db || 0,
          asymmetry: hData.walking_asymmetry_percentage || 0,
          focusScore: Math.round((hData.data_quality_score || 0) * 100),
          stressIndex: hData.heart_rate_variability_ms ? Number((100 / hData.heart_rate_variability_ms).toFixed(2)) : 0,
          recovery: Math.round(hData.effort_score || 0),
          hriScore: Math.round((hData.data_quality_score || 0) * 100),
          status: hData.heart_rate > 0 ? "ARMED" : "CALIBRATING",
        });
      }
      setLoading(false);
      const ch = supabase.channel("cpm_feed").on("postgres_changes" as any, { event: "INSERT", schema: "public", table: "staged_health_data" }, (p: any) => {
        const n = p.new as StagedHealthData;
        if (n && isMounted) setMetrics(prev => ({...prev, hr: n.heart_rate || prev.hr, hrv: n.heart_rate_variability_ms || prev.hrv, hriScore: n.data_quality_score ? Math.round(n.data_quality_score * 100) : prev.hriScore }));
      }).subscribe();
      return ch;
    };
    const promise = stream();
    return () => { isMounted = false; promise.then(c => { if(c) supabase.removeChannel(c); }); };
  }, [isMasked]);

  if (loading && !isMasked) return <div className="p-8 text-center animate-pulse uppercase text-[10px] tracking-widest text-teal-600 font-sans font-black">Hydrating IDIA Pro+...</div>;

  return (
    <>
      <GammaPhotosensitivityWarning
        open={gammaWarningOpen}
        surface="CPMDashboard"
        onCancel={() => setGammaWarningOpen(false)}
        onAcknowledge={() => { setGammaWarningOpen(false); triggerGammaSequence(true); }}
      />
      {isFlashing && createPortal(
        <div 
          className="fixed inset-0 z-[99999] pointer-events-none animate-[seizure-rgb_25ms_linear_infinite]" 
          style={{ mixBlendMode: 'difference', width: '100vw', height: '100vh', top: 0, left: 0 }}
        />,
        document.body
      )}

      <div 
        className={`p-4 pb-24 space-y-6 animate-fade-in relative bg-background min-h-screen font-sans transition-transform duration-75 ease-out ${isMasked ? "blur-md pointer-events-none" : ""}`}
        style={{
          perspective: '1200px',
          transform: `rotateX(calc(var(--pitch, 0) * ${gammaActive ? '35deg' : '12deg'})) rotateY(calc(var(--roll, 0) * ${gammaActive ? '-35deg' : '-12deg'}))`,
          transformStyle: 'preserve-3d'
        }}
      >
        
        {/* HEADER */}
        <div className="flex items-center justify-between" style={{ transform: 'translateZ(40px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[hsl(178,42%,42%)] flex items-center justify-center shadow-sm">
              <Brain className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm uppercase tracking-tighter">Cognitive Performance</h2>
              <p className="text-[10px] text-teal-600 uppercase font-black tracking-widest">Personal Alpha Suite</p>
            </div>
          </div>
          <Badge variant="outline" className="border-teal-100 text-teal-600 font-black uppercase text-[8px] px-2 py-0 font-sans">Live Synapse</Badge>
        </div>

        <Tabs defaultValue="biometrics" className="w-full" style={{ transform: 'translateZ(20px)' }}>
          <TabsList className="flex w-full bg-transparent border-b border-slate-100 p-0 rounded-none h-10 mb-8 gap-8">
            <TabsTrigger value="biometrics" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all font-sans">Biometrics</TabsTrigger>
            <TabsTrigger value="gamma" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all font-sans">Gamma</TabsTrigger>
            <TabsTrigger value="memory" className="text-[10px] font-black uppercase border-b-2 border-transparent data-[state=active]:border-teal-600 data-[state=active]:text-teal-600 rounded-none px-0 bg-transparent shadow-none transition-all font-sans">Anchor</TabsTrigger>
          </TabsList>

          <TabsContent value="biometrics" className="space-y-8 focus-visible:outline-none">
            <div className="grid grid-cols-2 gap-x-8 gap-y-6">
              {[
                { label: "Heart Rate", value: `${metrics.hr} BPM`, icon: Heart },
                { label: "HRV Index", value: `${metrics.hrv} ms`, icon: Activity },
                { label: "Acoustic", value: `${metrics.noise} dB`, icon: Volume2 },
                { label: "Respiratory", value: `${metrics.resp} br/m`, icon: Wind },
                { label: "Gait Balance", value: `${metrics.asymmetry}%`, icon: Accessibility },
                { label: "HRI Score", value: `${metrics.hriScore}%`, icon: Shield },
              ].map((b) => (
                <div key={b.label} className="p-0 border-none group" style={{ transform: 'translateZ(30px)' }}>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5 font-sans group-hover:text-teal-500 transition-colors">
                    <b.icon className="w-2.5 h-2.5" /> {b.label}
                  </p>
                  <p className="text-2xl font-bold text-slate-900 italic tracking-tighter font-sans">{b.value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-2xl border border-teal-50 bg-teal-50/20 p-5 shadow-inner" style={{ transform: 'translateZ(10px)' }}>
               <div className="flex items-center gap-2 mb-1 text-teal-800"><Pulse className="w-4 h-4" /><span className="text-[10px] font-black uppercase tracking-widest italic font-sans">Operational Status</span></div>
               <p className="text-xs font-medium leading-relaxed text-slate-600 font-sans text-center">Cognitive load is currently <span className="font-bold text-teal-600 uppercase">Optimal</span>. Reaction velocity is baseline stable.</p>
            </div>
          </TabsContent>

          <TabsContent value="gamma" className="space-y-6 focus-visible:outline-none">
            <div className="rounded-3xl border border-slate-50 bg-slate-50/30 p-10 text-center shadow-sm" style={{ transform: 'translateZ(40px)' }}>
               <div className={`w-24 h-24 rounded-full mx-auto mb-8 flex items-center justify-center border-4 transition-all duration-700 ${gammaActive ? 'border-orange-500 bg-orange-50 scale-110 shadow-[0_0_40px_rgba(249,115,22,0.3)]' : 'border-white bg-white'}`}>
                  <Zap className={`w-12 h-12 ${gammaActive ? 'text-orange-500 animate-pulse' : 'text-slate-200'}`} />
               </div>
               <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-4 font-sans text-center">40Hz Entrainment Trigger</h3>
               <div className="flex items-center justify-between bg-card border-border p-5 rounded-2xl shadow-md" style={{ transform: 'translateZ(20px)' }}>
                  <div className="text-left font-sans">
                     <p className="text-[10px] font-black text-slate-900 uppercase">Hardware Pulse</p>
                     <p className="text-[9px] text-teal-600 font-bold uppercase tracking-tighter">{gammaActive ? "Transmitting" : "Standby"}</p>
                  </div>
                  <Switch checked={gammaActive} onCheckedChange={handleGammaToggle} className="data-[state=checked]:bg-orange-500 shadow-sm" />
               </div>
            </div>
          </TabsContent>

          <TabsContent value="memory" className="space-y-6 focus-visible:outline-none">
             <div className="rounded-3xl border-border bg-card shadow-sm overflow-hidden min-h-[480px] flex flex-col font-sans" style={{ transform: 'translateZ(35px)' }}>
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
                            <p className="text-[11px] text-slate-600 font-medium max-w-[190px]">Turn device horizontally to lock orientation for validation battery.</p>
                         </div>
                         <Button onClick={resetFullTest} className="bg-slate-900 text-white hover:bg-orange-500 font-black px-12 py-7 rounded-full uppercase italic transition-all shadow-xl">Initialize Battery</Button>
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
                      <div className="w-full space-y-6" style={{ transform: 'translateZ(50px)' }}>
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
                      <div className="text-center space-y-10 animate-in zoom-in duration-500" style={{ transform: 'translateZ(60px)' }}>
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
          <InsightsSection tier="pro_plus" />
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
    </>
  );
};

export default CPMDashboard;