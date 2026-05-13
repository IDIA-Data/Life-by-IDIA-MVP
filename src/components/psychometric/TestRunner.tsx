import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Sparkles, CheckCircle2, BrainCircuit } from "lucide-react";
import { TestModule, REVERSE_SCORED_INDICES } from "./testBank";
import { fireWelcomeConfetti, fireCompletionConfetti } from "./confetti";

type Phase = "welcome" | "questions" | "complete";

interface TestRunnerProps {
  test: TestModule;
  onExit: () => void;
  onComplete: (normalizedScore: number) => void;
}

const TestRunner: React.FC<TestRunnerProps> = ({ test, onExit, onComplete }) => {
  const [phase, setPhase] = useState<Phase>("welcome");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [transitioning, setTransitioning] = useState(false);
  const [finalScore, setFinalScore] = useState(0);

  useEffect(() => {
    if (phase === "welcome") fireWelcomeConfetti();
    if (phase === "complete") fireCompletionConfetti();
  }, [phase]);

  const handleAnswer = (value: number) => {
    if (transitioning) return;
    setTransitioning(true);

    const isReverse = REVERSE_SCORED_INDICES.includes(currentIdx);
    const finalValue = isReverse ? 6 - value : value;
    const newAnswers = [...answers, finalValue];
    setAnswers(newAnswers);

    setTimeout(() => {
      if (currentIdx < test.questions.length - 1) {
        setCurrentIdx((p) => p + 1);
        setTransitioning(false);
      } else {
        const rawTotal = newAnswers.reduce((a, b) => a + b, 0);
        const normalized = Math.round(((rawTotal - 10) / 40) * 100);
        setFinalScore(normalized);
        setPhase("complete");
        setTransitioning(false);
      }
    }, 350);
  };

  // ---------- WELCOME ----------
  if (phase === "welcome") {
    return (
      <div className="space-y-6 py-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-teal-500 to-orange-500 flex items-center justify-center shadow-lg shadow-teal-500/30">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-orange-500 mb-2">{test.pillar}</p>
            <h2 className="text-2xl font-bold">{test.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{test.description}</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500/10 to-orange-500/10 border border-teal-500/20 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BrainCircuit className="w-4 h-4 text-teal-500" />
            What to expect
          </div>
          <ul className="text-xs text-muted-foreground space-y-1 ml-6 list-disc">
            <li>10 quick questions, one at a time</li>
            <li>Answer on a 1–5 scale (Strongly Disagree → Strongly Agree)</li>
            <li>Takes about 90 seconds</li>
            <li>Processed locally in your Secure Enclave</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <Button variant="outline" onClick={onExit} className="flex-1">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <Button
            onClick={() => setPhase("questions")}
            className="flex-1 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-bold shadow-lg shadow-teal-500/30"
          >
            Begin Module
          </Button>
        </div>
      </div>
    );
  }

  // ---------- COMPLETE ----------
  if (phase === "complete") {
    return (
      <div className="space-y-6 py-4 animate-in fade-in zoom-in-95 duration-500">
        <div className="text-center space-y-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-orange-500 to-teal-500 flex items-center justify-center shadow-lg shadow-orange-500/40 animate-in zoom-in-50 duration-700">
            <CheckCircle2 className="w-10 h-10 text-white" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-teal-500 mb-2">Module Complete</p>
            <h2 className="text-2xl font-bold">Thank You</h2>
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Your responses for <span className="font-semibold text-foreground">{test.title}</span> have been
            cryptographically attested.
          </p>
        </div>

        <div className="bg-gradient-to-br from-teal-500/10 to-orange-500/10 border border-orange-500/20 rounded-xl p-6 text-center">
          <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Normalized Score</p>
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl font-bold bg-gradient-to-r from-teal-500 to-orange-500 bg-clip-text text-transparent">
              {finalScore}
            </span>
            <span className="text-lg text-muted-foreground font-medium">/ 100</span>
          </div>
        </div>

        <Button
          onClick={() => onComplete(finalScore)}
          className="w-full h-12 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold shadow-lg shadow-orange-500/30"
        >
          Continue
        </Button>
      </div>
    );
  }

  // ---------- QUESTIONS ----------
  const progress = (currentIdx / test.questions.length) * 100;
  return (
    <div className="space-y-6 py-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onExit} className="text-muted-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Suspend
        </Button>
        <span className="text-xs font-bold uppercase tracking-wider text-orange-500">{test.pillar}</span>
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs font-medium text-muted-foreground">
          <span>{test.title}</span>
          <span>
            {currentIdx + 1} / {test.questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-1.5 [&>div]:bg-gradient-to-r [&>div]:from-teal-500 [&>div]:to-orange-500" />
      </div>

      {/* Question */}
      <div
        key={currentIdx}
        className="space-y-8 py-6 animate-in fade-in slide-in-from-right-4 duration-300"
      >
        <div className="text-center space-y-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            Telemetry Point {currentIdx + 1}
          </p>
          <p className="text-lg md:text-xl font-medium leading-relaxed px-2">
            "{test.questions[currentIdx]}"
          </p>
        </div>

        {/* Likert */}
        <div className="space-y-3">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">
            <span>Strongly Disagree</span>
            <span>Strongly Agree</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((val) => (
              <button
                key={val}
                onClick={() => handleAnswer(val)}
                disabled={transitioning}
                className="flex-1 aspect-square max-w-16 rounded-full border-2 border-border hover:border-teal-500 hover:bg-gradient-to-br hover:from-teal-500/10 hover:to-orange-500/10 hover:text-teal-600 text-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {val}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestRunner;
