import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Gavel, Loader2, ThumbsUp, ThumbsDown, MinusCircle,
  Clock, CheckCircle, XCircle, RefreshCw, ExternalLink,
} from 'lucide-react';
import { useGovernance } from '@/hooks/useGovernance';
import { PROPOSAL_STATE_COLORS, blocksToHumanTime, IS_TESTNET } from '@/config/contracts';
import type { ProposalOnChain } from '@/services/governanceService';

const EXPLORER = IS_TESTNET ? 'https://sepolia.basescan.org' : 'https://basescan.org';

// ── Single Proposal Card ────────────────────────────────────────────

const ProposalCard: React.FC<{
  proposal: ProposalOnChain;
  onVote: (proposalId: string, support: 0 | 1 | 2, reason?: string) => Promise<boolean>;
}> = ({ proposal, onVote }) => {
  const [reason, setReason] = useState('');
  const [voting, setVoting] = useState<0 | 1 | 2 | null>(null);

  const totalVotes = Number(proposal.forVotes) + Number(proposal.againstVotes) + Number(proposal.abstainVotes);
  const forPct = totalVotes > 0 ? (Number(proposal.forVotes) / totalVotes) * 100 : 0;
  const againstPct = totalVotes > 0 ? (Number(proposal.againstVotes) / totalVotes) * 100 : 0;

  const isActive = proposal.state === 1;
  const canVote = isActive && !proposal.hasVoted;

  const handleVote = async (support: 0 | 1 | 2) => {
    setVoting(support);
    await onVote(proposal.proposalId, support, reason || undefined);
    setVoting(null);
    setReason('');
  };

  // Parse description: first line is title, rest is body
  const lines = proposal.description.split('\n');
  const title = lines[0].replace(/^#\s*/, '').slice(0, 120);
  const body = lines.slice(1).join('\n').trim();

  return (
    <Card className="border-teal-50 shadow-sm rounded-3xl overflow-hidden transition-all hover:shadow-md">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <Badge className={`${PROPOSAL_STATE_COLORS[proposal.state] || 'bg-gray-100 text-gray-600'} text-[9px] font-black uppercase tracking-wider`}>
              {proposal.stateName}
            </Badge>
            <h3 className="font-black text-lg leading-tight text-slate-800 break-words">{title}</h3>
            {body && <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{body}</p>}
          </div>
        </div>

        {/* Proposer + timing */}
        <div className="flex flex-wrap gap-3 text-[10px] text-muted-foreground">
          <span className="font-mono">by {proposal.proposer.slice(0, 6)}...{proposal.proposer.slice(-4)}</span>
          <span className="flex items-center gap-1">
            <Clock size={10} />
            Vote ends: block {proposal.voteEnd.toLocaleString()}
          </span>
        </div>

        {/* Vote bars */}
        <div className="space-y-2 bg-slate-50 rounded-2xl p-4 border border-slate-100">
          <div className="flex justify-between text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <span>Voting Results</span>
            <span>{Number(totalVotes).toLocaleString(undefined, { maximumFractionDigits: 0 })} total votes</span>
          </div>

          {/* For */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-green-700 font-bold flex items-center gap-1">
                <ThumbsUp size={12} /> For
              </span>
              <span className="font-mono text-green-700">
                {Number(proposal.forVotes).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({forPct.toFixed(1)}%)
              </span>
            </div>
            <Progress value={forPct} className="h-2 [&>div]:bg-green-500" />
          </div>

          {/* Against */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-red-700 font-bold flex items-center gap-1">
                <ThumbsDown size={12} /> Against
              </span>
              <span className="font-mono text-red-700">
                {Number(proposal.againstVotes).toLocaleString(undefined, { maximumFractionDigits: 0 })} ({againstPct.toFixed(1)}%)
              </span>
            </div>
            <Progress value={againstPct} className="h-2 [&>div]:bg-red-500" />
          </div>

          {/* Abstain */}
          {Number(proposal.abstainVotes) > 0 && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MinusCircle size={12} /> Abstain</span>
              <span className="font-mono">
                {Number(proposal.abstainVotes).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>

        {/* Already voted badge */}
        {proposal.hasVoted && (
          <div className="flex items-center gap-2 text-xs text-teal-700 bg-teal-50 rounded-xl p-3 border border-teal-100">
            <CheckCircle size={14} />
            <span className="font-bold">You have already voted on this proposal.</span>
          </div>
        )}

        {/* Vote actions */}
        {canVote && (
          <div className="space-y-3">
            <Input
              placeholder="Optional: reason for your vote"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="rounded-xl text-xs"
            />
            <div className="flex gap-2">
              <Button
                onClick={() => handleVote(1)}
                disabled={voting !== null}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-black uppercase rounded-full h-10"
              >
                {voting === 1 ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ThumbsUp size={14} /> For</>}
              </Button>
              <Button
                onClick={() => handleVote(0)}
                disabled={voting !== null}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded-full h-10"
              >
                {voting === 0 ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ThumbsDown size={14} /> Against</>}
              </Button>
              <Button
                onClick={() => handleVote(2)}
                disabled={voting !== null}
                variant="outline"
                className="text-[10px] font-black uppercase rounded-full h-10"
              >
                {voting === 2 ? <Loader2 className="w-4 h-4 animate-spin" /> : <><MinusCircle size={14} /> Abstain</>}
              </Button>
            </div>
          </div>
        )}

        {/* Not active, show why */}
        {!isActive && !proposal.hasVoted && proposal.state === 0 && (
          <div className="flex items-center gap-2 text-xs text-yellow-700 bg-yellow-50 rounded-xl p-3 border border-yellow-100">
            <Clock size={14} />
            <span>Voting has not started yet (in delay period).</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Proposals List ─────────────────────────────────────────────

const OnChainProposals: React.FC = () => {
  const { proposals, loading, error, refreshProposals, castVote } = useGovernance();

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
        <p className="text-[10px] font-black uppercase tracking-widest text-teal-600/50">
          Loading on-chain proposals...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center space-y-3">
        <XCircle className="mx-auto w-8 h-8 text-red-400" />
        <p className="text-xs text-red-600">{error}</p>
        <Button variant="outline" size="sm" onClick={refreshProposals} className="rounded-full text-[10px]">
          <RefreshCw size={12} /> Retry
        </Button>
      </div>
    );
  }

  if (proposals.length === 0) {
    return (
      <div className="py-16 text-center opacity-40 space-y-3 bg-slate-50 rounded-3xl border border-slate-100">
        <Gavel className="mx-auto w-10 h-10 text-slate-400" />
        <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
          No On-Chain Proposals Found
        </p>
        <p className="text-[10px] text-slate-400">
          Proposals appear here when created through the Governor contract.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between px-1">
        <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
          {proposals.length} proposal{proposals.length !== 1 ? 's' : ''}
        </span>
        <Button variant="ghost" size="sm" onClick={refreshProposals} className="text-[10px] rounded-full h-7">
          <RefreshCw size={12} /> Refresh
        </Button>
      </div>
      {proposals.map((prop) => (
        <ProposalCard key={prop.proposalId} proposal={prop} onVote={castVote} />
      ))}
    </div>
  );
};

export default OnChainProposals;
