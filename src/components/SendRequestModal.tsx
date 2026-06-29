import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExternalLink, ShieldCheck, Wallet } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const SendRequestModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { toast } = useToast();

  const handleLaunchMetaMask = () => {
    if (window.webkit?.messageHandlers?.launchMetaMask) {
      window.webkit.messageHandlers.launchMetaMask.postMessage({});
      onClose();
    } else {
      toast({
        title: "Native Bridge Error",
        description: "MetaMask not accessible.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Wallet className="w-5 h-5 text-[#F6851B]" />
            <span>Manage Wallet</span>
          </DialogTitle>
        </DialogHeader>

        <div className="py-2 space-y-4">
          <Card className="bg-slate-50 border-slate-100 rounded-2xl shadow-none">
            <CardContent className="p-5 text-center space-y-3">
              <ShieldCheck className="w-10 h-10 text-[#F6851B] mx-auto" />
              <h3 className="font-semibold">Native Wallet Control</h3>
              <p className="text-xs text-muted-foreground">
                Send, receive, and sign transactions directly in the native MetaMask app.
              </p>
            </CardContent>
          </Card>

          <Button
            onClick={handleLaunchMetaMask}
            className="w-full h-12 rounded-xl bg-[#F6851B] hover:bg-[#E2761B] text-white"
          >
            Launch MetaMask <ExternalLink className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendRequestModal;
