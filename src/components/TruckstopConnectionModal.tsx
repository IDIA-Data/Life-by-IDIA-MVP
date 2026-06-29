import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, Truck, Map, FileText, ShieldAlert, Zap, DollarSign, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { eventTracker } from '@/utils/EventTracker';

interface TruckstopConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  existingConnection?: any;
  onDisconnect?: () => void;
}

const TruckstopConnectionModal = ({ isOpen, onClose, onComplete, existingConnection, onDisconnect }: TruckstopConnectionModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  const handleDisconnect = async () => {
    if (!currentUserId || !existingConnection) return;
    
    console.log("[TRUCKSTOP_OAUTH][DISCONNECT][START] Initiating connection teardown.");
    try {
      const { error } = await supabase
        .from('data_connections')
        .delete()
        .eq('id', existingConnection.id)
        .eq('user_id', currentUserId);

      if (error) throw error;

      console.log("[TRUCKSTOP_OAUTH][DISCONNECT][END:OK] Connection removed.");
      onDisconnect?.();
      onClose();
    } catch (error) {
      console.error('[TRUCKSTOP_OAUTH][DISCONNECT][FATAL_FAIL] Error disconnecting Truckstop:', error);
    }
  };

  const pollForConnection = async (attempt = 1) => {
    if (attempt > 10) {
      console.error("[TRUCKSTOP_OAUTH][POLL][FATAL_FAIL] Polling exhausted.");
      setIsConnecting(false);
      return;
    }

    console.log(`[TRUCKSTOP_OAUTH][POLL][START] Attempt ${attempt}: Checking for active connection.`);
    const { data } = await supabase
      .from('data_connections')
      .select('*')
      .eq('user_id', currentUserId)
      .eq('connection_type', 'truckstop')
      .eq('is_active', true)
      .single();

    if (data) {
      console.log("[TRUCKSTOP_OAUTH][POLL][END:OK] Active connection detected.");
      toast({ title: "Connected!", description: "Truckstop account linked successfully." });
      onComplete();
      setIsConnecting(false);
    } else {
      setTimeout(() => pollForConnection(attempt + 1), 3000);
    }
  };

  const handleConnect = async () => {
    if (!currentUserId) return;

    console.log("[TRUCKSTOP_OAUTH][CONNECT][START] Requesting OAuth URL from edge function.");
    eventTracker.trackFeatureUsage({ feature: 'truckstop_connection', action: 'connect_initiated', success: false });
    setIsConnecting(true);

    try {
      const { data, error } = await supabase.functions.invoke('truckstop-auth-url', {
        body: { userId: currentUserId }
      });

      if (error) throw error;

      console.log("[TRUCKSTOP_OAUTH][CONNECT][URL_RECEIVED] Opening secure authorization window.");
      const popup = window.open(data.oauthUrl, 'TruckstopOAuth', 'width=600,height=700');
      
      if (popup) {
        pollForConnection();
      } else {
        throw new Error("Popup blocked by browser.");
      }
    } catch (error: any) {
      console.error(`[TRUCKSTOP_OAUTH][CONNECT][FATAL_FAIL] Failed to start OAuth: ${error.message}`);
      setIsConnecting(false);
      toast({ title: "Connection Failed", description: error.message, variant: "destructive" });
    }
  };

  const dataCategories = [
    { icon: Map, label: 'Carrier Visibility', desc: 'Real-time GPS, route history, and lane preferences.' },
    { icon: DollarSign, label: 'Freight Matching', desc: 'Load searches, booked freight, and rate confirmations.' },
    { icon: FileText, label: 'Document Aggregation', desc: 'Anonymized BOLs, weight tickets, and digital paperwork.' },
    { icon: ShieldAlert, label: 'Compliance Status', desc: 'DOT number status, safety ratings, and insurance auth.' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-[#FF5A00] rounded-lg flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span>{existingConnection ? 'Truckstop Go' : 'Connect Truckstop Go'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {existingConnection ? (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="font-medium text-orange-800">Truckstop Active</h3>
                <p className="text-sm text-muted-foreground">Commercial telemetry is streaming</p>
              </div>
              <Button variant="destructive" className="w-full" onClick={handleDisconnect}>Disconnect</Button>
            </div>
          ) : (
            <>
              <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
                <div className="flex items-start space-x-2">
                  <Zap className="w-5 h-5 text-orange-600 mt-0.5 shrink-0" />
                  <p className="text-sm text-orange-800">
                    Link your Truckstop account to securely stream your load history and compliance data.
                  </p>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-3">Data Categories</h4>
                <div className="space-y-2">
                  {dataCategories.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
                      <Icon className="w-4 h-4 text-orange-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Button 
                className="w-full bg-[#FF5A00] hover:bg-[#E04F00] text-white" 
                onClick={handleConnect}
                disabled={isConnecting}
              >
                {isConnecting ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Connecting...</>
                ) : (
                  'Link Truckstop'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default TruckstopConnectionModal;