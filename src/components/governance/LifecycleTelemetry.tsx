import React, { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ProposalLite {
  id: string;
  title: string;
  lifecycle_phase: "draft" | "active" | "queued" | "executed";
  created_at: string;
}

const PHASE_META = {
  draft: { icon: "📝", label: "Proposed", color: "text-gray-600 bg-gray-50" },
  active: { icon: "⚡", label: "Live Vote", color: "text-orange-600 bg-orange-50" },
  queued: { icon: "⏳", label: "In Timelock", color: "text-amber-700 bg-amber-50" },
  executed: { icon: "✅", label: "Settled", color: "text-teal-700 bg-teal-50" },
} as const;

const LifecycleTelemetry: React.FC = () => {
  const [items, setItems] = useState<ProposalLite[]>([]);

  useEffect(() => {
    const fetchItems = async () => {
      const { data } = await (supabase
        .from("dao_proposals" as any)
        .select("id,title,lifecycle_phase,created_at")
        .order("created_at", { ascending: false })
        .limit(8) as any);
      setItems((data as any) || []);
    };
    fetchItems();
    const ch = supabase
      .channel("dao_proposals_telemetry")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dao_proposals" }, fetchItems)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  if (items.length === 0) {
    return (
      <div className="py-8 text-center opacity-30">
        <p className="text-[10px] font-bold uppercase tracking-widest">No Telemetry Yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((it) => {
        const meta = PHASE_META[it.lifecycle_phase] || PHASE_META.draft;
        return (
          <div key={it.id} className="flex items-center gap-3 p-3 bg-white border border-teal-50 rounded-2xl">
            <div className={cn("text-lg w-9 h-9 flex items-center justify-center rounded-full", meta.color)}>
              {meta.icon}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold truncate">{it.title}</p>
              <p className={cn("text-[9px] font-black uppercase tracking-widest", meta.color.split(" ")[0])}>
                {meta.label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LifecycleTelemetry;
