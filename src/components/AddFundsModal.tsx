import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CreditCard,
  Building2,
  CheckCircle,
  Plus,
  X,
  Coins,
  Copy,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  fiatEnabled?: boolean;
  usdcEnabled?: boolean;
  usdcAddress?: string | null;
}

type Step = 'select' | 'add-card' | 'success' | 'usdc-deposit';

const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

const AddFundsModal = ({
  isOpen,
  onClose,
  fiatEnabled = true,
  usdcEnabled = false,
  usdcAddress = null,
}: AddFundsModalProps) => {
  const onlyUsdc = usdcEnabled && !fiatEnabled;
  const onlyFiat = fiatEnabled && !usdcEnabled;
  const neither = !fiatEnabled && !usdcEnabled;

  const initialStep: Step = onlyUsdc ? 'usdc-deposit' : 'select';
  const [step, setStep] = useState<Step>(initialStep);
  const [cardType, setCardType] = useState<'debit' | 'credit'>('debit');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [copied, setCopied] = useState(false);

  // Re-sync initial step whenever the modal opens or rail availability changes
  useEffect(() => {
    if (!isOpen) return;
    setStep(onlyUsdc ? 'usdc-deposit' : 'select');
  }, [isOpen, onlyUsdc]);

  const copyAddress = async () => {
    if (!usdcAddress) return;
    try {
      await navigator.clipboard.writeText(usdcAddress);
      setCopied(true);
      toast({ title: 'Address copied', description: 'USDC wallet address copied to clipboard.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please copy manually.', variant: 'destructive' });
    }
  };

  const handleAddCard = () => {
    console.log('Adding card:', { cardType, cardNumber, expiryDate, cvv, cardholderName });
    setStep('success');

    setTimeout(() => {
      setStep(onlyUsdc ? 'usdc-deposit' : 'select');
      setCardNumber('');
      setExpiryDate('');
      setCvv('');
      setCardholderName('');
      onClose();
    }, 2000);
  };

  // Empty state — no rails provisioned
  if (neither) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Funds</DialogTitle>
          </DialogHeader>
          <div className="text-center py-8 space-y-2">
            <p className="text-sm text-muted-foreground">
              You need to set up a wallet rail before adding funds.
            </p>
            <p className="text-xs text-muted-foreground">
              Provision your fiat (FBO) or USDC sovereign wallet from the wallet screen.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'success') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">Card Added Successfully!</h3>
            <p className="text-muted-foreground">
              Your {cardType} card has been added and is ready to use.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'usdc-deposit') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                {!onlyUsdc && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setStep('select')}
                    className="h-auto p-1"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                )}
                Deposit USDC
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              <p className="font-semibold mb-1">Network: Base</p>
              <p>Send only USDC on the Base network to this address. Other tokens or networks will be lost.</p>
            </div>

            <div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Your USDC Wallet Address
              </Label>
              <div className="mt-1 flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <code className="flex-1 text-sm font-mono break-all">
                  {usdcAddress ? truncate(usdcAddress) : '—'}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={copyAddress}
                  disabled={!usdcAddress}
                  className="h-8 px-2"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
              {usdcAddress && (
                <p className="mt-2 text-[11px] text-muted-foreground break-all">{usdcAddress}</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (step === 'add-card') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>Add {cardType === 'debit' ? 'Debit' : 'Credit'} Card</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('select')}
                className="h-auto p-1"
              >
                <X className="w-4 h-4" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="cardNumber">Card Number</Label>
              <Input
                id="cardNumber"
                placeholder="1234 5678 9012 3456"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                maxLength={19}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="expiry">Expiry Date</Label>
                <Input
                  id="expiry"
                  placeholder="MM/YY"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  maxLength={5}
                />
              </div>
              <div>
                <Label htmlFor="cvv">CVV</Label>
                <Input
                  id="cvv"
                  placeholder="123"
                  value={cvv}
                  onChange={(e) => setCvv(e.target.value)}
                  maxLength={4}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="cardholder">Cardholder Name</Label>
              <Input
                id="cardholder"
                placeholder="John Doe"
                value={cardholderName}
                onChange={(e) => setCardholderName(e.target.value)}
              />
            </div>

            <Button
              onClick={handleAddCard}
              className="w-full bg-teal-500 hover:bg-teal-600"
              disabled={!cardNumber || !expiryDate || !cvv || !cardholderName}
            >
              Add Card
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Select step — render only enabled rails
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Funds</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            Choose how you'd like to add funds to your IDIA wallet:
          </p>

          {fiatEnabled && (
            <>
              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setCardType('debit');
                  setStep('add-card');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Debit Card</h3>
                      <p className="text-sm text-muted-foreground">Add fiat directly from your bank account</p>
                    </div>
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => {
                  setCardType('credit');
                  setStep('add-card');
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Credit Card</h3>
                      <p className="text-sm text-muted-foreground">Add fiat using your credit card</p>
                    </div>
                    <Plus className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {usdcEnabled && (
            <Card
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setStep('usdc-deposit')}
            >
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                    <Coins className="w-5 h-5 text-teal-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground">Deposit USDC</h3>
                    <p className="text-sm text-muted-foreground">Send USDC on Base to your sovereign wallet</p>
                  </div>
                  <Plus className="w-5 h-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFundsModal;
