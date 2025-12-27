// NRHS Breakdown Component - Detailed pillar view

import { CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { NRHS_ISSUES } from '@/services/crm/nrhs-issues';
import { NRHSBreakdown as NRHSBreakdownType } from '@/services/crm/nrhs-calculator';
import { useState } from 'react';

interface NRHSBreakdownProps {
  breakdown: NRHSBreakdownType;
  onFixIssue?: (issueId: string) => void;
}

const PILLAR_LABELS: Record<string, { label: string; weight: string }> = {
  integrity: { label: 'Integridade do Deal', weight: '30%' },
  cadence: { label: 'Cadência e Próximo Passo', weight: '25%' },
  stakeholders: { label: 'Mapeamento de Stakeholders', weight: '20%' },
  winloss: { label: 'Qualidade Win/Loss', weight: '15%' },
  adherence: { label: 'Aderência Operacional', weight: '10%' }
};

const PASSED_LABELS: Record<string, string> = {
  value_present: 'Valor informado',
  close_date_present: 'Data de fechamento definida',
  close_date_fresh: 'Data atualizada',
  value_coherent: 'Valor coerente com estágio',
  has_next_step: 'Próximo passo agendado',
  next_step_within_sla: 'Dentro do SLA',
  next_step_has_purpose: 'Atividade com propósito',
  multiple_contacts: 'Múltiplos contatos',
  has_decisor: 'Decisor identificado',
  has_champion: 'Champion identificado',
  not_lost: 'Oportunidade ativa',
  has_lost_reason: 'Motivo de perda registrado',
  lost_reason_specific: 'Motivo específico',
  lost_reason_detailed: 'Detalhamento completo',
  has_weekly_review: 'Revisão semanal recente',
  stage_coherent: 'Estágio coerente'
};

function getScoreColor(score: number) {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-blue-500';
  if (score >= 40) return 'bg-yellow-500';
  return 'bg-red-500';
}

interface PillarSectionProps {
  pillarKey: string;
  pillar: { score: number; issues: string[]; passed: string[] };
  onFixIssue?: (issueId: string) => void;
}

function PillarSection({ pillarKey, pillar, onFixIssue }: PillarSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const config = PILLAR_LABELS[pillarKey];
  const hasIssues = pillar.issues.length > 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <div className="flex items-center justify-between p-2 rounded hover:bg-muted/50 cursor-pointer">
          <div className="flex items-center gap-2 flex-1">
            <div className={cn(
              "h-2 w-2 rounded-full",
              hasIssues ? 'bg-yellow-500' : 'bg-emerald-500'
            )} />
            <span className="text-sm font-medium">{config.label}</span>
            <span className="text-xs text-muted-foreground">({config.weight})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-sm font-bold",
              pillar.score >= 80 && "text-emerald-600",
              pillar.score >= 60 && pillar.score < 80 && "text-blue-600",
              pillar.score >= 40 && pillar.score < 60 && "text-yellow-600",
              pillar.score < 40 && "text-red-600"
            )}>
              {pillar.score}
            </span>
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              isOpen && "rotate-180"
            )} />
          </div>
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-4 pr-2 pb-2 space-y-2">
          {/* Progress Bar */}
          <Progress value={pillar.score} className="h-1.5" />
          
          {/* Passed items */}
          {pillar.passed.length > 0 && (
            <div className="space-y-1">
              {pillar.passed.map(passedId => (
                <div key={passedId} className="flex items-center gap-1.5 text-xs text-emerald-600">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>{PASSED_LABELS[passedId] || passedId}</span>
                </div>
              ))}
            </div>
          )}
          
          {/* Issues */}
          {pillar.issues.length > 0 && (
            <div className="space-y-1">
              {pillar.issues.map(issueId => {
                const issue = NRHS_ISSUES[issueId];
                return (
                  <div 
                    key={issueId} 
                    className="flex items-center justify-between gap-1.5 text-xs"
                  >
                    <div className={cn(
                      "flex items-center gap-1.5",
                      issue?.blocker ? "text-red-600" : "text-yellow-600"
                    )}>
                      <AlertCircle className="h-3 w-3" />
                      <span>{issue?.title || issueId}</span>
                      {issue?.blocker && (
                        <span className="text-[9px] bg-red-100 dark:bg-red-900/30 px-1 rounded">
                          BLOCKER
                        </span>
                      )}
                    </div>
                    {onFixIssue && issue && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => onFixIssue(issueId)}
                      >
                        {issue.cta.label}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function NRHSBreakdown({ breakdown, onFixIssue }: NRHSBreakdownProps) {
  const pillarOrder = ['integrity', 'cadence', 'stakeholders', 'winloss', 'adherence'];

  return (
    <div className="border rounded-lg divide-y">
      {pillarOrder.map(pillarKey => (
        <PillarSection
          key={pillarKey}
          pillarKey={pillarKey}
          pillar={breakdown.pillars[pillarKey as keyof typeof breakdown.pillars]}
          onFixIssue={onFixIssue}
        />
      ))}
    </div>
  );
}
