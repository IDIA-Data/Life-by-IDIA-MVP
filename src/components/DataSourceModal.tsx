import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, DollarSign, CheckCircle, AlertCircle, Lock, Eye, Users, Zap, FileKey } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateACAHash } from "@/utils/acaGenerator";

interface DataSourceModalProps {
  source: any;
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void; // DISCUSSION: Added prop for real-time refresh
}

const DataSourceModal = ({ source, isOpen, onClose, onComplete }: DataSourceModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!source) return null;

  const handleConnect = async () => {
    setIsConnecting(true);
    setErrorMessage(null);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        setErrorMessage("Please sign in first.");
        setIsConnecting(false);
        return;
      }
      const userId = session.user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("platform_guid")
        .eq("user_id", userId)
        .maybeSingle();
      const platformGuid = profile?.platform_guid || userId;

      // 1. Mandatory ACA Hash Generation (IDIA Liability Shield)
      const sourceId = source.name.toLowerCase().replace(/\s+/g, "_");
      const { hash, payload } = await generateACAHash(platformGuid, sourceId, ["KYC_VAULT", "WALLET_PROVISIONING"]);

      // 2. Log Mandatory Transaction Record
      const { error: acaError } = await supabase.from("user_aca_records").insert({
        platform_guid: platformGuid,
        aca_hash_key: hash,
        source_id: sourceId,
        consent_scope: payload.consent_scope as string[],
      });

      if (acaError) {
        console.error("ACA Record Error:", acaError);
        setErrorMessage("Failed to create mandatory audit record.");
        setIsConnecting(false);
        return;
      }

      // 3. Route to appropriate live integration based on source type
      const sourceName = source.name.toLowerCase();

      if (sourceName.includes("apple") || sourceName.includes("health")) {
        setErrorMessage(
          "Apple Health requires the IDIA iOS app. Please use the Apple Health card on the Data screen to connect.",
        );
        setIsConnecting(false);
        return;
      } else if (sourceName.includes("strava")) {
        const { data, error } = await supabase.functions.invoke("strava-auth-url", {
          body: { userId, aca_hash_key: hash, aca_payload: payload },
        });
        if (error) {
          setErrorMessage("Failed to connect to Strava. Please try again.");
          return;
        }
        if (data?.oauthUrl) {
          window.open(data.oauthUrl, "_blank");
          setConnected(true);
          onComplete?.(); // DISCUSSION: Trigger UI refresh immediately
          setTimeout(() => {
            onClose();
            setConnected(false);
          }, 2000);
          return;
        }
      } else if (sourceName.includes("google") || sourceName.includes("fit")) {
        const { error } = await supabase.functions.invoke("google-fit-sync", {
          body: { user_id: userId, aca_hash_key: hash, sync_type: "manual", aca_payload: payload },
        });
        if (error) {
          setErrorMessage("Google Fit requires OAuth authorization. Please contact support.");
          return;
        }
      } else if (sourceName.includes("ford")) {
        const { data, error } = await supabase.functions.invoke("ford-auth-url", {
          body: { userId, aca_hash_key: hash, aca_payload: payload },
        });
        if (error) {
          setErrorMessage("Failed to connect to FordConnect. Please try again.");
          return;
        }
        if (data?.oauthUrl) {
          window.open(data.oauthUrl, "_blank");
          setConnected(true);
          onComplete?.(); // DISCUSSION: Trigger UI refresh immediately
          setTimeout(() => {
            onClose();
            setConnected(false);
          }, 2000);
          return;
        }
      } else {
        setErrorMessage(`${source.name} integration requires additional setup. Live data connections only.`);
        return;
      }

      // 4. Create data connection record
      await supabase.from("data_connections").upsert({
        user_id: userId,
        connection_type: sourceId,
        connection_name: source.name,
        is_active: true,
        last_sync_at: new Date().toISOString(),
      });

      // DISCUSSION: DISSEMINATE JOINING FEE (The fix to use $.50 fiat bump)
      await supabase.functions.invoke("credit-user-wallet", {
        body: {
          user_id: userId,
          reward_amount: 0.5,
          source: "joining_fee",
          description: `Joining Fee: ${source.name} connected`,
        },
      });

      setConnected(true);
      onComplete?.(); // DISCUSSION: Refresh dashboard balance

      setTimeout(() => {
        onClose();
        setConnected(false);
      }, 2000);
    } catch (error: any) {
      console.error("Consent Protocol Error:", error);
      setErrorMessage(`Connection error: ${error.message || "Please try again."}`);
      setConnected(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const Icon = source.icon;

  const getPrivacyColor = (level: string) => {
    switch (level) {
      case "Very High":
        return "text-green-600 bg-green-100";
      case "High":
        return "text-green-600 bg-green-100";
      case "Medium":
        return "text-yellow-600 bg-yellow-100";
      default:
        return "text-orange-600 bg-orange-100";
    }
  };

  if (connected) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Connection Established</h3>
            <p className="text-muted-foreground mb-4">
              Your {source.name} is now connected. Mandatory audit record logged.
            </p>
            <p className="text-sm text-green-600 font-medium">
              Liability Shield active — earning {source.estimatedEarnings} monthly
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              <Icon className="w-5 h-5 text-muted-foreground" />
            </div>
            <span>Connect {source.name}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {errorMessage && (
            <div className="flex items-center space-x-2 text-red-600 bg-red-50 p-3 rounded-lg">
              <AlertCircle className="w-5 h-5" />
              <p className="text-sm">{errorMessage}</p>
            </div>
          )}

          {/* Earnings Info */}
          <div className="bg-gradient-to-r from-teal-50 to-cyan-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <DollarSign className="w-5 h-5 text-teal-600" />
              <span className="font-semibold text-teal-900">Earning Potential</span>
            </div>
            <p className="text-2xl font-bold text-teal-900">{source.estimatedEarnings}</p>
            <p className="text-sm text-teal-700">Estimated monthly earnings</p>
          </div>

          {/* Privacy Level */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">Privacy Level</span>
            </div>
            <Badge className={getPrivacyColor(source.privacyLevel)}>{source.privacyLevel}</Badge>
          </div>

          {/* Description */}
          <div>
            <h4 className="font-medium text-foreground mb-2">How it works</h4>
            <p className="text-sm text-muted-foreground">{source.description}</p>
          </div>

          {/* Data Types */}
          <div>
            <h4 className="font-medium text-foreground mb-2">Data collected</h4>
            <div className="space-y-2">
              {source.dataTypes?.map((type: string, index: number) => (
                <div key={index} className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-muted-foreground">{type}</span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Liability Shield Notice */}
          <div className="bg-muted/50 border border-border p-4 rounded-lg">
            <div className="flex items-start space-x-3">
              <FileKey className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground mb-1">Consent Protocol — Mandatory Audit</p>
                <p className="text-xs text-muted-foreground">
                  Connecting generates a cryptographic Auditable Consent Artifact (ACA) anchored to your account. All
                  data egress is logged with a SHA-256 hash for your transparency and legal protection. View your audit
                  trail in the Transactions tab.
                </p>
              </div>
            </div>
          </div>

          {/* Privacy Guarantees */}
          <div className="space-y-3">
            <h4 className="font-medium text-foreground flex items-center space-x-2">
              <Lock className="w-4 h-4" />
              <span>Privacy Guarantees</span>
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span className="text-muted-foreground">Data is anonymized before sharing</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span className="text-muted-foreground">No personal identifiers are included</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span className="text-muted-foreground">You can disconnect at any time</span>
              </div>
              <div className="flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-green-500 mt-0.5" />
                <span className="text-muted-foreground">Full transparency on data usage</span>
              </div>
            </div>
          </div>

          {/* Usage Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-start space-x-2">
              <Users className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <p className="font-medium text-blue-900 mb-1">Who uses this data?</p>
                <p className="text-sm text-blue-700">
                  Verified research institutions, ethical AI companies, and academic studies focused on improving
                  digital experiences and social good.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <Button variant="outline" className="flex-1" onClick={onClose} disabled={isConnecting}>
              Cancel
            </Button>
            <Button className="flex-1 bg-teal-500 hover:bg-teal-600" onClick={handleConnect} disabled={isConnecting}>
              {isConnecting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Connecting...</span>
                </div>
              ) : (
                "Connect & Start Earning"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DataSourceModal;
