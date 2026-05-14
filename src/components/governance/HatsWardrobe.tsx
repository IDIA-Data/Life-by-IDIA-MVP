import React, { useEffect, useState } from "react";
import { Crown, ShieldAlert, Code2, Scale, HeartHandshake, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

type HatType = "tophat" | "security_council" | "product_xr" | "legal_defense" | "sociorelational";
type Eligibility = "active" | "grayed" | "severed";

interface Hat {
  id: string;
  hat_type: HatType;
  eligibility_status: Eligibility;
}

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
    label: "Product/XR",
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
          .select("id, hat_type, eligibility_status")
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
  }, []);

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
      <div className="flex justify-between items-baseline px-2">
        <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
          Hats Wardrobe · Role Authority
        </h3>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-hide">
        {allTypes.map((t) => {
          const meta = HAT_META[t];
          const wearer = hats.find((h) => h.hat_type === t);

          // Default to severed (unowned) if the user doesn't hold the hat
          const status = wearer?.eligibility_status ?? "severed";
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
                  ? "bg-white border-teal-200 shadow-sm hover:shadow-md"
                  : grayed
                    ? "bg-amber-50/50 border-amber-200 opacity-80"
                    : "bg-slate-50 border-slate-200 opacity-40 hover:opacity-60",
              )}
            >
              {grayed && (
                <div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-pulse"
                  title="Authority Rot Warning: Verify Identity"
                />
              )}

              <Icon
                className={cn(
                  "w-5 h-5 mx-auto mb-1 transition-colors",
                  active ? "text-orange-500 drop-shadow-sm" : grayed ? "text-amber-600" : "text-slate-400",
                )}
              />

              <div
                className={cn(
                  "text-[8px] font-black uppercase tracking-wider transition-colors",
                  active ? "text-teal-800" : grayed ? "text-amber-800" : "text-slate-400",
                )}
              >
                {meta.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HatsWardrobe;
