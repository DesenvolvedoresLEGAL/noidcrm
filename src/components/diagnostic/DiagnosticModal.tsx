import { AnimatePresence } from "framer-motion";
import { X, ArrowLeft, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DiagnosticProgress } from "./DiagnosticProgress";
import { DiagnosticQuestion } from "./DiagnosticQuestion";
import { DiagnosticResult } from "./DiagnosticResult";
import { useDiagnostic } from "@/hooks/useDiagnostic";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef } from "react";
import { toast } from "sonner";

interface DiagnosticModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadData?: {
    nome: string;
    empresa: string;
    whatsapp: string;
    email: string;
  };
  opportunityId?: string | null;
}

export function DiagnosticModal({ open, onOpenChange, leadData, opportunityId }: DiagnosticModalProps) {
  const {
    currentStep,
    totalSteps,
    currentQuestion,
    isCompleted,
    result,
    selectAnswer,
    getCurrentAnswer,
    goToNext,
    goToPrevious,
    reset,
  } = useDiagnostic();

  const currentAnswer = getCurrentAnswer();
  const canProceed = currentAnswer !== undefined;
  const savedRef = useRef(false);
  
  // Store leadData and opportunityId in refs to ensure they persist
  const leadDataRef = useRef(leadData);
  const opportunityIdRef = useRef(opportunityId);
  
  // Update refs when props change
  useEffect(() => {
    if (leadData) {
      leadDataRef.current = leadData;
      console.log("[DiagnosticModal] LeadData updated:", { ...leadData, email: leadData.email?.substring(0, 5) + "***" });
    }
  }, [leadData]);
  
  useEffect(() => {
    if (opportunityId) {
      opportunityIdRef.current = opportunityId;
      console.log("[DiagnosticModal] OpportunityId updated:", opportunityId);
    }
  }, [opportunityId]);

  // Save diagnostic results when completed
  useEffect(() => {
    const saveDiagnostic = async () => {
      const currentLeadData = leadDataRef.current;
      const currentOpportunityId = opportunityIdRef.current;
      
      if (!isCompleted || !result || savedRef.current) {
        return;
      }
      
      if (!currentLeadData) {
        console.error("[DiagnosticModal] Cannot save diagnostic: leadData is missing");
        toast.error("Erro ao salvar diagnóstico: dados do formulário não encontrados");
        return;
      }
      
      console.log("[DiagnosticModal] Saving diagnostic...", {
        leadEmail: currentLeadData.email?.substring(0, 5) + "***",
        opportunityId: currentOpportunityId,
        totalScore: result.totalScore,
        classification: result.classification,
        answersCount: result.answers?.length,
      });
      
      savedRef.current = true;
      
      const areaScores = {
        pipeline: result.scores.pipeline,
        followup: result.scores.followup,
        prioritization: result.scores.prioritization,
        crm: result.scores.crm,
        forecast: result.scores.forecast,
        lossAnalysis: result.scores.lossAnalysis,
        automation: result.scores.automation,
      };

      try {
        const { data, error } = await supabase.functions.invoke("save-diagnostic", {
          body: {
            leadData: currentLeadData,
            opportunityId: currentOpportunityId,
            answers: result.answers,
            areaScores,
            totalScore: result.totalScore,
            classification: result.classification,
          },
        });

        if (error) {
          console.error("[DiagnosticModal] Error saving diagnostic:", error);
          toast.error("Erro ao salvar diagnóstico. Por favor, tente novamente.");
          savedRef.current = false; // Allow retry
        } else {
          console.log("[DiagnosticModal] Diagnostic saved successfully:", data);
          toast.success("Diagnóstico salvo com sucesso!");
        }
      } catch (err) {
        console.error("[DiagnosticModal] Exception saving diagnostic:", err);
        toast.error("Erro ao salvar diagnóstico. Por favor, tente novamente.");
        savedRef.current = false; // Allow retry
      }
    };

    saveDiagnostic();
  }, [isCompleted, result]);

  const handleClose = () => {
    savedRef.current = false;
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background border-border">
        <VisuallyHidden>
          <DialogTitle>Diagnóstico de Operação de Receita</DialogTitle>
        </VisuallyHidden>
        
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {isCompleted ? "Seu Resultado" : "Diagnóstico de Operação"}
            </h2>
            <button
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          
          {!isCompleted && (
            <DiagnosticProgress 
              currentStep={currentStep} 
              totalSteps={totalSteps} 
            />
          )}
        </div>

        {/* Content */}
        <div className="p-4 md:p-6">
          <AnimatePresence mode="wait">
            {isCompleted && result ? (
              <DiagnosticResult 
                key="result"
                result={result} 
                onClose={handleClose} 
              />
            ) : currentQuestion ? (
              <DiagnosticQuestion
                key={currentQuestion.id}
                question={currentQuestion}
                selectedOption={currentAnswer?.selectedOption ?? null}
                onSelect={selectAnswer}
              />
            ) : null}
          </AnimatePresence>
        </div>

        {/* Footer Navigation */}
        {!isCompleted && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur-sm border-t border-border p-4 md:p-6">
            <div className="flex gap-3">
              {currentStep > 0 && (
                <Button
                  variant="outline"
                  onClick={goToPrevious}
                  className="flex-1"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Anterior
                </Button>
              )}
              <Button
                onClick={goToNext}
                disabled={!canProceed}
                className="flex-1"
              >
                {currentStep === totalSteps - 1 ? "Ver Resultado" : "Próxima"}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
