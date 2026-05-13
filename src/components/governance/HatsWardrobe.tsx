import React, { useEffect, useState } from "react";
import { Crown, Shield, Code2, Scale, HeartHandshake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type HatType = "tophat" | "security_council" | "product_xr" | "legal_defense" | "sociorelational";
type Eligibility = "active" | "grayed" | "severed";

interface Hat {
  id: string;
  hat_type: HatType;
  eligibility_status: Eligibility;
}

const HAT_META: Record<HatType, { label: string; icon: React.ComponentType<any>; desc: string }> = {
  tophat: { label: "Tophat", icon: Crown, desc: "Core Governor contract authority" },
  security_council: { label: "Security", icon: Shield, desc: "Emergency contract pause authority" },
  product_xr: { label: "Product/XR", icon: Code2, desc: "Angelic XR & IDIA Life UI authority" },
  legal_defense: { label: "Legal", icon: Scale, desc: "DUNA & Delaware wrapper defense" },
  sociorelational: { label: "Social", icon: HeartHandshake, desc: "Community health & inclusion fund" },
};

const HatsWardrobe: React.FC = () => {
  const [hats, setHats] = useState<Hat[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dao_hats" as any)
        .select("id,hat_type,eligibility_status")
        .is("revoked_at", null);
      setHats((data as any) || []);
    })();
  }, []);

  const allTypes: HatType[] = ["tophat", "security_council", "product_xr", "legal_defense", "sociorelational"];

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-2">
        Hats Wardrobe · Role Authority
      </h3>
      <div className="flex gap-3 overflow-x-auto pb-2 px-1 scrollbar-hide">
        {allTypes.map((t) => {
          const meta = HAT_META[t];
          const wearer = hats.find((h) => h.hat_type === t);
          const status = wearer?.eligibility_status ?? "severed";
          const active = status === "active";
          const Icon = meta.icon;
          return (
            <div
              key={t}
              title={`${meta.label} — ${meta.desc} · ${status.toUpperCase()}`}
              className={cn(
                "min-w-[72px] flex-shrink-0 rounded-2xl p-3 border text-center transition-all",
                active
                  ? "bg-white border-teal-200 shadow-sm"
                  : status === "grayed"
                    ? "bg-gray-50 border-gray-200 opacity-60"
                    : "bg-gray-50 border-gray-200 opacity-30"
              )}
            >
              <Icon className={cn("w-5 h-5 mx-auto mb-1", active ? "text-orange-500" : "text-gray-400")} />
              <div className={cn("text-[8px] font-black uppercase tracking-wider", active ? "text-teal-800" : "text-gray-400")}>
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
