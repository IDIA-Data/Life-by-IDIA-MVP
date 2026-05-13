import { useEffect, useMemo, useState } from "react";
import { useProximityBridge, type ProximityPeer } from "@/hooks/useProximityBridge";
import { localPIIVault } from "@/lib/localPIIVault";
import { Radar, X } from "lucide-react";

interface ProximityAwarenessOverlayProps {
  /** Called when the user taps a peer to begin a Sovereign Handshake. */
  onPeerSelected: (peer: ProximityPeer) => void;
  /** Show or hide the overlay. */
  open: boolean;
  /** Close handler for the overlay. */
  onClose: () => void;
}

// Map a 0..1 proximity score to a relative ring (1 = closest, 4 = farthest).
function ringFor(proximity: number): number {
  if (proximity >= 0.75) return 1;
  if (proximity >= 0.5) return 2;
  if (proximity >= 0.25) return 3;
  return 4;
}

function colorForToken(token: string): string {
  let h = 0;
  for (let i = 0; i < token.length; i++) h = (h * 31 + token.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 80%, 65%)`;
}

export default function ProximityAwarenessOverlay({
  onPeerSelected,
  open,
  onClose,
}: ProximityAwarenessOverlayProps) {
  const { isBridgeAvailable, isWatching, peers, startWatching, stopWatching } = useProximityBridge();
  const [labels, setLabels] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    console.log("[PROXIMITY_OVERLAY_OPEN_START]");
    startWatching();
    return () => {
      console.log("[PROXIMITY_OVERLAY_OPEN_END]");
      stopWatching();
    };
  }, [open, startWatching, stopWatching]);

  // Resolve labels from the local PII vault — never from the network.
  useEffect(() => {
    if (!peers.length) {
      setLabels({});
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const map = await localPIIVault.lookupBatch(peers.map((p) => p.token));
        if (cancelled) return;
        const named: Record<string, string> = {};
        for (const p of peers) {
          named[p.token] = localPIIVault.displayName(p.token, map[p.token]);
        }
        setLabels(named);
      } catch (err) {
        console.log("[PROXIMITY_LABEL_LOOKUP_ERROR]", { error: String(err) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [peers]);

  const placed = useMemo(() => {
    // Distribute peers around the radar in a stable angular slot per token.
    return peers.map((p, idx) => {
      let h = 0;
      for (let i = 0; i < p.token.length; i++) h = (h * 31 + p.token.charCodeAt(i)) >>> 0;
      const angle = ((h % 360) + idx * 7) * (Math.PI / 180);
      const ring = ringFor(p.proximity);
      const radiusPct = 14 + (ring - 1) * 14; // 14, 28, 42, 56
      const x = 50 + Math.cos(angle) * radiusPct;
      const y = 50 + Math.sin(angle) * radiusPct;
      return { peer: p, x, y, ring };
    });
  }, [peers]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-label="Nearby connections"
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backdropFilter: "blur(14px)", background: "hsla(220, 40%, 4%, 0.55)" }}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute top-6 right-6 rounded-full p-2 text-foreground/80 hover:text-foreground"
        aria-label="Close proximity overlay"
      >
        <X className="h-5 w-5" />
      </button>

      <div className="flex flex-col items-center w-full max-w-md px-6">
        <div className="flex items-center gap-2 text-foreground/90 mb-2">
          <Radar className="h-4 w-4" />
          <span className="text-[10px] uppercase tracking-[0.3em]">Proximity Awareness</span>
        </div>
        <p className="text-foreground text-sm font-medium mb-1">Looking for people nearby</p>
        <p className="text-foreground/60 text-xs text-center mb-6 max-w-xs">
          Anonymous tokens only. No identity is shared until both people approve a handshake.
        </p>

        {/* Radar */}
        <div
          className="relative w-[320px] h-[320px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, hsla(195, 90%, 60%, 0.10), hsla(195, 90%, 60%, 0) 70%)",
            boxShadow: "inset 0 0 60px hsla(195, 90%, 60%, 0.18)",
          }}
        >
          {/* Concentric rings */}
          {[1, 2, 3, 4].map((r) => (
            <div
              key={r}
              className="absolute rounded-full pointer-events-none"
              style={{
                top: `${50 - (14 + (r - 1) * 14)}%`,
                left: `${50 - (14 + (r - 1) * 14)}%`,
                width: `${(14 + (r - 1) * 14) * 2}%`,
                height: `${(14 + (r - 1) * 14) * 2}%`,
                border: "1px solid hsla(195, 90%, 70%, 0.18)",
              }}
            />
          ))}

          {/* Sweep */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, hsla(195, 90%, 60%, 0.0) 0deg, hsla(195, 90%, 60%, 0.35) 30deg, hsla(195, 90%, 60%, 0.0) 60deg, hsla(195, 90%, 60%, 0.0) 360deg)",
              animation: "proximity-sweep 4s linear infinite",
              mixBlendMode: "screen",
            }}
          />

          {/* Self marker */}
          <div
            className="absolute rounded-full"
            style={{
              top: "calc(50% - 8px)",
              left: "calc(50% - 8px)",
              width: 16,
              height: 16,
              background: "hsl(195, 90%, 70%)",
              boxShadow: "0 0 18px hsla(195, 90%, 70%, 0.7)",
            }}
          />

          {/* Peers */}
          {placed.map(({ peer, x, y }) => {
            const color = colorForToken(peer.token);
            const label = labels[peer.token] ?? "Connection";
            return (
              <button
                key={peer.token}
                type="button"
                onClick={() => {
                  console.log("[PROXIMITY_PEER_SELECTED]", { ring: ringFor(peer.proximity) });
                  onPeerSelected(peer);
                }}
                className="absolute -translate-x-1/2 -translate-y-1/2 group focus:outline-none"
                style={{ top: `${y}%`, left: `${x}%` }}
                aria-label={`Initiate handshake with ${label}`}
              >
                <span
                  className="block rounded-full transition-transform group-hover:scale-110"
                  style={{
                    width: 18,
                    height: 18,
                    background: color,
                    boxShadow: `0 0 14px ${color}`,
                  }}
                />
                <span className="mt-1 block text-[10px] text-foreground/80 whitespace-nowrap text-center">
                  {label}
                </span>
              </button>
            );
          })}

          {/* Empty state */}
          {placed.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <p className="text-foreground/70 text-xs">
                {isBridgeAvailable
                  ? isWatching
                    ? "No one is in range yet. Bring your phone close to another IDIA member."
                    : "Starting proximity sensor."
                  : "Open IDIA Life on your phone to use proximity sensing."}
              </p>
            </div>
          )}
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-[0.3em] text-foreground/50">
          {isWatching ? "Sensing" : "Idle"}
        </p>
      </div>

      <style>{`
        @keyframes proximity-sweep {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
