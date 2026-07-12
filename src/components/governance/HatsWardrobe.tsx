import React, { useEffect, useState } from "react";
import { Crown, ShieldAlert, Code2, Scale, HeartHandshake, FileDown, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import ManualViewerModal from "./ManualViewerModal";
import ReattestDialog from "./ReattestDialog";

type HatType = "tophat" | "security_council" | "product_xr" | "legal_defense" | "sociorelational";
type Eligibility = "active" | "grayed" | "severed";

interface Hat {
  id: string;
  hat_type: HatType;
  eligibility_status: Eligibility;
  last_attested_at: string | null;
  granted_at: string | null;
}

// Mirror dao-hat-eligibility thresholds: grayed at 365d, severed at 395d.
// Surface the Attest CTA only when the hat is within 30 days of going grayed.
const ATTEST_WARNING_DAYS = 335;

const needsAttestation = (hat: Hat): boolean => {
  if (hat.eligibility_status === "grayed") return true;
  if (hat.eligibility_status !== "active") return false;
  const anchor = hat.last_attested_at || hat.granted_at;
  if (!anchor) return false;
  const ageDays = (Date.now() - new Date(anchor).getTime()) / 86_400_000;
  return ageDays > ATTEST_WARNING_DAYS;
};

// Aligned precisely with Governance Manual Section 5.1
const HAT_META: Record<HatType, { label: string; icon: React.ElementType; desc: string }> = {
  tophat: {
    label: "Tophat",
    icon: Crown,
    desc: "Proposes fundamental changes to the core protocol code.",
  },
  security_council: {
    label: "Security",
    icon: ShieldAlert,
    desc: "Monitors threats; can pause the system during a verified attack.",
  },
  product_xr: {
    label: "Prod/XR",
    icon: Code2,
    desc: "Sign-off authority on visual and functional app updates.",
  },
  legal_defense: {
    label: "Legal",
    icon: Scale,
    desc: "Manages jurisdictional compliance and protocol defense funds.",
  },
  sociorelational: {
    label: "Social",
    icon: HeartHandshake,
    desc: "Manages the Community Grant Pool and social impact initiatives.",
  },
};

const HatsWardrobe: React.FC = () => {
  const [hats, setHats] = useState<Hat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [reattestTarget, setReattestTarget] = useState<{ id: string; label: string; grayed: boolean } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let isMounted = true;

    (async () => {
      console.log("[HATS_WARDROBE] START: Initializing Hat Authority resolution.");
      try {
        console.log("[HATS_WARDROBE] AUTH: Retrieving local sovereign identity.");
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Sovereign authentication failed. Cannot resolve wardrobe.");
        }

        console.log(`[HATS_WARDROBE] NETWORK: Querying dao_hats ledger for user ${user.id}.`);
        const { data, error } = await supabase
          .from("dao_hats" as any)
          .select("id, hat_type, eligibility_status, last_attested_at, granted_at")
          .eq("user_id", user.id)
          .is("revoked_at", null);

        if (error) throw error;

        if (isMounted) {
          console.log(`[HATS_WARDROBE] SUCCESS: Retrieved ${data?.length || 0} active/grayed hats for identity.`);
          setHats((data as any) || []);
        }
      } catch (err: any) {
        console.error(`[HATS_WARDROBE] CRITICAL_FAILURE: Authority resolution stalled. Reason: ${err.message}`);
        toast({
          title: "Wardrobe Sync Failed",
          description: "Could not retrieve Hat authority from the ledger.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log("[HATS_WARDROBE] END: Fetch execution thread terminated.");
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [refreshKey]);

  const allTypes: HatType[] = ["tophat", "security_council", "product_xr", "legal_defense", "sociorelational"];

  if (isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
          Hats Wardrobe · Syncing Ledger...
        </h3>
        <div className="flex gap-3 overflow-x-hidden pb-2 px-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="min-w-[72px] h-[72px] bg-slate-100 rounded-2xl border border-slate-200 opacity-50"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-2 gap-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Hats Wardrobe · Role Authority
        </h3>
        <button
          type="button"
          onClick={() => setIsManualOpen(true)}
          title="Open IDIA DUNA Welcome Manual"
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest text-[hsl(178,42%,32%)] dark:text-teal-200 bg-teal-50 dark:bg-teal-950/40 hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors border border-teal-200 dark:border-teal-800"
        >
          <FileDown size={11} />
          Manual
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-hide">
        {allTypes.map((t) => {
          const meta = HAT_META[t];
          const realWearer = hats.find((h) => h.hat_type === t);
          // L3 Tophat override — a Protocol Steward is an honorary active holder of every committee hat.
          const tophatActive = hats.some(
            (h) => h.hat_type === "tophat" && h.eligibility_status === "active",
          );
          const isCommitteeHat = t !== "tophat";
          const synthesizedByTophat = !realWearer && isCommitteeHat && tophatActive;
          const wearer = realWearer;

          // Default to severed (unowned) if the user doesn't hold the hat
          const status: Eligibility =
            wearer?.eligibility_status ?? (synthesizedByTophat ? "active" : "severed");
          const active = status === "active";
          const grayed = status === "grayed";

          const Icon = meta.icon;

          return (
            <div
              key={t}
              title={`${meta.label} — ${meta.desc} · STATUS: ${status.toUpperCase()}`}
              className={cn(
                "min-w-[72px] flex-shrink-0 rounded-2xl p-3 border text-center transition-all duration-300 relative group cursor-help",
                active
                  ? "bg-white dark:bg-card border-teal-200 dark:border-teal-800 shadow-sm hover:shadow-md"
                  : grayed
                    ? "bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50 opacity-80"
                    : "bg-slate-50 dark:bg-muted/40 border-slate-200 dark:border-border opacity-40 hover:opacity-60",
              )}
            >
              {grayed && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white dark:border-card animate-pulse"
                  title="Authority Rot Warning: Verify Identity"
                />
              )}

              <Icon
                className={cn(
                  "w-5 h-5 mx-auto mb-1 transition-colors",
                  active
                    ? "text-orange-500 drop-shadow-sm"
                    : grayed
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-slate-400 dark:text-muted-foreground",
                )}
              />

              <div
                className={cn(
                  "text-[8px] font-black uppercase tracking-wider transition-colors",
                  active
                    ? "text-teal-800 dark:text-teal-200"
                    : grayed
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-slate-400 dark:text-muted-foreground",
                )}
              >
                {meta.label}
              </div>

              {wearer && needsAttestation(wearer) && (
                <button
                  type="button"
                  onClick={() => setReattestTarget({ id: wearer.id, label: meta.label, grayed })}
                  title={grayed ? "Restore authority — re-attest service" : "Re-attest service before authority grays"}
                  className={cn(
                    "mt-1.5 inline-flex items-center justify-center gap-0.5 w-full px-1 py-0.5 rounded-full text-[7px] font-black uppercase tracking-widest border transition-colors",
                    grayed
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800 hover:bg-amber-500/25"
                      : "bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800 hover:bg-teal-500/20",
                  )}
                >
                  <ShieldCheck size={8} />
                  {grayed ? "Restore" : "Attest"}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <ManualViewerModal open={isManualOpen} onClose={() => setIsManualOpen(false)} />
      {reattestTarget && (
        <ReattestDialog
          hatId={reattestTarget.id}
          hatLabel={reattestTarget.label}
          isGrayed={reattestTarget.grayed}
          open={!!reattestTarget}
          onClose={() => setReattestTarget(null)}
          onReattested={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  );
};

export default HatsWardrobe;
