import { useEffect } from "react";

interface ColorWashOverlayProps {
  myColor: string;
  peerColor: string;
  onComplete: () => void;
}

export default function ColorWashOverlay({ myColor, peerColor, onComplete }: ColorWashOverlayProps) {
  useEffect(() => {
    console.log(`[COLOR_WASH_BEGIN] my=${myColor} peer=${peerColor}`);
    const t = setTimeout(() => {
      console.log("[COLOR_WASH_END]");
      onComplete();
    }, 3500);
    return () => clearTimeout(t);
  }, [myColor, peerColor, onComplete]);

  return (
    <div
      className="fixed inset-0 z-[10001] pointer-events-none"
      style={{
        background: `linear-gradient(135deg, ${myColor} 0%, ${peerColor} 100%)`,
        animation: "color-wash-fade 3.5s ease-in-out forwards",
      }}
    >
      <style>{`
        @keyframes color-wash-fade {
          0%   { opacity: 0; }
          25%  { opacity: 0.95; }
          75%  { opacity: 0.95; }
          100% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}
