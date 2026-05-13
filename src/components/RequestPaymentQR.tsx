/**
 * RequestPaymentQR
 *
 * Lets a user generate a payment request that others can scan to pay them.
 * Displays a QR code (or a copyable text payload) containing:
 * - Recipient wallet address (from the user's IDIA wallet)
 * - Optional amount (fixed or open)
 * - Optional merchant name and reference
 *
 * The QR code encodes the same PaymentRequest JSON used by NFC tags,
 * wrapped in an idialife://pay?data=<base64> URL for easy scanning.
 */

import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, QrCode, DollarSign } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generatePaymentPayload, generatePaymentUrl, USDC_TEST_MODE } from '@/config/usdc';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  walletAddress: string;
}

const RequestPaymentQR: React.FC<Props> = ({ isOpen, onClose, walletAddress }) => {
  const { toast } = useToast();
  const [amount, setAmount] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [reference, setReference] = useState('');

  const paymentUrl = useMemo(() => {
    return generatePaymentUrl(
      walletAddress,
      amount || null,
      merchantName || undefined,
      undefined,
      reference || undefined,
    );
  }, [walletAddress, amount, merchantName, reference]);

  const paymentJson = useMemo(() => {
    return generatePaymentPayload(
      walletAddress,
      amount || null,
      merchantName || undefined,
      undefined,
      reference || undefined,
    );
  }, [walletAddress, amount, merchantName, reference]);

  // Simple QR code rendering using a public API
  // In production, use a local library like 'qrcode' npm package
  const qrImageUrl = useMemo(() => {
    const encoded = encodeURIComponent(paymentUrl);
    return `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encoded}`;
  }, [paymentUrl]);

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: `${label} copied` });
  };

  const handleClose = () => {
    setAmount('');
    setMerchantName('');
    setReference('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-blue-600" />
            Request USDC Payment
          </DialogTitle>
          {USDC_TEST_MODE && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs w-fit">
              Testnet
            </Badge>
          )}
          <DialogDescription>
            Share this QR code to receive USDC. The payer scans it and confirms.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Code Display */}
          <Card>
            <CardContent className="p-4 flex flex-col items-center">
              <img
                src={qrImageUrl}
                alt="Payment QR Code"
                className="w-48 h-48 rounded border"
                loading="eager"
              />
              <p className="text-xs text-muted-foreground mt-2 text-center">
                {amount ? `$${amount} USDC` : 'Open amount'} → {walletAddress.slice(0, 8)}...{walletAddress.slice(-6)}
              </p>
            </CardContent>
          </Card>

          {/* Optional fields */}
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Amount (optional — leave blank for open amount)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Your name or business (optional)</Label>
              <Input
                placeholder="e.g., Coffee Shop"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Reference / Invoice # (optional)</Label>
              <Input
                placeholder="e.g., INV-001"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>

          {/* Copy buttons */}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={() => copy(paymentUrl, 'Payment URL')}>
              <Copy className="w-3 h-3 mr-2" />
              Copy URL
            </Button>
            <Button variant="outline" size="sm" onClick={() => copy(paymentJson, 'Payment JSON')}>
              <Copy className="w-3 h-3 mr-2" />
              Copy JSON
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            The JSON payload can also be written to an NFC tag for tap-to-pay.
          </p>

          <Button variant="outline" onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RequestPaymentQR;
