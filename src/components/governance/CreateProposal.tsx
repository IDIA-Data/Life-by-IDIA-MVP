import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, Clock, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { useGovernance } from '@/hooks/useGovernance';
import { blocksToHumanTime, BLOCKS_PER_HOUR, BLOCKS_PER_DAY } from '@/config/contracts';

interface CreateProposalProps {
  onClose?: () => void;
}

const TIMING_PRESETS = [
  { label: 'Fast', delay: BLOCKS_PER_HOUR, period: BLOCKS_PER_DAY, desc: '1hr delay · 1 day vote' },
  { label: 'Standard', delay: BLOCKS_PER_DAY, period: BLOCKS_PER_DAY * 7, desc: '1 day delay · 7 day vote' },
  { label: 'Extended', delay: BLOCKS_PER_DAY, period: BLOCKS_PER_DAY * 14, desc: '1 day delay · 14 day vote' },
  { label: 'Long', delay: BLOCKS_PER_DAY * 3, period: BLOCKS_PER_DAY * 30, desc: '3 day delay · 30 day vote' },
];

const CreateProposal: React.FC<CreateProposalProps> = ({ onClose }) => {
  const { createProposal, createProposalWithTiming, params } = useGovernance();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [useCustomTiming, setUseCustomTiming] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(1); // Standard
  const [customDelay, setCustomDelay] = useState([BLOCKS_PER_DAY]);
  const [customPeriod, setCustomPeriod] = useState([BLOCKS_PER_DAY * 7]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fullDescription = title ? `# ${title}\n\n${description}` : description;

  const handleSubmit = async () => {
    if (!fullDescription.trim()) return;
    setIsSubmitting(true);

    let result: string | null;

    if (useCustomTiming) {
      result = await createProposalWithTiming(
        fullDescription,
        customDelay[0],
        customPeriod[0],
      );
    } else {
      // Use preset timing if not "Standard" (index 1 = default)
      if (selectedPreset !== 1) {
        const preset = TIMING_PRESETS[selectedPreset];
        result = await createProposalWithTiming(
          fullDescription,
          preset.delay,
          preset.period,
        );
      } else {
        result = await createProposal(fullDescription);
      }
    }

    setIsSubmitting(false);

    if (result) {
      setTitle('');
      setDescription('');
      onClose?.();
    }
  };

  const effectiveDelay = useCustomTiming ? customDelay[0] : TIMING_PRESETS[selectedPreset].delay;
  const effectivePeriod = useCustomTiming ? customPeriod[0] : TIMING_PRESETS[selectedPreset].period;

  return (
    <Card className="border-teal-50 shadow-sm rounded-3xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Send size={14} className="text-orange-500" /> New Proposal
          </h3>
          {params?.isPaused && (
            <Badge className="bg-red-100 text-red-800 text-[9px] font-black uppercase">
              Proposals Paused
            </Badge>
          )}
        </div>

        {params?.isPaused ? (
          <div className="bg-red-50 rounded-xl p-4 border border-red-200/50">
            <p className="text-xs text-red-800 font-medium">
              Proposal creation is currently paused by the protocol administrator (likely during a contract migration).
              Existing proposals continue normally.
            </p>
          </div>
        ) : (
          <>
            {/* Title */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Title</label>
              <Input
                placeholder="Short proposal title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="rounded-xl"
                maxLength={120}
              />
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Description</label>
              <textarea
                placeholder="Describe your proposal in detail. What action should be taken and why?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[100px] p-3 border rounded-xl text-sm resize-y focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>

            {/* Timing presets */}
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Clock size={10} /> Voting Timeline
              </label>
              <div className="grid grid-cols-4 gap-2">
                {TIMING_PRESETS.map((preset, i) => (
                  <button
                    key={preset.label}
                    onClick={() => { setSelectedPreset(i); setUseCustomTiming(false); }}
                    className={`p-2 rounded-xl border text-center transition-all ${
                      !useCustomTiming && selectedPreset === i
                        ? 'border-teal-400 bg-teal-50 ring-1 ring-teal-200'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <p className="text-[10px] font-black uppercase text-slate-700">{preset.label}</p>
                    <p className="text-[8px] text-muted-foreground">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced timing toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground hover:text-slate-700 transition-colors"
            >
              <Settings2 size={12} />
              Custom timing
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {showAdvanced && (
              <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={useCustomTiming}
                    onChange={(e) => setUseCustomTiming(e.target.checked)}
                    className="rounded"
                  />
                  <label className="text-xs text-slate-700 font-medium">Use custom block values</label>
                </div>

                {useCustomTiming && (
                  <>
                    {/* Custom delay slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-black uppercase text-slate-500">Voting Delay</span>
                        <span className="text-teal-700 font-bold">
                          {customDelay[0].toLocaleString()} blocks · {blocksToHumanTime(customDelay[0])}
                        </span>
                      </div>
                      <Slider
                        value={customDelay}
                        onValueChange={setCustomDelay}
                        min={params?.minVotingDelay || 1800}
                        max={params?.maxVotingDelay || 302400}
                        step={1800}
                      />
                      <div className="flex justify-between text-[8px] text-muted-foreground">
                        <span>Min: {blocksToHumanTime(params?.minVotingDelay || 1800)}</span>
                        <span>Max: {blocksToHumanTime(params?.maxVotingDelay || 302400)}</span>
                      </div>
                    </div>

                    {/* Custom period slider */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px]">
                        <span className="font-black uppercase text-slate-500">Voting Period</span>
                        <span className="text-teal-700 font-bold">
                          {customPeriod[0].toLocaleString()} blocks · {blocksToHumanTime(customPeriod[0])}
                        </span>
                      </div>
                      <Slider
                        value={customPeriod}
                        onValueChange={setCustomPeriod}
                        min={params?.minVotingPeriod || 43200}
                        max={params?.maxVotingPeriod || 1296000}
                        step={43200}
                      />
                      <div className="flex justify-between text-[8px] text-muted-foreground">
                        <span>Min: {blocksToHumanTime(params?.minVotingPeriod || 43200)}</span>
                        <span>Max: {blocksToHumanTime(params?.maxVotingPeriod || 1296000)}</span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Summary */}
            <div className="bg-teal-50/50 rounded-xl p-3 border border-teal-100/50 flex items-center justify-between text-[10px]">
              <span className="text-teal-700">
                <Clock size={10} className="inline mr-1" />
                Delay: {blocksToHumanTime(effectiveDelay)} · Vote: {blocksToHumanTime(effectivePeriod)}
              </span>
              <span className="text-teal-600/60 font-mono">
                + 48hr timelock after pass
              </span>
            </div>

            {/* Submit */}
            <div className="flex gap-2">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !title.trim()}
                className="bg-[hsl(178,42%,32%)] hover:bg-[hsl(178,42%,25%)] text-white font-black uppercase text-[10px] px-6 rounded-full h-10 flex-1 shadow-lg shadow-teal-900/10"
              >
                {isSubmitting ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                ) : (
                  <><Send size={14} /> Submit Proposal</>
                )}
              </Button>
              {onClose && (
                <Button variant="outline" onClick={onClose} className="rounded-full h-10 text-[10px] font-black uppercase">
                  Cancel
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default CreateProposal;
