import { AlertTriangle, Users, UserCheck, TrendingDown, Clock, ChevronRight, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntityInsights, useOpportunityNetworkSummary } from '@/hooks/useKnowledgeGraph';
import { useCreateActivityFromInsight } from '@/hooks/useCreateActivityFromInsight';
import { cn } from '@/lib/utils';

interface DealGapsCardProps {
  opportunityId: string;
  onActionClick?: (actionType: string, insightId: string) => void;
}

const insightIcons: Record<string, typeof AlertTriangle> = {
  missing_champion: UserCheck,
  missing_decision_maker: Users,
  silent_stakeholder: Clock,
  isolated_deal: Users,
  weak_relationship: TrendingDown,
  engagement_decay: TrendingDown,
};

const severityColors: Record<string, string> = {
  critical: 'bg-destructive text-destructive-foreground',
  high: 'bg-orange-500/20 text-orange-700 dark:text-orange-400',
  medium: 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400',
  low: 'bg-muted text-muted-foreground',
};

export function DealGapsCard({ opportunityId, onActionClick }: DealGapsCardProps) {
  const { data: insights, isLoading: insightsLoading } = useEntityInsights('opportunity', opportunityId);
  const { data: networkSummary, isLoading: networkLoading } = useOpportunityNetworkSummary(opportunityId);
  const { createActivityFromInsight } = useCreateActivityFromInsight();

  const isLoading = insightsLoading || networkLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Lacunas do Deal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  const activeInsights = insights?.filter(i => i.status === 'active') || [];

  // Network health indicators
  const networkHealth = networkSummary ? {
    stakeholders: networkSummary.stakeholder_count,
    champion: networkSummary.has_champion,
    decisionMaker: networkSummary.has_decision_maker,
    strength: networkSummary.relationship_strength,
    daysSinceContact: networkSummary.days_since_last_contact,
  } : null;

  // Derive gaps from networkSummary when no explicit insights exist
  const derivedGaps: Array<{ id: string; type: string; title: string; description: string; severity: 'high' | 'medium' | 'low' }> = [];
  
  if (networkHealth) {
    if (networkHealth.stakeholders === 0) {
      derivedGaps.push({
        id: 'derived_no_stakeholders',
        type: 'missing_stakeholder',
        title: 'Nenhum stakeholder mapeado',
        description: 'Adicione contatos relacionados a esta oportunidade',
        severity: 'high'
      });
    }
    if (!networkHealth.champion && networkHealth.stakeholders > 0) {
      derivedGaps.push({
        id: 'derived_no_champion',
        type: 'missing_champion',
        title: 'Champion não identificado',
        description: 'Defina quem defende sua solução internamente',
        severity: 'medium'
      });
    }
    if (!networkHealth.decisionMaker && networkHealth.stakeholders > 0) {
      derivedGaps.push({
        id: 'derived_no_decision_maker',
        type: 'missing_decision_maker',
        title: 'Decisor não identificado',
        description: 'Identifique o tomador de decisão no deal',
        severity: 'medium'
      });
    }
    if (networkHealth.daysSinceContact !== null && networkHealth.daysSinceContact > 14) {
      derivedGaps.push({
        id: 'derived_stale_contact',
        type: 'engagement_decay',
        title: 'Engajamento em queda',
        description: `Sem contato há ${networkHealth.daysSinceContact} dias`,
        severity: networkHealth.daysSinceContact > 30 ? 'high' : 'medium'
      });
    }
    if (networkHealth.strength === 'weak' && networkHealth.stakeholders > 0) {
      derivedGaps.push({
        id: 'derived_weak_network',
        type: 'weak_relationship',
        title: 'Rede de relacionamento fraca',
        description: 'Aumente a frequência de interações',
        severity: 'low'
      });
    }
  }

  const hasGaps = activeInsights.length > 0 || derivedGaps.length > 0;

  return (
    <Card className={cn(
      "transition-colors",
      hasGaps && "border-orange-500/50"
    )}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className={cn(
              "h-4 w-4",
              hasGaps ? "text-orange-500" : "text-green-500"
            )} />
            Lacunas do Deal
          </span>
          {hasGaps && (
            <Badge variant="secondary" className="text-xs">
              {activeInsights.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Network Summary */}
        {networkHealth && (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{networkHealth.stakeholders} stakeholders</span>
            </div>
            <div className="flex items-center gap-1.5">
              <UserCheck className={cn(
                "h-3.5 w-3.5",
                networkHealth.champion ? "text-green-500" : "text-muted-foreground"
              )} />
              <span>{networkHealth.champion ? 'Champion ✓' : 'Sem champion'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge 
                variant="outline" 
                className={cn(
                  "text-[10px] px-1.5 py-0",
                  networkHealth.strength === 'strong' && "border-green-500 text-green-600",
                  networkHealth.strength === 'medium' && "border-yellow-500 text-yellow-600",
                  networkHealth.strength === 'weak' && "border-red-500 text-red-600"
                )}
              >
                {networkHealth.strength === 'strong' ? 'Forte' : networkHealth.strength === 'medium' ? 'Média' : 'Fraca'}
              </Badge>
              <span className="text-muted-foreground">rede</span>
            </div>
            {networkHealth.daysSinceContact !== null && (
              <div className="flex items-center gap-1.5">
                <Clock className={cn(
                  "h-3.5 w-3.5",
                  networkHealth.daysSinceContact > 7 ? "text-orange-500" : "text-muted-foreground"
                )} />
                <span>{networkHealth.daysSinceContact}d sem contato</span>
              </div>
            )}
          </div>
        )}

        {/* Insights/Gaps */}
        {hasGaps ? (
          <div className="space-y-2 pt-2 border-t">
            {/* Show active insights from database */}
            {activeInsights.slice(0, 3).map((insight) => {
              const Icon = insightIcons[insight.insight_type] || AlertTriangle;
              return (
                <div 
                  key={insight.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Icon className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    insight.severity === 'high' && "text-orange-500",
                    insight.severity === 'critical' && "text-destructive",
                    insight.severity === 'medium' && "text-yellow-500"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{insight.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {insight.description}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                    onClick={() => createActivityFromInsight({
                      opportunityId,
                      insight: insight as any,
                    })}
                    title="Criar tarefa a partir deste insight"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
            
            {/* Show derived gaps from network analysis */}
            {derivedGaps.slice(0, Math.max(0, 3 - activeInsights.length)).map((gap) => {
              const Icon = insightIcons[gap.type] || AlertTriangle;
              return (
                <div 
                  key={gap.id}
                  className="flex items-start gap-2 p-2 rounded-md bg-muted/50 hover:bg-muted transition-colors"
                >
                  <Icon className={cn(
                    "h-4 w-4 mt-0.5 flex-shrink-0",
                    gap.severity === 'high' && "text-orange-500",
                    gap.severity === 'medium' && "text-yellow-500",
                    gap.severity === 'low' && "text-muted-foreground"
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{gap.title}</p>
                    <p className="text-[10px] text-muted-foreground line-clamp-2">
                      {gap.description}
                    </p>
                  </div>
                </div>
              );
            })}
            
            {(activeInsights.length + derivedGaps.length) > 3 && (
              <p className="text-[10px] text-muted-foreground text-center">
                +{(activeInsights.length + derivedGaps.length) - 3} mais lacunas
              </p>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 text-green-700 dark:text-green-400">
            <UserCheck className="h-4 w-4" />
            <span className="text-xs">Nenhuma lacuna identificada</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
