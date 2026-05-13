import { useEffect, useRef, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SwipeToRateProps {
  connectionId: string;
  initialStars?: number;
  onSubmit: (stars: number) => Promise<void> | void;
  onClose: () => void;
}

// Light haptic for 1–4 stars (the "tick"); heavy haptic for 5 (the "thud").
async function fireHaptic(stars: number) {
  try {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    if (stars >= 5) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch {
    // Web fallback
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate(stars >= 5 ? 80 : 20);
    }
  }
}

export default function SwipeToRate({ connectionId, initialStars = 0, onSubmit, onClose }: SwipeToRateProps) {
  const [stars, setStars] = useState<number>(initialStars);
  const [submitting, setSubmitting] = useState(false);
  const lastHapticStarRef = useRef<number>(0);
  const rowRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    console.log("[HAPTIC_SWIPE_INIT_START]", { connectionId, initialStars });
    return () => {
      console.log("[HAPTIC_SWIPE_INIT_END]");
    };
  }, [connectionId, initialStars]);

  const computeStarsFromX = (clientX: number): number => {
    const el = rowRef.current;
    if (!el) return stars;
    const rect = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const computed = Math.max(1, Math.min(5, Math.ceil(ratio * 5)));
    return computed;
  };

  const updateStars = (next: number) => {
    if (next !== stars) {
      setStars(next);
      if (next !== lastHapticStarRef.current) {
        lastHapticStarRef.current = next;
        fireHaptic(next);
      }
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    updateStars(computeStarsFromX(e.clientX));
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (e.buttons === 0 && e.pointerType === "mouse") return;
    updateStars(computeStarsFromX(e.clientX));
  };

  const handleSubmit = async () => {
    if (stars < 1) return;
    setSubmitting(true);
    try {
      await onSubmit(stars);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-teal-100 p-6 space-y-5">
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-foreground">How was the Sync?</h3>
          <p className="text-xs text-muted-foreground">
            Swipe across the stars to rate this Connection. You can update this rating any time.
          </p>
        </div>

        <div
          ref={rowRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          className="flex items-center justify-between px-2 py-4 rounded-xl bg-teal-50/60 border border-teal-100 select-none"
          style={{ touchAction: "none" }}
        >
          {[1, 2, 3, 4, 5].map((n) => {
            const filled = n <= stars;
            return (
              <Star
                key={n}
                className="w-10 h-10 transition-transform"
                style={{
                  fill: filled ? "url(#star-grad)" : "transparent",
                  stroke: filled ? "hsl(20, 95%, 48%)" : "hsl(180, 25%, 60%)",
                  strokeWidth: 1.5,
                  transform: filled && n === stars ? "scale(1.15)" : "scale(1)",
                }}
              />
            );
          })}
          {/* Inline gradient def for the star fill */}
          <svg width="0" height="0" style={{ position: "absolute" }}>
            <defs>
              <linearGradient id="star-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="hsl(180, 60%, 45%)" />
                <stop offset="100%" stopColor="hsl(20, 95%, 55%)" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          {stars === 0
            ? "Touch a star to begin."
            : stars <= 2
            ? "You felt this was a weak Sync."
            : stars === 3
            ? "You felt this was a fair Sync."
            : stars === 4
            ? "You felt this was a good Sync."
            : "You felt this was a great Sync."}
        </p>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 border-teal-200 text-teal-700" onClick={onClose}>
            Close
          </Button>
          <Button
            className="flex-1 bg-gradient-to-r from-teal-500 to-orange-500 hover:from-teal-600 hover:to-orange-600 text-white border-none font-bold"
            onClick={handleSubmit}
            disabled={stars < 1 || submitting}
          >
            {submitting ? "Sending…" : "Save Rating"}
          </Button>
        </div>
      </div>
    </div>
  );
}
