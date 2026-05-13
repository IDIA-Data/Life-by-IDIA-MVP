import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  AlertCircle,
  Car,
  Zap,
  MapPin,
  Battery,
  Gauge,
  Shield
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { eventTracker } from '@/utils/EventTracker';

interface FordConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  existingConnection?: any;
  onDisconnect?: () => void;
}

const FordConnectionModal = ({ isOpen, onClose, onComplete, existingConnection, onDisconnect }: FordConnectionModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
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
    
    try {
      eventTracker.trackFeatureUsage({ feature: 'ford_connection', action: 'disconnect_initiated', success: false });

      const { error } = await supabase
        .from('data_connections')
        .update({ is_active: false })
        .eq('id', existingConnection.id)
        .eq('user_id', currentUserId);

      if (!error) {
        eventTracker.trackFeatureUsage({ feature: 'ford_connection', action: 'disconnected', success: true });
        onDisconnect?.();
        onClose();
      }
    } catch (error) {
      console.error('Error disconnecting Ford:', error);
    }
  };

  const handleConnect = async () => {
    if (!currentUserId) {
      toast({ title: "Error", description: "Please log in to connect your Ford account.", variant: "destructive" });
      return;
    }

    eventTracker.trackFeatureUsage({ feature: 'ford_connection', action: 'connect_initiated', success: false });
    setIsConnecting(true);

    try {
      const { data: urlData, error: urlError } = await supabase.functions.invoke('ford-auth-url', {
        body: { userId: currentUserId }
      });

      if (urlError) throw new Error(`Edge function error: ${urlError.message || 'Unknown error'}`);
      if (!urlData?.oauthUrl) throw new Error('No OAuth URL received from server');

      eventTracker.trackFeatureUsage({ feature: 'ford_connection', action: 'oauth_url_retrieved', success: true });

      const popup = window.open('', 'ford-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      
      if (!popup || popup.closed) {
        setIsConnecting(false);
        const useDirectLink = confirm("Your browser blocked the popup. Open Ford login in a new tab instead?");
        if (useDirectLink) {
          window.open(urlData.oauthUrl, '_blank');
          toast({ title: "Ford Login Opened", description: "Complete the connection and return to this page." });
        }
        return;
      }
      
      popup.location.href = urlData.oauthUrl;
      
      let checkClosed: ReturnType<typeof setInterval>;
      let timeoutId: ReturnType<typeof setTimeout>;
      
      const cleanup = () => {
        if (checkClosed) clearInterval(checkClosed);
        if (timeoutId) clearTimeout(timeoutId);
      };
      
      checkClosed = setInterval(() => {
        try {
          if (popup.closed) {
            cleanup();
            setIsConnecting(false);
            setTimeout(() => checkConnection(), 1000);
          }
        } catch { /* cross-origin expected */ }
      }, 1000);

      timeoutId = setTimeout(() => {
        if (!popup.closed) {
          cleanup();
          popup.close();
          setIsConnecting(false);
          toast({ title: "Connection Timeout", description: "Please try again.", variant: "destructive" });
        }
      }, 300000);

    } catch (error) {
      console.error('Error starting Ford OAuth:', error);
      setIsConnecting(false);
      toast({
        title: "Connection Failed",
        description: `Failed to start Ford connection: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    }
  };

  const checkConnection = async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase
        .from('data_connections')
        .select('*')
        .eq('user_id', currentUserId)
        .eq('connection_type', 'ford')
        .eq('is_active', true)
        .single();

      if (data && !error) {
        setConnected(true);
        toast({ title: "Connected!", description: "Your Ford vehicle has been connected successfully." });
        setTimeout(() => { onComplete(); setConnected(false); }, 2000);
      }
    } catch (error) {
      console.error('Error checking Ford connection:', error);
    }
  };

  const dataCategories = [
    { icon: MapPin, label: 'Location & Movement', desc: 'GPS, speed, heading' },
    { icon: Gauge, label: 'Driving Dynamics', desc: 'Pedals, acceleration, RPM' },
    { icon: Battery, label: 'EV / Battery', desc: 'SOC, charging, range' },
    { icon: Car, label: 'Vehicle Health', desc: 'Odometer, tires, DTCs' },
    { icon: Shield, label: 'Security & Cabin', desc: 'Doors, climate, alarm' },
  ];

  if (connected) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">FordConnect Linked!</h3>
            <p className="text-muted-foreground mb-4">
              Your vehicle telemetry is now streaming into IDIA.
            </p>
            <p className="text-sm text-blue-600 font-medium">
              Earning potential: $40-80/month from vehicle data
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
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="w-5 h-5 text-white" />
            </div>
            <span>{existingConnection ? 'FordConnect' : 'Connect FordConnect'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {existingConnection ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Car className="w-6 h-6 text-blue-600" />
                </div>
                <h3 className="font-medium text-blue-800">FordConnect Active</h3>
                <p className="text-sm text-muted-foreground">Vehicle telemetry is streaming</p>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Live Telemetry</p>
                    <p className="text-xs text-blue-600">Processing vehicle data automatically</p>
                  </div>
                  <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
                <Button variant="destructive" className="flex-1" onClick={handleDisconnect}>Disconnect</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="flex items-start space-x-2">
                  <Zap className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-blue-900 mb-1">Full Vehicle Telemetry</p>
                    <p className="text-sm text-blue-800">
                      Connect your Ford vehicle to stream real-time driving, location, EV, 
                      and diagnostic data — all anonymized and earning you IDIA-USD.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-foreground mb-3">Data Categories</h4>
                <div className="space-y-2">
                  {dataCategories.map(({ icon: Icon, label, desc }) => (
                    <div key={label} className="flex items-center space-x-3 p-2 rounded-lg bg-muted/50">
                      <Icon className="w-4 h-4 text-blue-600 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-foreground">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h5 className="font-medium text-foreground mb-2">Privacy & Anonymization</h5>
                <p className="text-sm text-muted-foreground">
                  All vehicle data is anonymized before marketplace bundling. GPS positions are 
                  zone-hashed, VINs are pseudonymized, and no personally identifiable information 
                  is ever shared.
                </p>
              </div>

              <div className="flex space-x-3">
                <Button variant="outline" className="flex-1" onClick={onClose} disabled={isConnecting}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-blue-600 hover:bg-blue-700" 
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    'Connect with Ford'
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FordConnectionModal;
