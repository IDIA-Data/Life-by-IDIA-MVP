import { useState, useEffect, useRef } from 'react';
import polishedLogo from '@/assets/IDIA_Life_Logo_Polished.png';
import splashVideo from '@/assets/splash-rush.mp4.asset.json';

interface FlashingSplashScreenProps {
  onComplete: () => void;
}

const FlashingSplashScreen = ({ onComplete }: FlashingSplashScreenProps) => {
  const [phase, setPhase] = useState<'video' | 'logo' | 'logoFadeOut' | 'white'>('video');
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Attempt imperative play on mount — older iOS (iPhone 11-era WebKit)
  // often defers autoplay until an explicit .play() call, even when muted.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.setAttribute('muted', '');
    v.setAttribute('webkit-playsinline', 'true');
    v.setAttribute('playsinline', 'true');
    const p = v.play();
    if (p && typeof p.catch === 'function') {
      p.catch(() => {
        setAutoplayBlocked(true);
      });
    }
  }, []);

  useEffect(() => {
    if (autoplayBlocked) {
      // Collapse the video phase but still give the logo its cinematic reveal.
      const t1 = setTimeout(() => setPhase('logo'), 0);
      const t2 = setTimeout(() => setPhase('logoFadeOut'), 2700);      // hold 1.5s after 1.2s fade-in
      const t3 = setTimeout(() => setPhase('white'), 4200);             // 1.5s fade-out
      const t4 = setTimeout(() => onComplete(), 5000);                  // 0.8s white dissolve
      return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
    }
    // Cinematic timeline:
    //  0–8000ms   video
    //  8000ms     logo fade-IN begins (1.2s)
    //  9200ms     logo fully visible, holds with glow (1.5s)
    // 10700ms     logo fade-OUT begins (1.5s)
    // 12200ms     white dissolves (0.8s)
    // 13000ms     complete
    const t1 = setTimeout(() => setPhase('logo'), 8000);
    const t2 = setTimeout(() => setPhase('logoFadeOut'), 10700);
    const t3 = setTimeout(() => setPhase('white'), 12200);
    const t4 = setTimeout(() => onComplete(), 13000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [onComplete, autoplayBlocked]);

  const logoVisible = phase === 'logo';
  const logoReleasing = phase === 'logoFadeOut' || phase === 'white';


  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden touch-none cursor-pointer bg-white"
      onClick={onComplete}
      onTouchStart={onComplete}
      role="button"
      aria-label="Skip splash"
    >
      {/* Milky fluid background (fallback while video buffers) */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 20% 50%, rgba(255,250,245,1) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(245,240,255,1) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(250,248,240,1) 0%, transparent 50%),
            linear-gradient(135deg, #faf8f5 0%, #f0ebe6 25%, #e8e4e0 50%, #f5f0ec 75%, #faf8f5 100%)
          `,
          animation: 'milkyShift 8s ease-in-out infinite',
        }}
      />

      {/* Rushing splash video */}
      <video
        ref={videoRef}
        src={splashVideo.url}
        autoPlay
        {...({ defaultMuted: true } as any)}
        muted
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        disableRemotePlayback
        poster=""
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in"
        style={{
          opacity: phase === 'video' && !autoplayBlocked ? 1 : 0,
        }}
      />


      {/* Logo emerging — cinematic fade-in, glowing hold, graceful release */}
      <div
        className="absolute inset-0 flex items-center justify-center"
        style={{
          opacity: logoVisible ? 1 : logoReleasing ? 0 : 0,
          transform: logoVisible
            ? 'scale(1)'
            : logoReleasing
              ? 'scale(1.04)'
              : 'scale(0.92)',
          filter: logoVisible ? 'blur(0px)' : 'blur(4px)',
          transition: logoReleasing
            ? 'opacity 1500ms ease-in-out, transform 1500ms ease-in-out, filter 1500ms ease-in-out'
            : 'opacity 1200ms ease-out, transform 1200ms ease-out, filter 1200ms ease-out',
        }}
      >
        <img
          src={polishedLogo}
          alt="IDIA Life"
          className="w-24 h-24 rounded-3xl shadow-2xl"
          style={{
            animation: logoVisible ? 'logoGlow 2.4s ease-in-out infinite' : 'none',
          }}
        />
      </div>

      {/* White fade-out overlay */}
      <div
        className="absolute inset-0 bg-white transition-opacity duration-[800ms] ease-in-out pointer-events-none"
        style={{
          opacity: phase === 'white' ? 1 : 0,
        }}
      />

      <style>{`
        @keyframes milkyShift {
          0%, 100% { background-position: 0% 0%, 100% 0%, 50% 100%, 0% 0%; }
          50% { background-position: 60% 40%, 30% 80%, 80% 20%, 100% 0%; }
        }
        @keyframes logoGlow {
          0%, 100% { filter: drop-shadow(0 0 12px rgba(255,255,255,0.4)) drop-shadow(0 0 24px rgba(200,220,255,0.25)); }
          50%      { filter: drop-shadow(0 0 22px rgba(255,255,255,0.7)) drop-shadow(0 0 44px rgba(200,220,255,0.5)); }
        }
      `}</style>
    </div>
  );
};

export default FlashingSplashScreen;

