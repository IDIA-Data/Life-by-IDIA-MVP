import React from "react";
import { cn } from "@/lib/utils";
import { Zap, Scale } from "lucide-react";

export type Jurisdiction = "wyoming" | "delaware";

interface Props {
  value: Jurisdiction;
  onChange: (v: Jurisdiction) => void;
}

const SegmentedJurisdiction: React.FC<Props> = ({ value, onChange }) => {
  // Taxonomy aligned strictly with Governance Manual Section 4
  const segs: { id: Jurisdiction; label: string; sub: string; icon: React.ElementType }[] = [
    {
      id: "wyoming",
      label: "Wyoming DUNA",
      sub: "Operational Gateway",
      icon: Zap,
    },
    {
      id: "delaware",
      label: "Delaware MSA",
      sub: "Corporate Registry",
      icon: Scale,
    },
  ];

  const handleToggle = (newJurisdiction: Jurisdiction) => {
    if (value === newJurisdiction) return;

    console.log(`[JURISDICTION_TOGGLE] START: Transitioning environment to ${newJurisdiction.toUpperCase()} portal.`);
    try {
      onChange(newJurisdiction);
      console.log(
        `[JURISDICTION_TOGGLE] SUCCESS: Interface aligned to ${newJurisdiction.toUpperCase()} operational state.`,
      );
    } catch (error: any) {
      console.error(`[JURISDICTION_TOGGLE] ERROR: Portal transition stalled. Reason: ${error.message}`);
    }
  };

  return (
    <div className="flex p-1 bg-teal-50/60 backdrop-blur-md rounded-full border border-teal-100/70 shadow-inner">
      {segs.map((s) => {
        const active = value === s.id;
        const Icon = s.icon;

        return (
          <button
            key={s.id}
            onClick={() => handleToggle(s.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center py-3 px-2 rounded-full transition-all duration-300 outline-none focus:ring-2 focus:ring-teal-500/50",
              active
                ? "bg-[hsl(178,42%,32%)] text-white shadow-md transform scale-[1.02]"
                : "text-teal-700/60 hover:text-teal-800 hover:bg-teal-100/50",
            )}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest">
              <Icon size={12} className={cn("transition-colors", active ? "text-orange-400" : "opacity-70")} />
              {s.label}
            </div>
            <div
              className={cn(
                "text-[8px] font-bold mt-1 tracking-wider uppercase transition-colors",
                active ? "text-teal-100/80" : "text-teal-600/50",
              )}
            >
              {s.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedJurisdiction;
