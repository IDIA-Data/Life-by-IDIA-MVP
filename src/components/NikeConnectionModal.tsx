
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { CheckCircle, DollarSign, Shield, Zap } from 'lucide-react';

interface NikeConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: () => void;
}

const NikeConnectionModal = ({ isOpen, onClose, onConnect }: NikeConnectionModalProps) => {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    // Simulate connection process
    await new Promise(resolve => setTimeout(resolve, 2000));
    setIsConnecting(false);
    onConnect();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-white">
              <img 
                src="/lovable-uploads/1d14c6f9-fbbd-4462-84f8-b72a4e39b89d.png" 
                alt="Strava" 
                className="w-full h-full object-contain p-1"
              />
            </div>
            <span>Connect Strava</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-gray-600 mb-4">
              Share your Strava activity data to earn money while contributing to fitness research.
            </p>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-2xl font-bold text-green-700 mb-1">$45-65/month</p>
              <p className="text-sm text-green-600">Estimated earnings from your Strava data</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Complete Privacy</p>
                <p className="text-sm text-gray-600">Your personal data stays anonymous</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Monthly Payments</p>
                <p className="text-sm text-gray-600">Get paid for your activity data</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <Zap className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Help Research</p>
                <p className="text-sm text-gray-600">Contribute to fitness and health studies</p>
              </div>
            </div>
          </div>

          <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
            <h4 className="font-medium text-orange-900 mb-2">What data is shared?</h4>
            <ul className="text-sm text-orange-800 space-y-1">
              <li>• Activity types (running, cycling, etc.)</li>
              <li>• Duration and distance metrics</li>
              <li>• General location data (city level)</li>
              <li>• Performance trends over time</li>
            </ul>
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
                'Connect Strava'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NikeConnectionModal;
