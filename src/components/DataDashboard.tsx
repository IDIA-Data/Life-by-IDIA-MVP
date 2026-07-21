import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, CheckCircle, DollarSign, FileKey, Copy } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppleHealthModal from "./AppleHealthModal";
import AndroidHealthModal from "./AndroidHealthModal";
import { isAndroid, isIOS, isWeb } from "@/services/platform";
import { useWalletBalance } from "@/hooks/useWalletBalance";

const supabase: any = typedSupabase;

interface DataBlocker {
  id: string;
  connection_type: string;
  user_id: string;
  status?: string;
  metrics?: {
    hrv?: number;
    noise?: number;
    asymmetry?: number;
  };
}

const DataDashboard = () => {
  const { balance, loading: balanceLoading } = useWalletBalance();
  const [connections, setConnections] = useState<DataBlocker[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal States
  const [showAppleHealthModal, setShowAppleHealthModal] = useState(false);
  const [showAndroidHealthModal, setShowAndroidHealthModal] = useState(false);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [acaRecords, setAcaRecords] = useState<any[]>([]);
  const [acaLoading, setAcaLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
    fetchConnections();
  }, []);

  useEffect(() => {
    if (currentUserId) {
      fetchConnections();
      fetchAcaRecords();
    }
  }, [currentUserId]);

  const fetchAcaRecords = async () => {
    if (!currentUserId) return;
    setAcaLoading(true);
    try {
      const { data, error } = await supabase
        .from("user_aca_records")
        .select("*")
        .eq("platform_guid", currentUserId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (data) setAcaRecords(data);
    } catch (err: any) {
      console.error("🚨 [DASHBOARD_LOG] Failed to fetch ACA records:", err.message);
    } finally {
      setAcaLoading(false);
    }
  };

  const fetchConnections = async () => {
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) return;

      const connRes = await supabase.from("data_connections").select("*").eq("user_id", user.id);

      if (connRes.error) {
        throw connRes.error;
      }

      // Fetch the last 100 audit records to evaluate all sources
      const auditRes = await supabase
        .from("user_aca_records")
        .select("source_id, created_at")
        .eq("platform_guid", user.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const rawData = connRes.data || [];
      const auditData = auditRes.data || [];

      const cleaned: DataBlocker[] = [];
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];

        // Find the latest audit record for THIS specific source
        const latestAudit = auditData.find((a) => a.source_id === item.connection_type);

        let status = "no_data";
        if (latestAudit) {
          const lastSyncTime = new Date(latestAudit.created_at).getTime();
          const hoursSinceLastSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

          if (hoursSinceLastSync < 6) status = "recent";
          else if (hoursSinceLastSync < 24) status = "delayed";
          else status = "stale";
        }

        cleaned.push({
          id: String(item.id),
          connection_type: String(item.connection_type),
          user_id: String(item.user_id),
          status: status,
        });
      }

      setConnections(cleaned);
    } catch (error: any) {
      console.error("🚨 [DASHBOARD_LOG] FATAL Error in fetchConnections:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerFriendForDataEvent = () => {
    window.dispatchEvent(new CustomEvent("showFriend", { detail: { trigger: "data" } }));
  };

  const STATUS_META: Record<string, { label: string; description: string; dot: string }> = {
    recent: {
      label: "Synced Recently",
      description: "Data flowed in the last 6 hours.",
      dot: "bg-green-500",
    },
    delayed: {
      label: "Idle",
      description: "Last sync was 6–24 hours ago.",
      dot: "bg-yellow-500",
    },
    stale: {
      label: "Stale",
      description: "No sync in over 24 hours.",
      dot: "bg-red-500",
    },
    no_data: {
      label: "No Data Found",
      description: "Source connected but no audit record yet.",
      dot: "bg-muted-foreground",
    },
    unknown: {
      label: "Checking…",
      description: "Still verifying the pipe.",
      dot: "bg-muted-foreground/50",
    },
  };

  const formatRelative = (d: Date) => {
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const formatSourceName = (sourceId: string) => {
    return sourceId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const renderSyncBadgeFor = (connection: DataBlocker) => {
    const status = connection.status || "unknown";
    const meta = STATUS_META[status] || STATUS_META["unknown"];
    const order = ["recent", "delayed", "stale", "no_data", "unknown"];

    // Find the latest audit record for this specific connection to get "last change"
    const latestAudit = acaRecords.find((a) => a.source_id === connection.connection_type);

    let badgeClass = "bg-muted text-muted-foreground hover:bg-muted/80";
    if (meta.dot.includes("green"))
      badgeClass = "bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400";
    if (meta.dot.includes("yellow"))
      badgeClass = "bg-yellow-100 text-yellow-800 hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400";
    if (meta.dot.includes("red"))
      badgeClass = "bg-red-100 text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400";

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="focus:outline-none"
            onClick={(e) => {
              e.stopPropagation(); // Crucial: prevents the click from opening the modal!
            }}
          >
            <Badge
              variant="secondary"
              className={`border-none px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${badgeClass}`}
            >
              {meta.label}
            </Badge>
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-xs font-semibold text-foreground mb-2 uppercase tracking-wider">
            {formatSourceName(connection.connection_type)} Status
          </p>
          <div className="space-y-1.5">
            {order.map((key) => {
              const m = STATUS_META[key];
              const isActive = key === status;
              return (
                <div
                  key={key}
                  className={`flex items-start gap-2 rounded-md p-1.5 ${isActive ? "bg-muted ring-1 ring-border" : ""}`}
                >
                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${m.dot}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-medium text-foreground">{m.label}</p>
                      {isActive && (
                        <span className="text-[9px] uppercase tracking-wider text-primary font-bold">Current</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-snug">{m.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {latestAudit && (
            <p className="mt-3 pt-2 border-t border-border text-[10px] text-muted-foreground">
              Last sync: {formatRelative(new Date(latestAudit.created_at))}
            </p>
          )}
        </PopoverContent>
      </Popover>
    );
  };

  const handleAppleHealthComplete = async () => {
    try {
      await fetchConnections();
      await fetchAcaRecords();
      setShowAppleHealthModal(false);
      triggerFriendForDataEvent();
    } catch {}
  };

  const handleAppleHealthDisconnect = async () => {
    try {
      if (!currentUserId) return;
      const { error } = await supabase
        .from("data_connections")
        .delete()
        .eq("user_id", currentUserId)
        .eq("connection_type", "apple_health");

      if (error) throw error;

      await fetchConnections();
      setShowAppleHealthModal(false);
      toast({ title: "Source Disconnected" });
    } catch (err: any) {
      toast({ title: "Disconnect Failed", description: err.message, variant: "destructive" });
    }
  };

  const getConnectionStatus = (connectionType: string) => {
    return connections.find((conn) => conn.connection_type === connectionType);
  };

  const visibleConnections = connections.filter((c) => {
    if (c.connection_type === "apple_health") return isIOS() || isWeb();
    if (c.connection_type === "health_connect") return isAndroid();
    return false;
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg mb-6"></div>
          <div className="h-24 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  const healthType = isAndroid() ? "health_connect" : "apple_health";
  const hasHealth = getConnectionStatus(healthType);

  return (
    <div className="space-y-4">
      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid grid-cols-2 w-full bg-muted/20 shrink-0">
          <TabsTrigger value="connections" className="text-[11px] px-1">
            Connections
          </TabsTrigger>
          <TabsTrigger value="audit" className="text-[11px] px-1">
            Transactions
          </TabsTrigger>
        </TabsList>

        <Card className="bg-gradient-to-br from-[hsl(178,42%,32%)] to-[hsl(178,42%,42%)] text-white border-none shadow-xl rounded-[2.5rem] overflow-hidden mt-4">
          <CardContent className="p-7">
            <div className="flex justify-between items-start">
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-teal-100/60">USDC Balance</p>
                <h2 className="text-4xl font-black">${balanceLoading ? "0.00" : balance.usdc_balance.toFixed(2)}</h2>
              </div>
              <DollarSign className="w-10 h-10 text-orange-400 drop-shadow-lg" />
            </div>
            <div className="mt-6 flex items-center gap-2 border-t border-white/10 pt-4">
              <span
                className={`w-1.5 h-1.5 rounded-full ${connections.length > 0 ? "bg-emerald-400 animate-pulse" : "bg-orange-400"}`}
              />
              <span className="text-[9px] font-black uppercase tracking-widest text-teal-50">
                {connections.length > 0 ? "Earning from connected sources" : "Connect data sources to earn"}
              </span>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="connections" className="space-y-4">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Available Data Sources</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {/* Health App Connection */}
              {!hasHealth && (
                <div
                  className="relative cursor-pointer group flex flex-col items-center p-4 bg-card rounded-2xl border border-border hover:shadow-md transition-all"
                  onClick={() => {
                    if (isAndroid()) setShowAndroidHealthModal(true);
                    else setShowAppleHealthModal(true);
                  }}
                >
                  <div className="w-14 h-14 rounded-full overflow-hidden bg-muted/30 flex items-center justify-center mb-2">
                    {isAndroid() ? (
                      <Activity className="w-7 h-7 text-green-600" />
                    ) : (
                      <img
                        src="/lovable-uploads/8f82179a-e516-4c98-8c9f-aae3ee45c242.png"
                        alt="Apple Health"
                        className="w-8 h-8 object-contain"
                      />
                    )}
                  </div>
                  <p className="text-xs font-bold text-center">{isAndroid() ? "Health Connect" : "Apple Health"}</p>
                  <p className="text-[9px] text-muted-foreground mt-1">Biometrics</p>
                </div>
              )}

              {hasHealth && (
                <div className="col-span-full text-center py-6 text-muted-foreground">
                  <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50 text-teal-600" />
                  <p className="text-sm">All available sources connected</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Active Streams</h2>
            {visibleConnections.length > 0 ? (
              <div className="flex flex-wrap gap-6">
                {visibleConnections.map((connection) => (
                  <div
                    key={connection.id}
                    className="flex flex-col items-center cursor-pointer group"
                    onClick={() => {
                      if (connection.connection_type === "apple_health") setShowAppleHealthModal(true);
                      else if (connection.connection_type === "health_connect") setShowAndroidHealthModal(true);
                    }}
                  >
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full overflow-hidden bg-background shadow-sm border-2 border-emerald-400 transition-all group-hover:scale-105 flex items-center justify-center">
                        {connection.connection_type === "health_connect" && (
                          <Activity className="w-8 h-8 text-green-600" />
                        )}
                        {connection.connection_type === "apple_health" && (
                          <img
                            src="/lovable-uploads/8f82179a-e516-4c98-8c9f-aae3ee45c242.png"
                            alt="Apple Health"
                            className="w-8 h-8 object-contain"
                          />
                        )}
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                      </div>
                    </div>
                    <p className="text-[10px] font-bold mt-2 uppercase tracking-wider text-muted-foreground">
                      {formatSourceName(connection.connection_type)}
                    </p>
                    <div className="mt-1">{renderSyncBadgeFor(connection)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground bg-slate-50 dark:bg-muted/20 rounded-2xl border border-dashed">
                <Activity className="w-6 h-6 mx-auto mb-2 opacity-30" />
                <p className="text-[11px] uppercase tracking-widest font-bold">No Active Streams</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card className="rounded-[1.5rem] border-none shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center space-x-2 text-sm uppercase tracking-widest font-black text-muted-foreground">
                <FileKey className="w-4 h-4 text-teal-600" />
                <span>Audit Log</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {acaLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading audit records...</div>
              ) : acaRecords.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-[10px] uppercase tracking-widest">
                  No entries found
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/10 hover:bg-muted/10">
                      <TableHead className="text-[10px] uppercase tracking-widest">Source</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest">ACA Hash (Audit Key)</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-widest text-right">Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acaRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-bold text-xs">
                          {formatSourceName(record.source_id || "unknown")}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span className="truncate max-w-[80px] sm:max-w-none">
                              {record.aca_hash_key?.substring(0, 16)}...
                            </span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5 hover:bg-teal-50 hover:text-teal-600"
                              onClick={() => {
                                navigator.clipboard.writeText(record.aca_hash_key || "");
                                toast({ title: "Copied", description: "ACA hash copied to clipboard" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-[9px] text-muted-foreground text-right whitespace-nowrap">
                          {new Date(record.created_at).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AppleHealthModal
        isOpen={showAppleHealthModal}
        onClose={() => setShowAppleHealthModal(false)}
        onComplete={handleAppleHealthComplete}
        existingConnection={getConnectionStatus("apple_health")}
        onDisconnect={handleAppleHealthDisconnect}
      />

      <AndroidHealthModal
        isOpen={showAndroidHealthModal}
        onClose={() => setShowAndroidHealthModal(false)}
        onComplete={async () => {
          setShowAndroidHealthModal(false);
          await fetchConnections();
        }}
        existingConnection={getConnectionStatus("health_connect")}
        onDisconnect={async () => {
          await fetchConnections();
          setShowAndroidHealthModal(false);
        }}
      />
    </div>
  );
};

export default DataDashboard;
