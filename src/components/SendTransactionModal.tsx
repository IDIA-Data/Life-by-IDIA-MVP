import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send } from 'lucide-react';
import { ethers } from 'ethers';
import TransactionConfirmModal from './TransactionConfirmModal';
import type { TxRequest, TxResult, BalanceInfo } from '@/services/walletService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  fromAddress: string;
  balance: BalanceInfo | null;
  estimateTransaction: (req: TxRequest) => Promise<{ gasFeeFormatted: string; totalCostFormatted: string; symbol: string; network: string; } | null>;
  sendTransaction: (req: TxRequest) => Promise<TxResult | null>;
}

const SendTransactionModal: React.FC<Props> = ({ isOpen, onClose, fromAddress, balance, estimateTransaction, sendTransaction }) => {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [txRequest, setTxRequest] = useState<TxRequest | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleProceed = () => {
    setError(null);
    if (!ethers.isAddress(recipient.trim())) { setError('Invalid recipient address'); return; }
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError('Enter a valid amount greater than zero'); return; }
    if (balance && amt > parseFloat(balance.balanceFormatted)) { setError(`Insufficient balance. You have ${balance.balanceFormatted} ${balance.symbol}`); return; }

    setTxRequest({ to: recipient.trim(), amount: amount.trim() });
    setShowConfirm(true);
  };

  const handleConfirmClose = () => {
    setShowConfirm(false);
    // If success, also close the send form
    setRecipient('');
    setAmount('');
    setTxRequest(null);
    onClose();
  };

  const handleClose = () => {
    setRecipient('');
    setAmount('');
    setError(null);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen && !showConfirm} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-teal-600" />
              Send {balance?.symbol || ''}
            </DialogTitle>
            <DialogDescription>
              Send tokens to another address. You'll review the details before signing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {balance && (
              <div className="text-sm">
                <span className="text-muted-foreground">Available:</span>{' '}
                <span className="font-semibold">{Number(balance.balanceFormatted).toFixed(4)} {balance.symbol}</span>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="0x..."
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="font-mono text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount ({balance?.symbol || ''})</Label>
              <Input
                id="amount"
                type="number"
                step="0.0001"
                placeholder="0.0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
              {balance && parseFloat(balance.balanceFormatted) > 0 && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => setAmount((parseFloat(balance.balanceFormatted) * 0.99).toFixed(6))}
                >
                  Use Max (leaves room for gas)
                </Button>
              )}
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleProceed} disabled={!recipient || !amount} className="bg-teal-500 hover:bg-teal-600">
                Review Transaction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionConfirmModal
        isOpen={showConfirm}
        onClose={handleConfirmClose}
        txRequest={txRequest}
        estimateTransaction={estimateTransaction}
        sendTransaction={sendTransaction}
        fromAddress={fromAddress}
      />
    </>
  );
};

export default SendTransactionModal;