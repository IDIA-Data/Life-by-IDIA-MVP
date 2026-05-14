import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, CheckCircle, DollarSign, FileKey, Copy } from "lucide-react";
// 1. Rename the import to intercept it
import { supabase as typedSupabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AppleHealthModal from "./AppleHealthModal";
import AndroidHealthModal from "./AndroidHealthModal";
import { isAndroid, isIOS, isWeb } from "@/services/platform";
import { useWalletBalance } from "@/hooks/useWalletBalance";

// 2. THE ULTIMATE BYPASS:
// By typing this as 'any' at the root, TypeScript will NEVER evaluate
// the deep database schema when you type `supabase.from()`.
const supabase: any = typedSupabase;

// THE BLOCKER: Strictly flat type expanded for telemetry awareness.
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
  const [showAppleHealthModal, setShowAppleHealthModal] = useState(false);
  const [showAndroidHealthModal, setShowAndroidHealthModal] = useState(false);
  const [lastSyncStatus, setLastSyncStatus] = useState<string>("unknown");
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
    console.log("🚀 [DASHBOARD_LOG] START: fetchAcaRecords");
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
      console.log("🏁 [DASHBOARD_LOG] END: fetchAcaRecords");
    }
  };

  const fetchConnections = async () => {
    console.log("🚀 [DASHBOARD_LOG] START: fetchConnections");
    try {
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (!user) {
        console.log("⚠️ [DASHBOARD_LOG] No user found in fetchConnections.");
        return;
      }

      // 1. Fetch data connections (Is the pipe open?)
      console.log("📡 [DASHBOARD_LOG] Fetching data_connections...");
      const connRes = await supabase.from("data_connections").select("*").eq("user_id", user.id);

      if (connRes.error) {
        console.error("🚨 [DASHBOARD_LOG] Connection fetch failed:", connRes.error.message);
        throw connRes.error;
      }

      // 2. Fetch absolute latest audit record (When did water last flow?)
      // CRITICAL FIX: Changed "user_id" to "platform_guid" and removed the "Today" filter.
      console.log("⚖️ [DASHBOARD_LOG] Fetching latest ACA audit record for platform_guid...");
      const auditRes = await supabase
        .from("user_aca_records")
        .select("created_at")
        .eq("platform_guid", user.id) // <-- THE SMOKING GUN FIX
        .eq("source_id", "apple_health")
        .order("created_at", { ascending: false })
        .limit(1);

      if (auditRes.error) {
        console.error("🚨 [DASHBOARD_LOG] Audit fetch failed:", auditRes.error.message);
      }

      const rawData = connRes.data || [];
      const auditData = auditRes.data || [];

      let calculatedSyncStatus = "no_data";

      // 3. Time-Based Logic (The Burst Architect)
      if (auditData.length > 0) {
        const lastSyncTime = new Date(auditData[0].created_at).getTime();
        const hoursSinceLastSync = (Date.now() - lastSyncTime) / (1000 * 60 * 60);

        console.log(`⏱️ [DASHBOARD_LOG] Hours since last Apple Health sync: ${hoursSinceLastSync.toFixed(2)}`);

        if (hoursSinceLastSync < 6) {
          calculatedSyncStatus = "recent";
        } else if (hoursSinceLastSync < 24) {
          calculatedSyncStatus = "delayed"; // Idle
        } else {
          calculatedSyncStatus = "stale";
        }
      } else {
        console.log("⚠️ [DASHBOARD_LOG] No ACA records found for this platform_guid.");
      }

      // 4. Map the UI State securely
      const cleaned: DataBlocker[] = [];
      for (let i = 0; i < rawData.length; i++) {
        const item = rawData[i];
        const entry: DataBlocker = {
          id: String(item.id),
          connection_type: String(item.connection_type),
          user_id: String(item.user_id),
        };

        if (entry.connection_type === "apple_health") {
          entry.status = auditData.length > 0 ? "success" : "no_data";
        }
        cleaned.push(entry);
      }

      setLastSyncStatus(calculatedSyncStatus);
      setConnections(cleaned);

      // Wallet balance handled by useWalletBalance hook (USDC tile).
    } catch (error: any) {
      console.error("🚨 [DASHBOARD_LOG] FATAL Error in fetchConnections:", error.message);
    } finally {
      setLoading(false);
      console.log("🏁 [DASHBOARD_LOG] END: fetchConnections");
    }
  };

  const triggerFriendForDataEvent = () => {
    window.dispatchEvent(new CustomEvent("showFriend", { detail: { trigger: "data" } }));
  };

  const getSyncStatusBadge = () => {
    switch (lastSyncStatus) {
      case "recent":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Synced Recently
          </Badge>
        );
      case "delayed":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Idle
          </Badge>
        );
      case "no_data":
        return <Badge variant="outline">No Data Found</Badge>;
      default:
        return <Badge variant="outline">Checking...</Badge>;
    }
  };

  // Per-source sync badge. Each connection type owns its own badge state.
  const renderSyncBadgeFor = (connectionType: string) => {
    if (connectionType === "apple_health") return getSyncStatusBadge();
    return null;
  };

  const handleAppleHealthComplete = async () => {
    try {
      console.log("🔗 [DASHBOARD_LOG] Apple Health connection complete.");
      await fetchConnections();
      await fetchAcaRecords();
      setShowAppleHealthModal(false); // Force close after connecting
      triggerFriendForDataEvent();
    } catch {}
  };

  const handleAppleHealthDisconnect = async () => {
    try {
      console.log("🔌 [DASHBOARD_LOG] Apple Health disconnect triggered.");
      if (!currentUserId) {
        console.log("⚠️ [DASHBOARD_LOG] No user ID, aborting disconnect.");
        return;
      }

      // THE MISSING COMMAND: Explicitly tell Supabase to destroy the connection
      console.log("🗑️ [DASHBOARD_LOG] Executing database deletion for apple_health...");
      const { error } = await supabase
        .from("data_connections")
        .delete()
        .eq("user_id", currentUserId)
        .eq("connection_type", "apple_health");

      if (error) {
        console.error("🚨 [DASHBOARD_LOG] Database deletion failed:", error.message);
        throw error;
      }

      console.log("✅ [DASHBOARD_LOG] Deletion successful. Refreshing UI.");

      // Now we refresh the local state and close the doors
      await fetchConnections();
      setShowAppleHealthModal(false);

      toast({
        title: "Source Disconnected",
        description: "Apple Health data has been unlinked.",
      });
    } catch (err: any) {
      toast({
        title: "Disconnect Failed",
        description: err.message || "Could not sever the connection.",
        variant: "destructive",
      });
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

  const formatSourceName = (sourceId: string) => {
    return sourceId.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  };

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

  return (
    <div className="space-y-4">
      <Tabs defaultValue="connections" className="w-full">
        <TabsList className="grid grid-cols-2 w-full bg-muted/20 shrink-0">
          <TabsTrigger value="connections" className="text-[11px] px-1">Connections</TabsTrigger>
          <TabsTrigger value="audit" className="text-[11px] px-1">Transactions</TabsTrigger>
        </TabsList>

        <Card className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white mt-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center space-x-2 mb-1">
                  <p className="text-teal-100">USDC</p>
                </div>
                <p className="text-3xl font-bold">
                  ${balanceLoading ? "0.00" : balance.usdc_balance.toFixed(2)}
                </p>
                <p className="text-sm text-teal-100 mt-1">
                  {connections.length > 0
                    ? "USDC balance from connected sources"
                    : "Connect data sources to start earning USDC"}
                </p>
              </div>
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <DollarSign className="w-8 h-8" />
              </div>
            </div>
          </CardContent>
        </Card>

        <TabsContent value="connections" className="space-y-4">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Available Data Sources</h2>
            {(() => {
              const healthType = isAndroid() ? "health_connect" : "apple_health";
              const hasHealth = getConnectionStatus(healthType);
              
              if (hasHealth) {
                return (
                  <div className="text-center py-8 text-muted-foreground">
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">All available data sources connected</p>
                  </div>
                );
              }
              
              return (
                <div className="flex justify-center">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => {
                      if (isAndroid()) setShowAndroidHealthModal(true);
                      else setShowAppleHealthModal(true);
                    }}
                  >
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-background shadow-sm border transition-all group-hover:shadow-md group-hover:scale-105">
                      {isAndroid() ? (
                        <div className="w-full h-full flex items-center justify-center bg-green-50">
                          <Activity className="w-8 h-8 text-green-600" />
                        </div>
                      ) : (
                        <img
                          src="/lovable-uploads/8f82179a-e516-4c98-8c9f-aae3ee45c242.png"
                          alt="Apple Health"
                          className="w-full h-full object-contain p-2"
                        />
                      )}
                    </div>
                    <p className="text-xs text-center mt-1 text-muted-foreground">
                      {isAndroid() ? "Health Connect" : "Apple Health"}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-foreground">Connected Data Sources</h2>
            {visibleConnections.length > 0 ? (
              <div className="flex justify-center space-x-8">
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
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-background shadow-sm border-2 border-green-500 transition-all group-hover:shadow-md group-hover:scale-105">
                        {connection.connection_type === "health_connect" ? (
                          <div className="w-full h-full flex items-center justify-center bg-green-50">
                            <Activity className="w-8 h-8 text-green-600" />
                          </div>
                        ) : (
                          <img
                            src="/lovable-uploads/8f82179a-e516-4c98-8c9f-aae3ee45c242.png"
                            alt={connection.connection_type}
                            className="w-full h-full object-contain p-2"
                          />
                        )}
                      </div>
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-background">
                        <CheckCircle className="w-3 h-3 text-white" />
                      </div>
                    </div>
                    <div className="mt-2">{renderSyncBadgeFor(connection.connection_type)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No data sources connected yet</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2 text-base">
                <FileKey className="w-4 h-4" />
                <span>Audit Log</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {acaLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading audit records...</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Source</TableHead>
                      <TableHead>ACA Hash (Audit Key)</TableHead>
                      <TableHead>Timestamp</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {acaRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium text-sm">
                          {formatSourceName(record.source_id || "unknown")}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <span>{record.aca_hash_key?.substring(0, 12)}...</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => {
                                navigator.clipboard.writeText(record.aca_hash_key || "");
                                toast({ title: "Copied", description: "ACA hash copied to clipboard" });
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(record.created_at).toLocaleString()}
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