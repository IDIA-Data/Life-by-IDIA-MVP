import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, History, Fingerprint, MessageSquare, PenTool, Rocket, Archive, Gavel, FileText, CheckCircle2, Shield, Info, Link as LinkIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface LedgerRow {
  id: string;
  platform_guid: string;
  source_id: string;
  consent_type: string | null;
  consent_scope: string[];
  aca_hash_key: string;
  tx_hash: string | null;
  created_at: string;
  profiles?: { wallet_address: string };
}

const PAGE = 25;

// Dictionary to humanize ACA source_id / consent_type
const getActionConfig = (actionType: string | null) => {
  const type = (actionType || "").toUpperCase();
  if (type.includes("COMMENT") || type.includes("DELIBERATION")) return { icon: MessageSquare, label: "Deliberation", color: "text-blue-600 bg-blue-100 dark:bg-blue-900/40", border: "border-blue-200 dark:border-blue-800" };
  if (type.includes("SIGN") || type.includes("ENDORSE") || type.includes("OBJECT")) return { icon: PenTool, label: "Signature", color: "text-teal-600 bg-teal-100 dark:bg-teal-900/40", border: "border-teal-200 dark:border-teal-800" };
  if (type.includes("ESCALATE")) return { icon: Rocket, label: "Escalation", color: "text-orange-600 bg-orange-100 dark:bg-orange-900/40", border: "border-orange-200 dark:border-orange-800" };
  if (type.includes("TERMINATE") || type.includes("ARCHIVE") || type.includes("WITHDRAW")) return { icon: Archive, label: "Archived", color: "text-slate-600 bg-slate-200 dark:bg-slate-800", border: "border-slate-300 dark:border-slate-700" };
  if (type.includes("PROPOSAL")) return { icon: FileText, label: "Proposal", color: "text-indigo-600 bg-indigo-100 dark:bg-indigo-900/40", border: "border-indigo-200 dark:border-indigo-800" };
  if (type.includes("VOTE") || type.includes("CONSENSUS")) return { icon: CheckCircle2, label: "Consensus", color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/40", border: "border-emerald-200 dark:border-emerald-800" };
  if (type.includes("HAT") || type.includes("ROLE") || type.includes("VAULT") || type.includes("PROVISIONING")) return { icon: Shield, label: "Authorization", color: "text-amber-600 bg-amber-100 dark:bg-amber-900/40", border: "border-amber-200 dark:border-amber-800" };
  
  return { icon: Gavel, label: type.replace(/_/g, ' ') || "System Action", color: "text-slate-600 bg-slate-100 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700" };
};

const formatAddress = (r: LedgerRow) => {
  const addr = r.profiles?.wallet_address || r.platform_guid;
  if (!addr) return "System Action";
  if (addr.startsWith("0x") && addr.length === 42) {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  }
  return addr; // Will fall back to returning the GUID if no wallet exists
};

const AuditFeed: React.FC = () => {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const fetchPage = async () => {
      console.log("[AUDIT_FEED][FETCH][START] Executing ACA ledger poll.");
      try {
        const { data, error } = await (supabase as any)
          .from("user_aca_records")
          .select("id, platform_guid, source_id, consent_type, consent_scope, aca_hash_key, tx_hash, created_at")
          .order("created_at", { ascending: false })
          .limit(PAGE);
          
        if (error) throw error;

        const rawRows = data || [];
        let enrichedRows = rawRows;

        // Decoupled Address Stitching via platform_guid
        if (rawRows.length > 0) {
          const uniqueGuids = [...new Set(rawRows.map((r: any) => r.platform_guid).filter(Boolean))];
          
          if (uniqueGuids.length > 0) {
            console.log(`[AUDIT_FEED][FETCH_PROFILES][START] Resolving ${uniqueGuids.length} platform GUIDs.`);
            const { data: profilesData, error: profileError } = await (supabase as any)
              .from("profiles")
              .select("platform_guid, wallet_address")
              .in("platform_guid", uniqueGuids);

            if (!profileError) {
              const profileMap = new Map((profilesData || []).map((p: any) => [p.platform_guid, p]));
              enrichedRows = rawRows.map((r: any) => ({
                ...r,
                profiles: profileMap.get(r.platform_guid) || null
              }));
              console.log("[AUDIT_FEED][FETCH_PROFILES][END:OK] Addresses resolved successfully.");
            } else {
              console.error(`[AUDIT_FEED][FETCH_PROFILES][ERROR] Address resolution failed: ${profileError.message}`);
            }
          }
        }

        if (isMounted) {
          setRows(enrichedRows);
          setLoading(false);
        }
        console.log(`[AUDIT_FEED][FETCH][END:OK] Hydrated ${enrichedRows.length} ACA events.`);
      } catch (err: any) {
        console.error(`[AUDIT_FEED][FETCH][FATAL_FAIL] Ledger sync collapsed: ${err.message}`);
        if (isMounted) setLoading(false);
      }
    };

    fetchPage();
    const t = setInterval(fetchPage, 15000);
    return () => {
      isMounted = false;
      clearInterval(t);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <section className="space-y-4 pt-2">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
          <History size={14} className="text-teal-600" /> Immutable Audit Trail
        </h2>
        
        {/* Collapsed Info Tooltip */}
        <div className="group relative flex items-center">
          <Info size={14} className="text-muted-foreground/50 hover:text-teal-600 transition-colors cursor-help" />
          <div className="absolute right-0 top-full mt-2 w-60 p-3 bg-slate-800 text-slate-100 text-[10px] rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
            <span className="font-bold uppercase tracking-widest text-teal-400 block mb-1">System of Record</span>
            This ledger cryptographically anchors every action, signature, and state change within the protocol. Each event generates an auditable hash (ACA), ensuring complete legal transparency.
          </div>
        </div>
      </div>
      
      {rows.length === 0 ? (
        <div className="py-10 text-center opacity-40 bg-slate-50 dark:bg-muted/30 rounded-3xl border border-slate-100 dark:border-border">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">No ACA entries recorded</p>
        </div>
      ) : (
        <div className="relative pl-4 space-y-6 before:absolute before:inset-y-2 before:left-[27px] before:w-[2px] before:bg-slate-100 dark:before:bg-slate-800/60">
          {rows.map((r) => {
            // Favor consent_type if available, otherwise use source_id for styling
            const config = getActionConfig(r.consent_type || r.source_id);
            const Icon = config.icon;
            
            return (
              <div key={r.id} className="relative pl-8">
                {/* Timeline Node */}
                <div className={`absolute left-[-11px] top-3 p-1.5 rounded-full border-[3px] border-white dark:border-background z-10 ${config.color}`}>
                  <Icon size={12} strokeWidth={3} />
                </div>

                <Card className={`rounded-2xl border-none shadow-sm bg-slate-50/50 dark:bg-card/50 overflow-hidden`}>
                  <CardContent className="p-3 sm:p-4">
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {/* Header row: Action & Time */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant="outline" className={`bg-white dark:bg-background border ${config.border} text-[9px] font-black uppercase tracking-wider`}>
                          {config.label}
                        </Badge>
                        <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground shrink-0">
                          {new Date(r.created_at).toLocaleString(undefined, { 
                            month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                          })}
                        </span>
                      </div>

                      {/* Actor Information */}
                      <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 pt-1">
                        <Fingerprint size={12} className="text-muted-foreground shrink-0" />
                        <span className="font-mono text-[10px] truncate">{formatAddress(r)}</span>
                      </div>

                      {/* ACA Protocol Trace */}
                      <div className="flex items-center gap-1.5 mt-1 pt-1">
                        <Shield size={10} className="text-teal-600/70 shrink-0" />
                        <span className="font-mono text-[8px] text-teal-700/70 dark:text-teal-400/70 uppercase tracking-widest truncate">
                          ACA: {r.aca_hash_key}
                        </span>
                      </div>

                      {/* Structured Metadata: Scopes & TX Hash */}
                      <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-black/5 dark:border-white/5">
                        {r.consent_scope && r.consent_scope.map((scope, idx) => (
                          <span key={idx} className="inline-flex items-center rounded-md bg-white dark:bg-background border border-slate-100 dark:border-slate-800 px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground shadow-sm">
                            Scope: <span className="ml-1 text-foreground">{scope}</span>
                          </span>
                        ))}
                        
                        {r.tx_hash && (
                          <span className="inline-flex items-center rounded-md bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 px-1.5 py-0.5 text-[9px] font-medium text-indigo-700 dark:text-indigo-300 shadow-sm max-w-full">
                            <LinkIcon size={8} className="mr-1 shrink-0" />
                            TX: <span className="ml-1 font-mono truncate">{r.tx_hash}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};

export default AuditFeed;