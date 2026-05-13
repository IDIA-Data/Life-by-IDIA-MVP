import React from "react";
import { cn } from "@/lib/utils";

export type Jurisdiction = "wyoming" | "delaware";

interface Props {
  value: Jurisdiction;
  onChange: (v: Jurisdiction) => void;
}

const SegmentedJurisdiction: React.FC<Props> = ({ value, onChange }) => {
  const segs: { id: Jurisdiction; label: string; sub: string }[] = [
    { id: "wyoming", label: "Governance", sub: "WY · On-Chain" },
    { id: "delaware", label: "Operations", sub: "DE · MSA" },
  ];
  return (
    <div className="flex p-1 bg-teal-50/60 backdrop-blur-md rounded-full border border-teal-100/70 shadow-inner">
      {segs.map((s) => {
        const active = value === s.id;
        return (
          <button
            key={s.id}
            onClick={() => onChange(s.id)}
            className={cn(
              "flex-1 py-2.5 px-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all",
              active
                ? "bg-[hsl(178,42%,32%)] text-white shadow-md"
                : "text-teal-700/60 hover:text-teal-800"
            )}
          >
            <div>{s.label}</div>
            <div className={cn("text-[8px] font-bold mt-0.5", active ? "text-teal-100/80" : "text-teal-600/40")}>
              {s.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default SegmentedJurisdiction;
