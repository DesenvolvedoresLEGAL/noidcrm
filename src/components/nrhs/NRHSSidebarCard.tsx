// NRHS Sidebar Card - Detailed card for opportunity sidebar

import { useState } from 'react';
import { Shield, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { InfoCard } from '@/components/opportunity/InfoCard';
import { useNRHS } from '@/hooks/useNRHS';
import { getNRHSTierConfig } from '@/services/crm/nrhs-calculator';
import { NRHS_ISSUES } from '@/services/crm/nrhs-issues';
import { NRHSBreakdown } from './NRHSBreakdown';
import { FixHygieneWizardModal } from './FixHygieneWizardModal';
import { Skeleton } from '@/components/ui/skeleton';

interface NRHSSidebarCardProps {
  opportunityId: string;
  organizationId: string;
  onFixField?: (field: string, value: any) => Promise<void>;
}

export function NRHSSidebarCard({ 
  opportunityId, 
  organizationId,
  onFixField 
}: NRHSSidebarCardProps) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  
  const {
    score,
    tier,
    tierConfig,
    breakdown,
    issuesCount,
    blockers,
    blockersDetailed,
    gaps,
    isLoading,
    recalculate,
    isRecalculating,
    markReview,
    isMarkingReview
  } = useNRHS(opportunityId, organizationId);

  if (isLoading) {
    return (
      <InfoCard title="Revenue Hygiene" icon={<Shield className="h-3.5 w-3.5" />} collapsible defaultOpen>
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
        </div>
      </InfoCard>
    );
  }

  const hasIssues = issuesCount > 0;
  const hasBlockers = (blockersDetailed?.length ?? 0) > 0;
  const topIssues = [...(blockersDetailed || []), ...(gaps || [])].slice(0, 2);

  return (
    <>
      <InfoCard 
        title="Revenue Hygiene (NRHS)" 
        icon={<Shield className="h-3.5 w-3.5" />} 
        collapsible 
        defaultOpen
        action={
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5"
            onClick={() => recalculate()}
            disabled={isRecalculating}
            title="Recalcular NRHS"
          >
            <RefreshCw className={cn("h-3 w-3", isRecalculating && "animate-spin")} />
          </Button>
        }
      >
        <div className="space-y-3">
          {/* Score Badge */}
          {score !== null && tier && tierConfig && (
            <div className={cn(
              "flex items-center justify-between p-3 rounded-lg",
              tierConfig.bgColor,
              "border",
              tierConfig.borderColor
            )}>
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center justify-center h-10 w-10 rounded-full",
                  "bg-background/80 font-bold text-lg",
                  tierConfig.color
                )}>
                  {score}
                </div>
                <div>
                  <p className={cn("font-semibold", tierConfig.color)}>
                    {tierConfig.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {issuesCount} lacuna{issuesCount !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              {hasBlockers && (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
            </div>
          )}

          {/* No score yet */}
          {score === null && (
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <p className="text-sm text-muted-foreground">
                Score não calculado
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={() => recalculate()}
                disabled={isRecalculating}
              >
                {isRecalculating ? 'Calculando...' : 'Calcular agora'}
              </Button>
            </div>
          )}

          {/* Top Issues (blockers + gaps) */}
          {hasIssues && topIssues.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {topIssues.map((issue: any, idx: number) => {
                const sev = issue?.severity ?? 'low';
                return (
                  <Badge
                    key={(issue?.code ?? 'issue') + idx}
                    variant="outline"
                    className={cn(
                      "text-[10px]",
                      sev === 'critical' && "border-red-500/50 text-red-600",
                      sev === 'high' && "border-red-500/50 text-red-600",
                      sev === 'medium' && "border-yellow-500/50 text-yellow-600",
                      sev === 'low' && "border-muted-foreground/50",
                    )}
                  >
                    {issue?.label ?? issue?.code ?? 'Issue'}
                  </Badge>
                );
              })}
              {issuesCount > 2 && (
                <Badge variant="secondary" className="text-[10px]">
                  +{issuesCount - 2}
                </Badge>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2">
            {hasIssues && (
              <Button
                variant="default"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setShowWizard(true)}
              >
                Corrigir agora
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1"
              onClick={() => setShowBreakdown(!showBreakdown)}
            >
              {showBreakdown ? (
                <>
                  <ChevronUp className="h-3 w-3" />
                  Ocultar
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" />
                  Ver breakdown
                </>
              )}
            </Button>
          </div>

          {/* Breakdown */}
          {showBreakdown && breakdown && (
            <NRHSBreakdown 
              breakdown={breakdown} 
              onFixIssue={(issueId) => {
                setShowWizard(true);
              }}
            />
          )}

          {/* Quick Review Button */}
          {!hasBlockers && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => markReview(undefined)}
              disabled={isMarkingReview}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              {isMarkingReview ? 'Marcando...' : 'Marcar revisão semanal'}
            </Button>
          )}
        </div>
      </InfoCard>

      {/* Fix Wizard Modal */}
      <FixHygieneWizardModal
        open={showWizard}
        onOpenChange={setShowWizard}
        opportunityId={opportunityId}
        organizationId={organizationId}
        issues={breakdown?.required_actions || []}
        onFixField={onFixField}
        onComplete={() => {
          recalculate();
          setShowWizard(false);
        }}
      />
    </>
  );
}
