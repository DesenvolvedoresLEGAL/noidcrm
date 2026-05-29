import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Brain, RefreshCw, Phone, Mail, Calendar, Percent, Clock,
  AlertTriangle, CheckCircle, Info, TrendingUp, TrendingDown,
  Eye, DollarSign, Share2, FileText, Zap, Plus, Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import { createActivity } from '@/services/supabase/activities';
import { useProposalAIInsights } from '@/hooks/useProposalAIInsights';

interface AIProposalInsightCardProps {
  proposalId: string;
  autoLoad?: boolean; // kept for API compatibility (no-op: hook auto-loads from cache)
  opportunityId?: string;
  showRecommendedActions?: boolean;
}

export function AIProposalInsightCard({ proposalId, opportunityId, showRecommendedActions = true }: AIProposalInsightCardProps) {
  const { data, isLoading, isRefreshing, isFromCache, generatedAt, status, error, refresh } =
    useProposalAIInsights(proposalId);

  const [creatingActivity, setCreatingActivity] = useState<number | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const actionTypeMap: Record<string, string> = {
    call: 'call', email: 'email', meeting: 'meeting',
    discount: 'follow_up', follow_up: 'follow_up',
  };

  const handleCreateActivity = async (action: any, idx: number) => {
    if (!opportunityId) {
      toast.error('Oportunidade não vinculada');
      return;
    }
    setCreatingActivity(idx);
    try {
      await createActivity({
        title: (action.message || action.title || 'Ação recomendada').slice(0, 100),
        type: (actionTypeMap[action.type] || 'task') as any,
        description: `[AI Insight] ${action.message || action.description || ''}\n\nPrioridade: ${action.priority || 'medium'}`,
        opportunity_id: opportunityId,
        status: 'pending',
        scheduled_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      toast.success('Atividade criada com sucesso');
    } catch (e) {
      toast.error('Erro ao criar atividade');
    } finally {
      setCreatingActivity(null);
    }
  };

  const handleRefreshClick = () => {
    if (isFromCache && status === 'ok') {
      setConfirmOpen(true);
    } else {
      refresh({ force: true });
    }
  };

  const getEngagementColor = (level?: string) => ({
    very_high: 'bg-green-500', high: 'bg-emerald-500',
    medium: 'bg-yellow-500', low: 'bg-red-500',
  } as any)[level || ''] || 'bg-muted';

  const getEngagementLabel = (level?: string) => ({
    very_high: 'Muito Alto', high: 'Alto', medium: 'Médio', low: 'Baixo',
  } as any)[level || ''] || level || '—';

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <Zap className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getActionIcon = (type: string) => {
    switch (type) {
      case 'call': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'meeting': return <Calendar className="h-4 w-4" />;
      case 'discount': return <Percent className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => ({
    high: 'border-red-500 bg-red-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
  } as any)[priority] || 'border-muted bg-muted/10';

  // ---- Loading
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Carregando análise...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  // ---- Insufficient data
  if (status === 'insufficient_data') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Ainda não há visualizações suficientes para gerar uma análise confiável.
            Envie a proposta ou aguarde novas interações do cliente.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ---- Error without cache
  if ((error || status === 'error') && !data) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Não foi possível gerar os insights agora. Tente novamente mais tarde.
          </p>
          <Button variant="outline" size="sm" onClick={() => refresh({ force: true })}>
            <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const insights = (data as any).smart_alerts || data.insights || [];
  const recommendedActions = data.recommended_actions || [];
  const engagementLabel = (data as any).engagement?.label;
  const engagementLevel = data.engagement?.level || data.engagement_level;
  const closeProbValue = data.close_probability?.value ?? data.win_probability_delta ?? 0;
  const closeProbTrend = (data.close_probability?.trend as string) || 'neutral';
  const scoreExplanation = (data as any).score_explanation as string | undefined;
  const isStale = data.status === 'stale';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefreshClick}
            disabled={isRefreshing}
            title="Atualizar análise"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRefreshing && (
          <div className="text-xs text-muted-foreground italic">
            Novas interações detectadas. Atualizando análise inteligente...
          </div>
        )}

        {isStale && (
          <div className="p-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 text-xs text-yellow-700 dark:text-yellow-300">
            Não foi possível atualizar os insights agora. Mantivemos a última análise disponível.
          </div>
        )}

        {/* Summary */}
        {data.summary && (
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-sm font-medium">{data.summary}</p>
          </div>
        )}

        {/* Engagement & Probability */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg">
            <span className="text-xs text-muted-foreground">Engajamento</span>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${getEngagementColor(engagementLevel)}`} />
              <span className="font-medium text-sm">{engagementLabel || getEngagementLabel(engagementLevel)}</span>
            </div>
          </div>
          <div className="p-3 border rounded-lg">
            <span className="text-xs text-muted-foreground">Prob. de Fechamento</span>
            <div className="flex items-center gap-1 mt-1">
              {closeProbTrend === 'up' ? <TrendingUp className="h-4 w-4 text-green-500" /> :
                closeProbTrend === 'down' ? <TrendingDown className="h-4 w-4 text-red-500" /> : null}
              <span className={`font-medium text-sm ${closeProbTrend === 'up' ? 'text-green-600' : closeProbTrend === 'down' ? 'text-red-600' : ''}`}>
                {closeProbValue}%
              </span>
            </div>
          </div>
        </div>

        {scoreExplanation && (
          <p className="text-xs text-muted-foreground italic px-1">{scoreExplanation}</p>
        )}

        {/* Best Contact Time */}
        {data.best_contact_time && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">{data.best_contact_time}</span>
            </div>
          </div>
        )}

        {/* Insights */}
        {insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Insights</h4>
            <div className="space-y-2">
              {insights.map((insight: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border ${
                  insight.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                  insight.severity === 'warning' ? 'border-yellow-500/50 bg-yellow-500/5' :
                  insight.severity === 'success' ? 'border-green-500/50 bg-green-500/5' :
                  'border-blue-500/50 bg-blue-500/5'
                }`}>
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">{getSeverityIcon(insight.severity)}</div>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-sm">{insight.title}</span>
                      <p className="text-xs text-muted-foreground mt-1">{insight.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {recommendedActions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ações Recomendadas</h4>
            <div className="space-y-2">
              {recommendedActions.map((action: any, idx: number) => (
                <div key={idx} className={`p-3 rounded-lg border-l-4 ${getPriorityColor(action.priority)}`}>
                  <div className="flex items-center gap-2">
                    {getActionIcon(action.type)}
                    <span className="text-sm flex-1">{action.message || action.title}</span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                  {opportunityId && (
                    <div className="mt-2 flex justify-end">
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                        disabled={creatingActivity === idx}
                        onClick={() => handleCreateActivity(action, idx)}>
                        {creatingActivity === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
                        Criar Atividade
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer timestamp */}
        {generatedAt && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Insights atualizados em {new Date(generatedAt).toLocaleString('pt-BR')}
            {isFromCache && !isStale && ' • cache'}
          </p>
        )}
      </CardContent>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar nova análise?</AlertDialogTitle>
            <AlertDialogDescription>
              Nenhuma nova interação foi detectada. Deseja gerar uma nova análise mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmOpen(false); refresh({ force: true }); }}>
              Gerar análise
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
