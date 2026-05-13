import { useState, useEffect } from 'react';
import polishedLogo from '@/assets/IDIA_Life_Logo_Polished.png';

interface FlashingSplashScreenProps {
  onComplete: () => void;
}

const FlashingSplashScreen = ({ onComplete }: FlashingSplashScreenProps) => {
  const [phase, setPhase] = useState<'fluid' | 'text' | 'textFade' | 'logo' | 'white'>('fluid');
  const [visibleLetters, setVisibleLetters] = useState(0);

  useEffect(() => {
    // Phase 1: Milky fluid (0–2s)
    const t1 = setTimeout(() => setPhase('text'), 2000);

    // Phase 2: Letters appear (2–4.4s)
    const letterTimers: ReturnType<typeof setTimeout>[] = [];
    for (let i = 0; i < 4; i++) {
      letterTimers.push(setTimeout(() => setVisibleLetters(i + 1), 2000 + i * 600));
    }

    // Phase 3: Text fades (5–6s)
    const t3 = setTimeout(() => setPhase('textFade'), 5000);

    // Phase 4: Logo emerges (6–8.5s)
    const t4 = setTimeout(() => setPhase('logo'), 6000);

    // Phase 5: White fade (8.5–10s)
    const t5 = setTimeout(() => setPhase('white'), 8500);

    // Complete
    const t6 = setTimeout(() => onComplete(), 10000);

    return () => {
      clearTimeout(t1);
      letterTimers.forEach(clearTimeout);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearTimeout(t6);
    };
  }, [onComplete]);

  const letters = ['L', 'i', 'f', 'e'];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden touch-none">
      {/* Milky fluid background */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(255,250,245,1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(245,240,255,1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(250,248,240,1) 0%, transparent 50%),
            radial-gradient(ellipse at 70% 60%, rgba(240,245,250,1) 0%, transparent 40%),
            linear-gradient(135deg, #faf8f5 0%, #f0ebe6 25%, #e8e4e0 50%, #f5f0ec 75%, #faf8f5 100%)
          `,
          animation: 'milkyShift 8s ease-in-out infinite',
        }}
      />

      {/* Secondary fluid layer */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `
            radial-gradient(circle at 30% 40%, rgba(255,255,255,0.8) 0%, transparent 40%),
            radial-gradient(circle at 70% 70%, rgba(250,245,255,0.6) 0%, transparent 35%),
            radial-gradient(circle at 50% 30%, rgba(255,250,240,0.7) 0%, transparent 45%)
          `,
          animation: 'milkyShift2 6s ease-in-out infinite',
        }}
      />

      {/* "Life" handwritten text */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex">
          {letters.map((letter, i) => (
            <span
              key={i}
              className="transition-all duration-700 ease-out"
              style={{
                fontFamily: "'Dancing Script', cursive",
                fontSize: 'clamp(4rem, 12vw, 7rem)',
                fontWeight: 700,
                color: '#2d2d2d',
                opacity: phase === 'textFade' || phase === 'logo' || phase === 'white'
                  ? 0
                  : visibleLetters > i ? 1 : 0,
                transform: visibleLetters > i ? 'translateY(0)' : 'translateY(20px)',
                transitionDelay: phase === 'textFade' ? '0ms' : `${i * 100}ms`,
              }}
            >
              {letter}
            </span>
          ))}
        </div>
      </div>

      {/* Logo emerging */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-all duration-[2000ms] ease-out"
        style={{
          opacity: phase === 'logo' || phase === 'white' ? 1 : 0,
          transform: phase === 'logo' || phase === 'white' ? 'scale(1)' : 'scale(0.3)',
          filter: phase === 'logo' || phase === 'white' ? 'blur(0px)' : 'blur(8px)',
        }}
      >
        <img
          src={polishedLogo}
          alt="IDIA Life"
          className="w-24 h-24 rounded-3xl shadow-2xl"
        />
      </div>

      {/* White fade-out overlay */}
      <div
        className="absolute inset-0 bg-white transition-opacity duration-[1500ms] ease-in pointer-events-none"
        style={{
          opacity: phase === 'white' ? 1 : 0,
        }}
      />

      {/* Keyframe styles */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&display=swap');

        @keyframes milkyShift {
          0%, 100% { background-position: 0% 0%, 100% 0%, 50% 100%, 70% 60%, 0% 0%; }
          33% { background-position: 30% 20%, 70% 40%, 20% 70%, 90% 30%, 50% 50%; }
          66% { background-position: 60% 40%, 30% 80%, 80% 20%, 40% 80%, 100% 0%; }
        }

        @keyframes milkyShift2 {
          0%, 100% { background-position: 30% 40%, 70% 70%, 50% 30%; }
          50% { background-position: 60% 60%, 30% 30%, 70% 70%; }
        }
      `}</style>
    </div>
  );
};

export default FlashingSplashScreen;
