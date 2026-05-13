import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertTriangle, ExternalLink, Copy, ArrowRight, Shield } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { TxRequest, TxResult } from '@/services/walletService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  txRequest: TxRequest | null;
  estimateTransaction: (req: TxRequest) => Promise<{ gasFeeFormatted: string; totalCostFormatted: string; symbol: string; network: string; } | null>;
  sendTransaction: (req: TxRequest) => Promise<TxResult | null>;
  fromAddress: string;
}

type Phase = 'review' | 'estimating' | 'confirming' | 'sending' | 'success' | 'error';

const TransactionConfirmModal: React.FC<Props> = ({ isOpen, onClose, txRequest, estimateTransaction, sendTransaction, fromAddress }) => {
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('review');
  const [estimate, setEstimate] = useState<{ gasFeeFormatted: string; totalCostFormatted: string; symbol: string; network: string; } | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [result, setResult] = useState<TxResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Reset on open
  useEffect(() => {
    if (isOpen && txRequest) {
      setPhase('estimating');
      setResult(null);
      setErrorMsg(null);
      setEstimate(null);
      setEstimateError(null);
      estimateTransaction(txRequest).then(est => {
        if (est) {
          setEstimate(est);
          setPhase('review');
        } else {
          setEstimateError('Could not estimate transaction. Check the recipient address and your balance.');
          setPhase('review');
        }
      });
    }
  }, [isOpen, txRequest, estimateTransaction]);

  const handleConfirm = useCallback(async () => {
    if (!txRequest) return;
    setPhase('sending');
    setErrorMsg(null);
    const r = await sendTransaction(txRequest);
    if (r) {
      setResult(r);
      setPhase('success');
    } else {
      setErrorMsg('Transaction failed. Please try again.');
      setPhase('error');
    }
  }, [txRequest, sendTransaction]);

  const handleClose = () => {
    if (phase === 'sending') return; // block close during send
    onClose();
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast({ title: 'Copied to clipboard' });
  };

  const truncate = (a: string) => `${a.slice(0, 8)}...${a.slice(-6)}`;

  if (!txRequest) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-teal-600" />
            {phase === 'success' ? 'Transaction Sent' : phase === 'error' ? 'Transaction Failed' : 'Confirm Transaction'}
          </DialogTitle>
          <DialogDescription>
            {phase === 'review' && 'Review the details before approving this transaction.'}
            {phase === 'estimating' && 'Estimating fees...'}
            {phase === 'sending' && 'Broadcasting to the network. This may take a few seconds.'}
            {phase === 'success' && 'Your transaction has been confirmed on the blockchain.'}
            {phase === 'error' && 'The transaction did not go through.'}
          </DialogDescription>
        </DialogHeader>

        {(phase === 'review' || phase === 'estimating') && (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-3">
                {/* From */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">From</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono">{truncate(fromAddress)}</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(fromAddress)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* To */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">To</span>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono">{truncate(txRequest.to)}</code>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => copy(txRequest.to)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {/* Amount */}
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{txRequest.amount} {estimate?.symbol || ''}</span>
                </div>

                {/* Network */}
                {estimate && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Network</span>
                    <span className="text-xs">{estimate.network}</span>
                  </div>
                )}

                {/* Gas */}
                <div className="border-t pt-3 mt-3 space-y-1">
                  {phase === 'estimating' || !estimate ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="w-3 h-3 animate-spin" /> Estimating gas...
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Gas Fee (est.)</span>
                        <span>~{Number(estimate.gasFeeFormatted).toFixed(6)} {estimate.symbol}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-semibold border-t pt-2 mt-1">
                        <span>Total</span>
                        <span>{Number(estimate.totalCostFormatted).toFixed(6)} {estimate.symbol}</span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {estimateError && (
              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-yellow-800">{estimateError}</p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleConfirm}
                disabled={phase === 'estimating' || !!estimateError}
                className="bg-teal-500 hover:bg-teal-600"
              >
                Confirm
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}

        {phase === 'sending' && (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-12 h-12 text-teal-500 animate-spin mx-auto" />
            <p className="font-semibold">Sending...</p>
            <p className="text-sm text-muted-foreground">Please wait while the transaction is confirmed.</p>
          </div>
        )}

        {phase === 'success' && result && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="font-semibold text-green-700">Success!</h3>
              <p className="text-sm text-muted-foreground">Sent {result.amount} on {result.network}</p>
            </div>

            <Card>
              <CardContent className="p-3 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Transaction Hash</p>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs font-mono flex-1 truncate">{result.hash}</code>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => copy(result.hash)}>
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => window.open(result.blockExplorerUrl, '_blank')}>
                <ExternalLink className="w-4 h-4 mr-2" />
                View
              </Button>
              <Button onClick={handleClose} className="bg-teal-500 hover:bg-teal-600">Done</Button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <AlertTriangle className="w-8 h-8 text-red-600" />
              </div>
              <h3 className="font-semibold text-red-700">Failed</h3>
              <p className="text-sm text-muted-foreground mt-1">{errorMsg || 'Transaction failed'}</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={handleClose}>Close</Button>
              <Button onClick={() => setPhase('review')} className="bg-teal-500 hover:bg-teal-600">Try Again</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default TransactionConfirmModal;