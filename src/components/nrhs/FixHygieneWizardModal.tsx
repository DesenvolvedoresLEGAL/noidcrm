// Fix Hygiene Wizard Modal - Step-by-step issue correction

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle2, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NRHS_ISSUES } from '@/services/crm/nrhs-issues';
import { logWeeklyReview } from '@/services/crm/nrhs-calculator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface FixHygieneWizardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunityId: string;
  organizationId: string;
  issues: Array<{
    id: string;
    title: string;
    severity: 'high' | 'med' | 'low';
    cta: { type: string; target: string; label: string };
  }>;
  onFixField?: (field: string, value: any) => Promise<void>;
  onComplete: () => void;
}

interface WizardStep {
  id: string;
  title: string;
  issueId: string;
  type: 'value' | 'date' | 'review' | 'info';
}

export function FixHygieneWizardModal({
  open,
  onOpenChange,
  opportunityId,
  organizationId,
  issues,
  onFixField,
  onComplete
}: FixHygieneWizardModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [values, setValues] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Build wizard steps from issues
  const steps: WizardStep[] = issues
    .filter(issue => {
      const issueConfig = NRHS_ISSUES[issue.id];
      if (!issueConfig) return false;
      // Only include fixable issues
      return ['edit_field', 'mark_review'].includes(issueConfig.cta.type);
    })
    .map(issue => {
      const issueConfig = NRHS_ISSUES[issue.id];
      let type: WizardStep['type'] = 'info';
      
      if (issue.id === 'missing_value') type = 'value';
      else if (issue.id === 'missing_close_date' || issue.id === 'stale_close_date') type = 'date';
      else if (issue.id === 'no_weekly_review') type = 'review';
      
      return {
        id: issue.id,
        title: issueConfig?.title || issue.title,
        issueId: issue.id,
        type
      };
    });

  const currentStepData = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;
  const progress = steps.length > 0 ? ((currentStep + 1) / steps.length) * 100 : 0;

  const handleNext = async () => {
    if (!currentStepData) return;
    
    setIsSubmitting(true);
    try {
      const value = values[currentStepData.id];
      
      // Handle different step types
      if (currentStepData.type === 'value' && value && onFixField) {
        await onFixField('valor_previsto', parseFloat(value));
        toast.success('Valor atualizado');
      } else if (currentStepData.type === 'date' && value && onFixField) {
        await onFixField('close_date_prevista', value);
        toast.success('Data atualizada');
      } else if (currentStepData.type === 'review') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await logWeeklyReview(opportunityId, user.id, organizationId, 'Revisão via wizard NRHS');
          toast.success('Revisão registrada');
        }
      }
      
      setCompletedSteps(prev => new Set([...prev, currentStepData.id]));
      
      if (isLastStep) {
        onComplete();
      } else {
        setCurrentStep(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error fixing issue:', error);
      toast.error('Erro ao corrigir');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStep(prev => prev + 1);
    }
  };

  if (steps.length === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Higiene OK
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 text-center">
            <p className="text-muted-foreground">
              Não há lacunas que podem ser corrigidas neste wizard.
            </p>
          </div>
          <Button onClick={() => onOpenChange(false)}>Fechar</Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Corrigir Higiene do Deal</DialogTitle>
        </DialogHeader>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Passo {currentStep + 1} de {steps.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        {currentStepData && (
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <h3 className="font-semibold">{currentStepData.title}</h3>
              <p className="text-sm text-muted-foreground">
                {NRHS_ISSUES[currentStepData.issueId]?.description}
              </p>
            </div>

            {/* Value Input */}
            {currentStepData.type === 'value' && (
              <div className="space-y-2">
                <Label htmlFor="value">Valor da Oportunidade (R$)</Label>
                <Input
                  id="value"
                  type="number"
                  placeholder="0,00"
                  value={values[currentStepData.id] || ''}
                  onChange={(e) => setValues(prev => ({
                    ...prev,
                    [currentStepData.id]: e.target.value
                  }))}
                />
              </div>
            )}

            {/* Date Input */}
            {currentStepData.type === 'date' && (
              <div className="space-y-2">
                <Label htmlFor="date">Data Prevista de Fechamento</Label>
                <Input
                  id="date"
                  type="date"
                  value={values[currentStepData.id] || ''}
                  onChange={(e) => setValues(prev => ({
                    ...prev,
                    [currentStepData.id]: e.target.value
                  }))}
                />
              </div>
            )}

            {/* Review Confirmation */}
            {currentStepData.type === 'review' && (
              <div className="p-4 bg-muted/50 rounded-lg text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm">
                  Clique em "Próximo" para registrar a revisão semanal desta oportunidade.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={currentStep === 0 || isSubmitting}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Anterior
          </Button>

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={handleSkip}
              disabled={isSubmitting}
            >
              Pular
            </Button>
            <Button
              onClick={handleNext}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isLastStep ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-1" />
                  Concluir
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="h-4 w-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
