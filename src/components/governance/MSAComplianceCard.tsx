import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface MSA {
  id: string;
  sla_name: string;
  target_value: number | null;
  current_value: number | null;
  status: "meeting" | "warning" | "breach";
}

const dotColor = (s: string) =>
  s === "meeting" ? "bg-emerald-500" : s === "warning" ? "bg-amber-500" : "bg-red-500";

const MSAComplianceCard: React.FC = () => {
  const [items, setItems] = useState<MSA[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("dao_msa_metrics" as any)
        .select("*")
        .order("measured_at", { ascending: false });
      setItems((data as any) || []);
    })();
  }, []);

  return (
    <Card className="rounded-3xl border-teal-50 shadow-sm">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-700 flex items-center gap-2">
            <ShieldCheck size={14} /> Delaware MSA · SLA Compliance
          </h3>
        </div>
        {items.length === 0 ? (
          <p className="text-[10px] uppercase tracking-widest opacity-30 py-6 text-center">
            Awaiting Oracle Telemetry
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-2.5 bg-teal-50/30 rounded-xl">
                <div className="flex items-center gap-2.5">
                  <span className={cn("w-2 h-2 rounded-full", dotColor(m.status))} />
                  <span className="text-xs font-bold">{m.sla_name}</span>
                </div>
                <div className="text-[10px] font-black tracking-wider text-muted-foreground">
                  {m.current_value ?? "—"} / {m.target_value ?? "—"}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MSAComplianceCard;
