
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle, 
  ExternalLink,
  Key,
  AlertCircle,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { eventTracker } from '@/utils/EventTracker';

interface StravaConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  existingConnection?: any;
  onDisconnect?: () => void;
}

const StravaConnectionModal = ({ isOpen, onClose, onComplete, existingConnection, onDisconnect }: StravaConnectionModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getUser();
  }, []);

  const handleDisconnect = async () => {
    if (!currentUserId || !existingConnection) return;
    
    try {
      // Track disconnection through synapse
      eventTracker.trackFeatureUsage({
        feature: 'strava_connection',
        action: 'disconnect_initiated',
        success: false
      });

      // This will automatically trigger synapse via database trigger
      const { error } = await supabase
        .from('data_connections')
        .update({ is_active: false })
        .eq('id', existingConnection.id)
        .eq('user_id', currentUserId);

      if (!error) {
        // Track successful disconnection
        eventTracker.trackFeatureUsage({
          feature: 'strava_connection',
          action: 'disconnected',
          success: true
        });
        
        onDisconnect?.();
        onClose();
      }
    } catch (error) {
      console.error('Error disconnecting Strava:', error);
      
      // Track disconnection error
      eventTracker.trackFeatureUsage({
        feature: 'strava_connection',
        action: 'disconnect_failed',
        success: false
      });
    }
  };

  const handleConnect = async () => {
    if (!currentUserId) {
      toast({
        title: "Error",
        description: "Please log in to connect your Strava account.",
        variant: "destructive",
      });
      return;
    }

    // Track connection attempt through synapse
    eventTracker.trackFeatureUsage({
      feature: 'strava_connection',
      action: 'connect_initiated',
      success: false
    });

    setIsConnecting(true);

    try {
      console.log('Starting Strava connection for user:', currentUserId);
      
      // Get OAuth URL from edge function with proper client ID
      const { data: urlData, error: urlError } = await supabase.functions.invoke('strava-controller', {
        body: { action: 'get-auth-url', userId: currentUserId }
      });

      console.log('OAuth URL response:', { urlData, urlError });

      if (urlError) {
        console.error('Edge function error:', urlError);
        
        // Track edge function error
        eventTracker.trackFeatureUsage({
          feature: 'strava_connection',
          action: 'oauth_url_failed',
          success: false,
          context: {
            error_message: urlError.message || 'Unknown error'
          }
        });
        
        throw new Error(`Edge function error: ${urlError.message || 'Unknown error'}`);
      }

      if (!urlData?.oauthUrl) {
        console.error('No OAuth URL returned:', urlData);
        
        // Track missing OAuth URL error
        eventTracker.trackFeatureUsage({
          feature: 'strava_connection',
          action: 'oauth_url_missing',
          success: false
        });
        
        throw new Error('No OAuth URL received from server');
      }
      
      console.log('Opening popup with URL:', urlData.oauthUrl);
      
      // Track OAuth URL retrieval success
      eventTracker.trackFeatureUsage({
        feature: 'strava_connection',
        action: 'oauth_url_retrieved',
        success: true
      });
      
      // Check if popup will be blocked
      const popup = window.open('', 'strava-oauth', 'width=600,height=700,scrollbars=yes,resizable=yes');
      
      if (!popup || popup.closed || typeof popup.closed == 'undefined') {
        // Popup was blocked - offer alternative
        setIsConnecting(false);
        
        // Track popup blocked
        eventTracker.trackFeatureUsage({
          feature: 'strava_connection',
          action: 'popup_blocked',
          success: false
        });
        
        toast({
          title: "Popup Blocked",
          description: "Please allow popups for this site and try again, or use the direct link below.",
          variant: "destructive",
        });
        
        // Show direct link option
        const useDirectLink = confirm(
          "Your browser blocked the popup. Would you like to open Strava in a new tab instead?\n\n" +
          "Note: You'll need to manually return to this page after connecting."
        );
        
        if (useDirectLink) {
          window.open(urlData.oauthUrl, '_blank');
          
          // Track direct link usage
          eventTracker.trackFeatureUsage({
            feature: 'strava_connection',
            action: 'direct_link_used',
            success: true
          });
          
          toast({
            title: "Strava Opened",
            description: "Please complete the connection and return to this page.",
          });
        }
        return;
      }
      
      // Navigate to the OAuth URL
      popup.location.href = urlData.oauthUrl;
      
      // Track successful popup opening
      eventTracker.trackFeatureUsage({
        feature: 'strava_connection',
        action: 'popup_opened',
        success: true
      });
      
      // Monitor popup for closure with cleanup
      let checkClosed;
      let timeoutId;
      
      const cleanup = () => {
        if (checkClosed) clearInterval(checkClosed);
        if (timeoutId) clearTimeout(timeoutId);
      };
      
      checkClosed = setInterval(() => {
        try {
          if (popup.closed) {
            cleanup();
            setIsConnecting(false);
            console.log('Popup closed, checking connection status...');
            
            // Track popup closure
            eventTracker.trackFeatureUsage({
              feature: 'strava_connection',
              action: 'popup_closed',
              success: true
            });
            
            // Check if connection was successful
            setTimeout(() => {
              checkConnection();
            }, 1000);
          }
        } catch (error) {
          // Handle cross-origin errors when checking popup status
          console.log('Popup monitoring error (expected):', error);
        }
      }, 1000);

      // Timeout after 5 minutes with proper cleanup
      timeoutId = setTimeout(() => {
        if (!popup.closed) {
          cleanup();
          popup.close();
          setIsConnecting(false);
          
          // Track timeout
          eventTracker.trackFeatureUsage({
            feature: 'strava_connection',
            action: 'connection_timeout',
            success: false
          });
          
          toast({
            title: "Connection Timeout",
            description: "The connection process took too long. Please try again.",
            variant: "destructive",
          });
        }
      }, 300000); // 5 minutes

    } catch (error) {
      console.error('Error starting OAuth flow:', error);
      setIsConnecting(false);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      
      // Track general connection error
      eventTracker.trackFeatureUsage({
        feature: 'strava_connection',
        action: 'connection_error',
        success: false,
        context: {
          error_message: errorMessage
        }
      });
      
      toast({
        title: "Connection Failed",
        description: `Failed to start Strava connection: ${errorMessage}. Please try again.`,
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
        .eq('connection_type', 'strava')
        .eq('is_active', true)
        .single();

      if (data && !error) {
        setConnected(true);
        toast({
          title: "Connected!",
          description: "Your Strava account has been connected successfully.",
        });
        
        setTimeout(() => {
          onComplete();
          setConnected(false);
        }, 2000);
      }
    } catch (error) {
      console.error('Error checking connection:', error);
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
            <h3 className="text-xl font-bold text-gray-900 mb-2">Strava Connected!</h3>
            <p className="text-gray-600 mb-4">
              Your Strava data is now connected and will enhance your Nike Run Club earnings.
            </p>
            <p className="text-sm text-green-600 font-medium">
              Your total earning potential is now $75-95/month
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center">
              <Key className="w-5 h-5 text-white" />
            </div>
            <span>{existingConnection ? 'Strava' : 'Connect Strava'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {existingConnection ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-2">
                  <Zap className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="font-medium text-orange-800">Strava Connected</h3>
                <p className="text-sm text-gray-600">Your activity data is actively earning rewards</p>
              </div>
              
              <div className="bg-orange-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-800">Active Pipeline</p>
                    <p className="text-xs text-orange-600">Processing data automatically</p>
                  </div>
                  <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse"></div>
                </div>
              </div>
              
              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={onClose}
                >
                  Close
                </Button>
                <Button 
                  variant="destructive"
                  className="flex-1"
                  onClick={handleDisconnect}
                >
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-medium text-amber-900 mb-1">Enhanced Data Collection</p>
                    <p className="text-sm text-amber-800">
                      Connecting Strava will provide additional activity data that complements 
                      your Apple Health connection, increasing your earning potential.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2">Connect with Strava</h4>
                <div className="space-y-2 text-sm text-gray-600">
                  <p>Click the button below to securely connect your Strava account.</p>
                  <p>You'll be redirected to Strava to authorize the connection.</p>
                </div>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <h5 className="font-medium text-blue-900 mb-2">Data Usage</h5>
                <p className="text-sm text-blue-700">
                  Your Strava data will be combined with Apple Health data to provide 
                  more comprehensive fitness insights while maintaining complete anonymity.
                </p>
              </div>

              <div className="flex space-x-3">
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={onClose}
                  disabled={isConnecting}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-orange-500 hover:bg-orange-600" 
                  onClick={handleConnect}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </div>
                  ) : (
                    'Connect with Strava'
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

export default StravaConnectionModal;
