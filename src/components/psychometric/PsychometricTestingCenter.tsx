import React, { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, Info, X } from "lucide-react";
import TestRunner from "./TestRunner";
import { TEST_BANK, type TestId } from "./testBank";
import { fireWelcomeConfetti, fireFinaleConfetti } from "./confetti";

interface PsychometricTestingCenterProps {
  onCompleteAll: (scores: Record<string, number>) => void;
  onCancel: () => void;
}

const PsychometricTestingCenter: React.FC<PsychometricTestingCenterProps> = ({ onCompleteAll, onCancel }) => {
  // FIXED: Starts at index 0 which is now the "How to IDIA" Tutorial
  const [currentModuleIndex, setCurrentModuleIndex] = useState(0);
  const [completedModules, setCompletedModules] = useState<Record<string, number>>({});
  const [isFinished, setIsFinished] = useState(false);

  const modules = Object.values(TEST_BANK);
  const totalModules = modules.length;

  useEffect(() => {
    fireWelcomeConfetti();
  }, []);

  const progress = (Object.keys(completedModules).length / totalModules) * 100;

  const startNextModule = () => {
    if (currentModuleIndex < totalModules - 1) {
      setCurrentModuleIndex(currentModuleIndex + 1);
    } else {
      setIsFinished(true);
      fireFinaleConfetti();

      // Filter out the tutorial score before sending to the Edge Function
      const { tut, ...actualTelemetry } = completedModules;
      onCompleteAll(actualTelemetry);
    }
  };

  const handleModuleComplete = (score: number) => {
    const currentModule = modules[currentModuleIndex];
    setCompletedModules((prev) => ({
      ...prev,
      [currentModule.id]: score,
    }));
    startNextModule();
  };

  const handleExit = () => {
    onCancel();
  };

  if (isFinished) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background p-6 text-center space-y-6 sm:min-h-[70vh]">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          <ShieldCheck className="relative z-10 h-20 w-20 text-primary sm:h-24 sm:w-24" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold italic text-foreground">Telemetry Secured.</h2>
          <p className="text-muted-foreground">Executing the IDIA Algorithm in the Secure Enclave...</p>
        </div>
      </div>
    );
  }

  const currentModule = modules[currentModuleIndex];
  const isTutorial = currentModule.id === "tut";

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-background sm:h-[90vh] sm:max-h-[90vh] md:h-auto md:max-h-[90vh]">
      {/* Fixed Sticky Header */}
      <div className="z-20 border-b bg-background/95 px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-4 sm:pb-4 sm:pt-6">
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <span
              className={`text-[10px] font-bold uppercase ${isTutorial ? "text-accent" : "text-primary"}`}
            >
              {isTutorial ? "Training Module" : `Module ${currentModuleIndex} of ${totalModules - 1}`}
            </span>
            <h2 className="line-clamp-2 text-base font-bold leading-tight text-foreground sm:text-lg">{currentModule.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">{Math.round(progress)}%</span>
            <Button variant="ghost" size="icon" onClick={handleExit} aria-label="Cancel psychometric test" className="h-9 w-9">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Progress value={progress} className="h-1.5 bg-muted" />

        {isTutorial && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border bg-muted/50 p-3 sm:mt-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <p className="text-[11px] leading-tight text-muted-foreground">
              <strong>Quick Tip:</strong> Use the buttons below to rate how much you agree with each statement. Be
              honest—the algorithm rewards consistency and truth, not high scores.
            </p>
          </div>
        )}
      </div>

      {/* Responsive Scrollable Content Frame */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-background px-3 py-4 sm:px-4 sm:py-6">
        <div className="mx-auto max-w-xl">
          <Card className="border-none shadow-none bg-transparent">
            <CardContent className="p-0">
              <TestRunner
                key={currentModule.id}
                test={currentModule}
                onComplete={handleModuleComplete}
                onExit={handleExit}
              />
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="h-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-transparent bg-background" />
    </div>
  );
};

export default PsychometricTestingCenter;
