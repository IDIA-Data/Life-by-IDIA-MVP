import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Fingerprint, Zap, UserCheck, UserX, Loader2, ArrowRight } from 'lucide-react';
import { useGovernance } from '@/hooks/useGovernance';

const DelegationPanel: React.FC = () => {
  const { delegation, selfDelegate, delegateTo, undelegate, refreshDelegation } = useGovernance();
  const [showDelegateInput, setShowDelegateInput] = useState(false);
  const [delegateAddress, setDelegateAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelfDelegate = async () => {
    setIsSubmitting(true);
    await selfDelegate();
    setIsSubmitting(false);
  };

  const handleDelegateTo = async () => {
    if (!delegateAddress.startsWith('0x') || delegateAddress.length !== 42) return;
    setIsSubmitting(true);
    await delegateTo(delegateAddress);
    setDelegateAddress('');
    setShowDelegateInput(false);
    setIsSubmitting(false);
  };

  const handleUndelegate = async () => {
    setIsSubmitting(true);
    await undelegate();
    setIsSubmitting(false);
  };

  if (!delegation) return null;

  return (
    <Card className="border-teal-50 shadow-sm rounded-3xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Fingerprint size={14} className="text-teal-600" /> Delegation Status
          </h3>
          {delegation.isDelegated ? (
            <Badge className="bg-green-100 text-green-800 text-[9px] font-black uppercase">Active</Badge>
          ) : (
            <Badge className="bg-orange-100 text-orange-800 text-[9px] font-black uppercase">Inactive</Badge>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-teal-50/50 rounded-2xl p-3 border border-teal-100/50">
            <p className="text-[9px] font-black uppercase tracking-wider text-teal-600/60">Token Balance</p>
            <p className="text-xl font-black text-teal-800 tracking-tight">
              {Number(delegation.balance).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[9px] text-teal-600/40 font-bold uppercase">IDIA</p>
          </div>
          <div className="bg-orange-50/50 rounded-2xl p-3 border border-orange-100/50">
            <p className="text-[9px] font-black uppercase tracking-wider text-orange-600/60">Voting Power</p>
            <p className="text-xl font-black text-orange-800 tracking-tight">
              {Number(delegation.votingPower).toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </p>
            <p className="text-[9px] text-orange-600/40 font-bold uppercase">Votes</p>
          </div>
        </div>

        {/* Delegation status detail */}
        {delegation.isDelegated && (
          <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p className="text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">
              {delegation.isSelfDelegated ? 'Self-delegated' : 'Delegated to'}
            </p>
            <p className="text-xs font-mono text-slate-700 truncate">
              {delegation.isSelfDelegated ? 'Yourself' : delegation.delegatee}
            </p>
          </div>
        )}

        {!delegation.isDelegated && (
          <div className="bg-orange-50 rounded-xl p-3 border border-orange-200/50">
            <p className="text-xs text-orange-800 font-medium">
              Your tokens are not delegated. You must delegate to activate voting power — even to yourself.
            </p>
          </div>
        )}

        {/* Delegate to another address */}
        {showDelegateInput && (
          <div className="space-y-2">
            <Input
              placeholder="0x... delegate address"
              value={delegateAddress}
              onChange={(e) => setDelegateAddress(e.target.value)}
              className="font-mono text-xs rounded-xl"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleDelegateTo}
                disabled={isSubmitting || delegateAddress.length !== 42}
                className="bg-teal-700 hover:bg-teal-800 text-white text-[10px] font-black uppercase rounded-full h-9 flex-1"
              >
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ArrowRight size={14} /> Confirm</>}
              </Button>
              <Button
                variant="outline"
                onClick={() => { setShowDelegateInput(false); setDelegateAddress(''); }}
                className="text-[10px] font-black uppercase rounded-full h-9"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showDelegateInput && (
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSelfDelegate}
              disabled={isSubmitting || delegation.isSelfDelegated}
              className={`text-[10px] font-black uppercase rounded-full h-9 flex-1 min-w-[120px] ${
                delegation.isSelfDelegated
                  ? 'bg-teal-100 text-teal-600 cursor-default'
                  : 'bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white shadow-lg shadow-teal-900/10'
              }`}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : delegation.isSelfDelegated ? (
                <><Zap size={14} /> Self-Delegated</>
              ) : (
                <><Zap size={14} /> Self Delegate</>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowDelegateInput(true)}
              disabled={isSubmitting}
              className="text-[10px] font-black uppercase rounded-full h-9 min-w-[120px] flex-1"
            >
              <UserCheck size={14} /> Delegate to Other
            </Button>
            {delegation.isDelegated && (
              <Button
                variant="outline"
                onClick={handleUndelegate}
                disabled={isSubmitting}
                className="text-[10px] font-black uppercase rounded-full h-9 w-full text-red-600 border-red-200 hover:bg-red-50"
              >
                <UserX size={14} /> Remove Delegation
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DelegationPanel;