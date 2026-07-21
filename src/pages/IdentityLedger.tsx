import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Download, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  downloadLedgerCsv,
  fetchLedger,
  type LedgerPayload,
} from "@/utils/identityLedgerExport";

export default function IdentityLedger() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [payload, setPayload] = useState<LedgerPayload | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }
        const data = await fetchLedger(user.id);
        setPayload(data);
      } catch (err) {
        console.error("[IdentityLedger] fetch failed", err);
        toast({
          title: "Load failed",
          description: "Unable to load your identity ledger.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, toast]);

  const onDownload = async () => {
    if (!payload) return;
    try {
      await downloadLedgerCsv(payload);
      toast({ title: "Export saved", description: "Your ledger CSV has been saved to your device." });
    } catch (err) {
      console.error("[IdentityLedger] download failed", err);
      toast({
        title: "Download failed",
        description: "Could not save the ledger to your device.",
        variant: "destructive",
      });
    }
  };

  const records = payload?.records ?? [];
  const profile = payload?.profile ?? null;

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-background pt-[max(0.5rem,env(safe-area-inset-top))] pb-[env(safe-area-inset-bottom)]">
      <div className="container max-w-4xl mx-auto py-2 px-2 sm:px-3 flex flex-col flex-1 min-h-0">
        {/* Header frame */}
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/settings")}
            className="flex items-center gap-2 shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Identity Ledger
            </h1>
            <p className="text-xs text-muted-foreground">
              Every consent record cryptographically anchored to your Sovereign Identity.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={loading || !payload}
          >
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Download CSV
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading ledger…
            </div>
          ) : (
            <>
              {/* Profile summary */}
              <Card className="p-4">
                <h2 className="text-sm font-semibold mb-3">Sovereign Identity Profile</h2>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Display Name</dt>
                  <dd className="font-medium">{profile?.display_name ?? "—"}</dd>
                  <dt className="text-muted-foreground">Subscription Tier</dt>
                  <dd className="font-medium">{profile?.subscription_tier ?? "—"}</dd>
                  <dt className="text-muted-foreground">KYC Status</dt>
                  <dd className="font-medium">{profile?.kyc_status ?? "—"}</dd>
                  <dt className="text-muted-foreground">Member Since</dt>
                  <dd className="font-medium">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : "—"}
                  </dd>
                </dl>
              </Card>

              {/* Consent records */}
              <Card className="p-0 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h2 className="text-sm font-semibold">Consent Records</h2>
                  <span className="text-[11px] text-muted-foreground">
                    {records.length} record{records.length === 1 ? "" : "s"}
                  </span>
                </div>
                {records.length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                    No consent records on file yet. Records appear here every time you
                    grant consent through the DELT protocol.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[11px]">Timestamp</TableHead>
                          <TableHead className="text-[11px]">Source</TableHead>
                          <TableHead className="text-[11px]">Type</TableHead>
                          <TableHead className="text-[11px]">Scope</TableHead>
                          <TableHead className="text-[11px]">ACA Hash</TableHead>
                          <TableHead className="text-[11px]">Tx</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {records.map((r) => (
                          <TableRow key={r.aca_hash_key}>
                            <TableCell className="text-[11px] whitespace-nowrap">
                              {new Date(r.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-[11px]">{r.source_id ?? "—"}</TableCell>
                            <TableCell className="text-[11px]">{r.consent_type ?? "—"}</TableCell>
                            <TableCell className="text-[11px]">
                              {(r.consent_scope ?? []).join(", ") || "—"}
                            </TableCell>
                            <TableCell className="text-[11px] font-mono">
                              {r.aca_hash_key.slice(0, 10)}…
                            </TableCell>
                            <TableCell className="text-[11px] font-mono">
                              {r.tx_hash ? `${r.tx_hash.slice(0, 8)}…` : "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
