import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  ArrowDownLeft,
  User,
  DollarSign,
  QrCode,
  Copy,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useEnhancedProfile } from '@/hooks/useEnhancedProfile';
import { useSovereignWallet } from '@/hooks/useSovereignWallet';
import { useWallet } from '@/hooks/useWallet';

const truncateAddress = (addr: string) =>
  addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;

interface SendRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SendRequestModal: React.FC<SendRequestModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'send' | 'request'>('send');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [step, setStep] = useState<'form' | 'confirm' | 'success'>('form');
  const { toast } = useToast();
  const { profile } = useEnhancedProfile();
  const { globalWalletAddress } = useSovereignWallet(profile?.id || profile?.user_id || null);
  const { wallet: nativeWallet } = useWallet();
  const userWalletAddress = globalWalletAddress || nativeWallet?.address || null;

  const handleSend = () => {
    if (!recipient || !amount) {
      toast({
        title: "Missing Information",
        description: "Please enter both recipient and amount",
        variant: "destructive"
      });
      return;
    }
    setStep('confirm');
  };

  const handleConfirm = () => {
    // Simulate transaction processing
    setTimeout(() => {
      setStep('success');
      toast({
        title: activeTab === 'send' ? "Money Sent!" : "Request Sent!",
        description: `Successfully ${activeTab === 'send' ? 'sent' : 'requested'} $${amount}`,
      });
    }, 1500);
  };

  const handleReset = () => {
    setStep('form');
    setRecipient('');
    setAmount('');
    setNote('');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Address copied to clipboard",
    });
  };

  const renderForm = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="recipient">
          {activeTab === 'send' ? 'Send to' : 'Request from'}
        </Label>
        <div className="relative">
          <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="recipient"
            placeholder="Username, email, or wallet address"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amount">Amount (IDIA-USD)</Label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="amount"
            type="number"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="pl-10"
            min="0"
            step="0.01"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input
          id="note"
          placeholder="What's this for?"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {activeTab === 'request' && (
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start space-x-3">
              <QrCode className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800 min-w-0 flex-1">
                <p className="font-medium">Your USDC Wallet Address:</p>
                {userWalletAddress ? (
                  <div className="mt-1 flex items-center space-x-2">
                    <code className="text-xs bg-blue-100 px-2 py-1 rounded font-mono">
                      {truncateAddress(userWalletAddress)}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(userWalletAddress)}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-blue-700/80">
                    No wallet linked yet. Create or import one in the Wallet tab.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Button 
        onClick={handleSend} 
        className="w-full bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
      >
        {activeTab === 'send' ? (
          <>
            <ArrowUpRight className="w-4 h-4 mr-2" />
            Send Money
          </>
        ) : (
          <>
            <ArrowDownLeft className="w-4 h-4 mr-2" />
            Send Request
          </>
        )}
      </Button>
    </div>
  );

  const renderConfirm = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-yellow-100 rounded-full flex items-center justify-center">
          <AlertCircle className="w-8 h-8 text-yellow-600" />
        </div>
        <h3 className="text-lg font-semibold">
          Confirm {activeTab === 'send' ? 'Payment' : 'Request'}
        </h3>
        <p className="text-muted-foreground">
          Review the details before proceeding
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {activeTab === 'send' ? 'Recipient:' : 'From:'}
            </span>
            <span className="font-medium">{recipient}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Amount:</span>
            <span className="font-bold text-lg">${amount} IDIA-USD</span>
          </div>
          {note && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Note:</span>
              <span className="font-medium">{note}</span>
            </div>
          )}
          <div className="flex justify-between border-t pt-3">
            <span className="text-muted-foreground">Transaction Fee:</span>
            <span className="font-medium">$0.00</span>
          </div>
        </CardContent>
      </Card>

      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={() => setStep('form')}
          className="flex-1"
        >
          Back
        </Button>
        <Button 
          onClick={handleConfirm}
          className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700"
        >
          Confirm
        </Button>
      </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center space-y-6">
      <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle className="w-8 h-8 text-green-600" />
      </div>
      
      <div>
        <h3 className="text-lg font-semibold text-green-700">
          {activeTab === 'send' ? 'Payment Sent!' : 'Request Sent!'}
        </h3>
        <p className="text-muted-foreground">
          {activeTab === 'send' 
            ? `$${amount} has been sent to ${recipient}`
            : `Request for $${amount} has been sent to ${recipient}`
          }
        </p>
      </div>

      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4">
          <div className="text-sm text-green-700 space-y-1">
            <div className="flex justify-between">
              <span>Transaction ID:</span>
              <span className="font-mono">TX-***8429</span>
            </div>
            <div className="flex justify-between">
              <span>Status:</span>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Completed
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex space-x-3">
        <Button 
          variant="outline" 
          onClick={handleReset}
          className="flex-1"
        >
          {activeTab === 'send' ? 'Send Another' : 'New Request'}
        </Button>
        <Button 
          onClick={onClose}
          className="flex-1"
        >
          Done
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (step) {
      case 'form':
        return renderForm();
      case 'confirm':
        return renderConfirm();
      case 'success':
        return renderSuccess();
      default:
        return renderForm();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {activeTab === 'send' ? (
              <>
                <ArrowUpRight className="w-5 h-5" />
                <span>Send Money</span>
              </>
            ) : (
              <>
                <ArrowDownLeft className="w-5 h-5" />
                <span>Request Money</span>
              </>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {step === 'form' && (
            <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'send' | 'request')}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="send">Send</TabsTrigger>
                <TabsTrigger value="request">Request</TabsTrigger>
              </TabsList>
              <TabsContent value={activeTab} className="mt-4">
                {renderContent()}
              </TabsContent>
            </Tabs>
          )}
          
          {step !== 'form' && renderContent()}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SendRequestModal;