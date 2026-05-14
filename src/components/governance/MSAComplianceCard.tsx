import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldCheck, Loader2, Activity, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface MSA {
  id: string;
  sla_name: string;
  target_value: number | null;
  current_value: number | null;
  status: "meeting" | "warning" | "breach";
}

const dotColor = (s: string) =>
  s === "meeting"
    ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"
    : s === "warning"
      ? "bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse"
      : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse";

const textColor = (s: string) =>
  s === "meeting" ? "text-emerald-700" : s === "warning" ? "text-amber-700" : "text-red-700";

const MSAComplianceCard: React.FC = () => {
  const [items, setItems] = useState<MSA[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchMetrics = async () => {
      console.log("[MSA_COMPLIANCE] START: Syncing Delaware MSA telemetry.");
      try {
        const { data, error } = await supabase
          .from("dao_msa_metrics" as any)
          .select("*")
          .order("measured_at", { ascending: false });

        if (error) throw error;

        if (isMounted) {
          console.log(`[MSA_COMPLIANCE] SUCCESS: Retrieved ${data?.length || 0} active SLA matrices.`);
          setItems((data as any) || []);
        }
      } catch (err: any) {
        console.error(`[MSA_COMPLIANCE] CRITICAL_FAILURE: Telemetry sync stalled. Reason: ${err.message}`);
        toast({
          title: "MSA Sync Failed",
          description: "Could not retrieve legal compliance telemetry.",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setIsLoading(false);
          console.log("[MSA_COMPLIANCE] END: Sync execution thread terminated.");
        }
      }
    };

    // Initial Fetch
    fetchMetrics();

    // Establish Real-Time Socket Connection
    console.log("[MSA_COMPLIANCE] SOCKET_START: Establishing real-time connection to Delaware Registry.");
    const ch = supabase
      .channel("msa_metrics_telemetry")
      .on("postgres_changes" as any, { event: "*", schema: "public", table: "dao_msa_metrics" }, (payload) => {
        console.log("[MSA_COMPLIANCE] SOCKET_EVENT: Real-time MSA mutation detected. Re-evaluating SLAs...", payload);
        fetchMetrics();
      })
      .subscribe((status) => {
        console.log(`[MSA_COMPLIANCE] SOCKET_STATUS: Registry socket state -> ${status}`);
      });

    return () => {
      isMounted = false;
      console.log("[MSA_COMPLIANCE] SOCKET_CLOSE: Tearing down real-time connection.");
      supabase.removeChannel(ch);
    };
  }, []);

  if (isLoading) {
    return (
      <Card className="rounded-3xl border-teal-50 shadow-sm overflow-hidden">
        <CardContent className="p-8 flex flex-col items-center justify-center space-y-3">
          <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          <p className="text-[9px] font-black uppercase tracking-widest text-teal-700/50">
            Auditing Fiduciary Telemetry...
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-3xl border-teal-50 shadow-sm overflow-hidden transition-all">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-teal-50/50 pb-3">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-teal-800 flex items-center gap-2">
            <ShieldCheck size={14} className="text-teal-600" />
            Delaware MSA · SLA Compliance
          </h3>
          {items.some((i) => i.status === "breach") && (
            <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
              <AlertTriangle size={10} /> Active Breach
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 opacity-40 space-y-2">
            <Activity className="w-8 h-8 text-slate-400" />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Awaiting Oracle Telemetry</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-colors",
                  m.status === "meeting"
                    ? "bg-teal-50/30 border-teal-50"
                    : m.status === "warning"
                      ? "bg-amber-50/30 border-amber-100"
                      : "bg-red-50/30 border-red-100",
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center w-3 h-3">
                    <span className={cn("absolute w-2 h-2 rounded-full", dotColor(m.status))} />
                  </div>
                  <div className="space-y-0.5">
                    <span className={cn("text-xs font-bold block", textColor(m.status))}>{m.sla_name}</span>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground block">
                      Status: {m.status}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-black tracking-tighter text-slate-700">
                    {m.current_value ?? "—"}{" "}
                    <span className="text-[10px] text-slate-400 font-medium tracking-normal">
                      / {m.target_value ?? "—"}
                    </span>
                  </div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Oracle Metric</div>
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
