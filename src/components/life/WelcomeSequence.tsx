import { useEffect, useMemo, useState, type RefObject } from "react";
import { ShieldCheck, ArrowRight, Sparkles } from "lucide-react";
import idiaLogo from "@/assets/IDIA_Logo_Official.png";

interface WelcomeSequenceProps {
  tabRefs: RefObject<Record<string, HTMLButtonElement | null>>;
  onComplete: () => void;
}

interface SpotlightTab {
  id: string;
  label: string;
  copy: string;
}

const SPOTLIGHT_TABS: SpotlightTab[] = [
  { id: "wallet", label: "Wallet", copy: "See, manage, and control your financial world with clarity." },
  { id: "data", label: "My Data", copy: "Connect your apps. Turn everyday digital activity into earnings." },
  { id: "life", label: "Life", copy: "Take assessments that reveal how you think, act, and operate." },
  { id: "shop", label: "Shop", copy: "Discover and support the places you love." },
  { id: "vote", label: "Vote", copy: "Your voice directly shapes the ecosystem." },
  { id: "pro", label: "Pro", copy: "Where performance meets opportunity." },
];

const WelcomeSequence = ({ tabRefs, onComplete }: WelcomeSequenceProps) => {
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [tabIndex, setTabIndex] = useState(0);
  const [spotlightRect, setSpotlightRect] = useState<{ x: number; y: number; r: number } | null>(null);

  useEffect(() => {
    console.log("[WELCOME_SEQUENCE_START]");
    return () => console.log("[WELCOME_SEQUENCE_END]");
  }, []);

  useEffect(() => {
    console.log(`[WELCOME_STEP: ${step}]`);
  }, [step]);

  useEffect(() => {
    if (step !== 3) return;
    const compute = () => {
      const tab = SPOTLIGHT_TABS[tabIndex];
      const el = tabRefs.current?.[tab.id];
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const r = Math.max(rect.width, rect.height) * 0.95 + 12;
      setSpotlightRect({ x, y, r });
      console.log(`[SPOTLIGHT_TAB_FOCUS: ${tab.label}]`);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [step, tabIndex, tabRefs]);

  const finish = () => {
    try {
      localStorage.setItem("idia_welcome_seen_v1", "1");
    } catch {
      // no-op
    }
    onComplete();
  };

  const next = () => {
    if (step === 3) {
      if (tabIndex < SPOTLIGHT_TABS.length - 1) {
        setTabIndex(tabIndex + 1);
        return;
      }
      setStep(4);
      return;
    }
    if (step < 5) setStep((step + 1) as 1 | 2 | 3 | 4 | 5);
    else finish();
  };

  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => {
        const angle = (i / 22) * Math.PI * 2;
        const dist = 140 + Math.random() * 110;
        const dx = Math.cos(angle) * dist;
        const dy = Math.sin(angle) * dist;
        const delay = Math.random() * 600;
        const hue = i % 3 === 0 ? "#14b8a6" : i % 3 === 1 ? "#f97316" : "#fbbf24";
        return { dx, dy, delay, hue };
      }),
    [],
  );

  return (
    <div
      className="fixed inset-0 z-[200] overflow-hidden text-slate-800 flex flex-col"
      style={{
        background: `
          radial-gradient(ellipse at 15% 10%, rgba(186,230,253,0.85) 0%, transparent 55%),
          radial-gradient(ellipse at 85% 20%, rgba(254,243,199,0.85) 0%, transparent 55%),
          radial-gradient(ellipse at 50% 95%, rgba(224,242,254,0.9) 0%, transparent 60%),
          linear-gradient(180deg, #fbfdff 0%, #f3f7fb 50%, #fefaf2 100%)
        `,
        paddingTop: "env(safe-area-inset-top)",
        paddingBottom: "env(safe-area-inset-bottom)",
      }}
    >
      {/* Persistent Skip */}
      <button
        onClick={() => {
          console.log("[WELCOME_SEQUENCE_SKIP]");
          finish();
        }}
        className="absolute top-0 right-0 z-[210] m-3 mt-[max(0.75rem,env(safe-area-inset-top))] px-3 py-1.5 text-[10px] font-semibold tracking-[0.2em] uppercase border border-slate-300/70 rounded-full bg-white/70 hover:bg-white text-slate-700 backdrop-blur-md transition-colors shadow-sm"
      >
        Skip
      </button>

      {/* STEP 1 — Materialization */}
      {step === 1 && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 min-h-0">
          <div className="relative w-36 h-36 mb-3 flex items-center justify-center shrink-0">
            <div
              className="absolute inset-0 rounded-full animate-welcome-glow"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(20,184,166,0.35) 0%, rgba(251,191,36,0.18) 40%, rgba(255,255,255,0) 70%)",
                filter: "blur(2px)",
              }}
            />
            <div
              className="absolute w-20 h-20 rounded-full"
              style={{
                background:
                  "radial-gradient(circle at 50% 50%, rgba(255,255,255,1) 0%, rgba(20,184,166,0.45) 55%, rgba(255,255,255,0) 100%)",
                boxShadow: "0 0 40px 12px rgba(20,184,166,0.25), 0 0 90px 24px rgba(251,191,36,0.18)",
              }}
            />
            {particles.map((p, i) => (
              <span
                key={i}
                className="absolute w-1.5 h-1.5 rounded-full animate-welcome-particle"
                style={{
                  background: p.hue,
                  boxShadow: `0 0 6px ${p.hue}`,
                  // @ts-ignore
                  "--dx": `${p.dx}px`,
                  "--dy": `${p.dy}px`,
                  animationDelay: `${p.delay}ms`,
                }}
              />
            ))}
          </div>

          <div className="max-w-md text-center space-y-1.5 text-[13px] leading-snug">
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-teal-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              Welcome to Life.
            </h2>
            <p className="text-slate-700">This is where you come into focus.</p>
            <p className="text-slate-600">
              Your gateway to understanding, owning, and activating your digital self. Every signal you create has
              value—claim it.
            </p>
            <p className="font-semibold text-amber-600">Leverage. Royalties. Power.</p>
          </div>

          <ContinueButton onClick={next} label="Continue" />
        </div>
      )}

      {/* STEP 2 — IDIA Protocol */}
      {step === 2 && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 min-h-0">
          <div className="relative w-[260px] h-[200px] mb-3 shrink-0">
            <svg viewBox="0 0 320 260" className="absolute inset-0 w-full h-full">
              <defs>
                <linearGradient id="lineGrad" x1="0" x2="1">
                  <stop offset="0" stopColor="#14b8a6" />
                  <stop offset="1" stopColor="#fbbf24" />
                </linearGradient>
              </defs>
              {[
                [60, 40],
                [260, 40],
                [60, 220],
                [260, 220],
              ].map(([x, y], i) => (
                <line
                  key={i}
                  x1="160"
                  y1="130"
                  x2={x}
                  y2={y}
                  stroke="url(#lineGrad)"
                  strokeWidth="1.5"
                  strokeDasharray="240"
                  strokeDashoffset="240"
                  className="animate-welcome-line"
                  style={{ animationDelay: `${i * 180}ms` }}
                  opacity="0.85"
                />
              ))}
            </svg>

            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full bg-white/85 backdrop-blur-xl border border-slate-200 flex items-center justify-center"
              style={{ boxShadow: "0 8px 30px rgba(99,102,241,0.25), 0 0 40px rgba(125,211,252,0.35)" }}
            >
              <img src={idiaLogo} alt="IDIA" className="w-12 h-auto" />
            </div>

            {[
              { label: "Life", x: "0px", y: "0px" },
              { label: "Pay", x: "calc(100% - 56px)", y: "0px" },
              { label: "Hub", x: "0px", y: "calc(100% - 28px)" },
              { label: "Synapse", x: "calc(100% - 78px)", y: "calc(100% - 28px)" },
            ].map((p) => (
              <div
                key={p.label}
                className="absolute px-2.5 py-1 rounded-full bg-white/85 border border-slate-200 text-[11px] font-semibold tracking-wide text-slate-800 backdrop-blur-md"
                style={{ left: p.x, top: p.y, boxShadow: "0 4px 16px rgba(20,184,166,0.25)" }}
              >
                {p.label}
              </div>
            ))}
          </div>

          <div className="max-w-md text-center space-y-1.5 text-[13px] leading-snug">
            <h2 className="text-xl font-bold text-amber-600">Enter the IDIA Protocol</h2>
            <p className="text-slate-700">A new system designed to shift control back to individuals.</p>
            <p className="text-slate-600 text-[12px]">
              <span className="text-teal-600 font-semibold">Life</span> · your command center &nbsp;·&nbsp;
              <span className="text-teal-600 font-semibold">Pay</span> · where value moves &nbsp;·&nbsp;
              <span className="text-teal-600 font-semibold">Hub</span> · where intelligence is built &nbsp;·&nbsp;
              <span className="text-teal-600 font-semibold">Synapse</span> · where it all comes alive
            </p>
            <p className="font-semibold text-amber-600">You are an owner of your value.</p>
          </div>

          <ContinueButton onClick={next} label="Continue" />
        </div>
      )}

      {/* STEP 3 — Spotlight Tour */}
      {step === 3 && spotlightRect && (
        <>
          <div
            className="absolute inset-0 pointer-events-none transition-all duration-500"
            style={{
              background: `radial-gradient(circle at ${spotlightRect.x}px ${spotlightRect.y}px, rgba(255,255,255,0) 0px, rgba(255,255,255,0) ${spotlightRect.r}px, rgba(248,250,252,0.88) ${spotlightRect.r + 24}px)`,
              backdropFilter: "blur(2px)",
              WebkitBackdropFilter: "blur(2px)",
            }}
          />
          <div
            className="absolute pointer-events-none rounded-full transition-all duration-500"
            style={{
              left: spotlightRect.x - spotlightRect.r,
              top: spotlightRect.y - spotlightRect.r,
              width: spotlightRect.r * 2,
              height: spotlightRect.r * 2,
              boxShadow:
                "0 0 0 2px rgba(13,148,136,0.85), 0 0 30px 6px rgba(20,184,166,0.45), 0 0 70px 16px rgba(251,191,36,0.3)",
            }}
          />

          <div
            className="absolute left-0 right-0 px-5"
            style={{ bottom: `calc(${spotlightRect.r}px + env(safe-area-inset-bottom) + 110px)` }}
          >
            <div
              className="max-w-md mx-auto rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200 p-3.5 text-center"
              style={{ boxShadow: "0 10px 40px rgba(15,23,42,0.12), 0 0 30px rgba(20,184,166,0.18)" }}
            >
              <div className="text-[10px] uppercase tracking-[0.3em] text-amber-600 mb-1">
                {SPOTLIGHT_TABS[tabIndex].label}
              </div>
              <p className="text-[12px] text-slate-700 leading-snug">{SPOTLIGHT_TABS[tabIndex].copy}</p>
              <div className="flex items-center justify-center gap-1.5 mt-2.5">
                {SPOTLIGHT_TABS.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 rounded-full transition-all ${i === tabIndex ? "w-5 bg-teal-500" : "w-1.5 bg-slate-300"}`}
                  />
                ))}
              </div>
              <button
                onClick={next}
                className="mt-2.5 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-teal-500 hover:bg-teal-400 text-white text-[12px] font-bold transition-colors shadow-md"
              >
                {tabIndex < SPOTLIGHT_TABS.length - 1 ? "Next" : "Continue"}
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}

      {/* STEP 4 — Sovereignty Shield */}
      {step === 4 && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 min-h-0">
          <div className="relative mb-3 w-28 h-28 flex items-center justify-center shrink-0">
            <div
              className="absolute inset-0 rounded-full animate-welcome-pulse"
              style={{
                background:
                  "radial-gradient(circle, rgba(20,184,166,0.3) 0%, rgba(251,191,36,0.12) 50%, rgba(255,255,255,0) 75%)",
              }}
            />
            <div
              className="relative w-20 h-20 rounded-full bg-white/85 border border-slate-200 backdrop-blur-xl flex items-center justify-center"
              style={{ boxShadow: "0 8px 30px rgba(20,184,166,0.35), 0 0 50px rgba(251,191,36,0.25)" }}
            >
              <ShieldCheck className="w-10 h-10 text-teal-600" />
            </div>
          </div>

          <div className="max-w-md text-center space-y-1.5 text-[13px] leading-snug">
            <h2 className="text-xl font-bold text-amber-600">Built for Your Sovereignty</h2>
            <p className="text-slate-700">We do not trade your identity.</p>
            <p className="text-slate-600">Your data is secured, anonymized, and fully under your control.</p>
            <p className="font-semibold text-teal-600">No names. No addresses. No compromise.</p>
          </div>

          <ContinueButton onClick={next} label="Continue" />
        </div>
      )}

      {/* STEP 5 — Final Launch */}
      {step === 5 && (
        <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 min-h-0">
          <div className="max-w-md text-center space-y-2 text-[13px] leading-snug mb-6">
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-teal-600 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              This Is Your Moment
            </h2>
            <p className="text-slate-700">Your life, your data, and your value finally align.</p>
            <p className="font-semibold text-amber-600">Explore. Connect. Build. Earn.</p>
            <p className="text-slate-600">Welcome to Life.</p>
          </div>

          <button
            onClick={finish}
            className="relative group inline-flex items-center gap-3 px-10 py-4 rounded-full font-extrabold text-base tracking-[0.3em] text-slate-900 bg-gradient-to-r from-teal-300 via-amber-200 to-orange-300 transition-transform hover:scale-105 active:scale-95 animate-welcome-pulse"
            style={{
              boxShadow:
                "0 10px 30px rgba(15,23,42,0.15), 0 0 40px rgba(20,184,166,0.5), 0 0 90px rgba(251,191,36,0.4)",
            }}
          >
            <Sparkles className="w-5 h-5" />
            START
          </button>
        </div>
      )}

      <style>{`
        @keyframes welcome-particle {
          0% { transform: translate(var(--dx), var(--dy)) scale(0.4); opacity: 0; }
          25% { opacity: 1; }
          100% { transform: translate(0, 0) scale(1); opacity: 0.9; }
        }
        .animate-welcome-particle { animation: welcome-particle 1800ms ease-out forwards; }
        @keyframes welcome-glow {
          0%, 100% { transform: scale(1); opacity: 0.85; }
          50% { transform: scale(1.06); opacity: 1; }
        }
        .animate-welcome-glow { animation: welcome-glow 3.2s ease-in-out infinite; }
        @keyframes welcome-pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.04); }
        }
        .animate-welcome-pulse { animation: welcome-pulse 2.4s ease-in-out infinite; }
        @keyframes welcome-line { to { stroke-dashoffset: 0; } }
        .animate-welcome-line { animation: welcome-line 1200ms ease-out forwards; }
      `}</style>
    </div>
  );
};

const ContinueButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button
    onClick={onClick}
    className="mt-5 inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white/85 hover:bg-white border border-slate-300 backdrop-blur-md text-[13px] font-semibold tracking-wide text-slate-700 transition-colors shadow-sm shrink-0"
  >
    {label}
    <ArrowRight className="w-4 h-4" />
  </button>
);

export default WelcomeSequence;
