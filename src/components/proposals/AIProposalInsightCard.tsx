import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Brain, 
  RefreshCw, 
  Phone, 
  Mail, 
  Calendar, 
  Percent, 
  Clock,
  AlertTriangle,
  CheckCircle,
  Info,
  TrendingUp,
  TrendingDown,
  Eye,
  DollarSign,
  Share2,
  FileText,
  Zap
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ProposalInsight {
  type: string;
  title: string;
  description: string;
  severity: 'info' | 'warning' | 'success' | 'critical';
}

interface RecommendedAction {
  type: 'call' | 'email' | 'meeting' | 'discount' | 'follow_up';
  message: string;
  priority: 'low' | 'medium' | 'high';
}

interface BehaviorAnalysis {
  summary: string;
  engagement_level: 'low' | 'medium' | 'high' | 'very_high';
  concerns: string[];
  recommended_actions: RecommendedAction[];
  win_probability_delta: number;
  best_contact_time: string | null;
  insights: ProposalInsight[];
  metrics?: {
    total_views: number;
    total_duration_seconds: number;
    avg_duration_seconds: number;
    max_scroll_depth: number;
    pricing_section_time_percent: number;
    is_currently_viewing: boolean;
    was_forwarded: boolean;
    downloaded_pdf: boolean;
  };
  analyzed_at?: string;
}

interface AIProposalInsightCardProps {
  proposalId: string;
  autoLoad?: boolean;
}

export function AIProposalInsightCard({ proposalId, autoLoad = false }: AIProposalInsightCardProps) {
  const [analysis, setAnalysis] = useState<BehaviorAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);

  // Auto-load analysis on mount if autoLoad is true
  React.useEffect(() => {
    if (autoLoad && proposalId && !hasAutoLoaded && !analysis) {
      setHasAutoLoaded(true);
      analyzeProposal();
    }
  }, [autoLoad, proposalId, hasAutoLoaded, analysis]);

  const analyzeProposal = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-proposal-behavior', {
        body: { proposal_id: proposalId }
      });

      if (error) throw error;
      setAnalysis(data);
      toast.success('Análise de comportamento concluída');
    } catch (error) {
      console.error('Error analyzing proposal:', error);
      toast.error('Erro ao analisar comportamento');
    } finally {
      setIsLoading(false);
    }
  };

  const getEngagementColor = (level: string) => {
    switch (level) {
      case 'very_high': return 'bg-green-500';
      case 'high': return 'bg-emerald-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-red-500';
      default: return 'bg-muted';
    }
  };

  const getEngagementLabel = (level: string) => {
    switch (level) {
      case 'very_high': return 'Muito Alto';
      case 'high': return 'Alto';
      case 'medium': return 'Médio';
      case 'low': return 'Baixo';
      default: return level;
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <Zap className="h-4 w-4 text-red-500" />;
      case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
      default: return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'pricing_focus': return <DollarSign className="h-4 w-4" />;
      case 'detailed_review': return <FileText className="h-4 w-4" />;
      case 'hesitation': return <AlertTriangle className="h-4 w-4" />;
      case 'comparison': return <Eye className="h-4 w-4" />;
      case 'urgency': return <Zap className="h-4 w-4" />;
      case 'inactivity': return <Clock className="h-4 w-4" />;
      case 'forwarded': return <Share2 className="h-4 w-4" />;
      case 'high_engagement': return <TrendingUp className="h-4 w-4" />;
      default: return <Info className="h-4 w-4" />;
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-red-500 bg-red-500/10';
      case 'medium': return 'border-yellow-500 bg-yellow-500/10';
      default: return 'border-muted bg-muted/10';
    }
  };

  if (!analysis && !isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            AI Insights de Comportamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Analise o comportamento do cliente ao visualizar esta proposta e receba insights acionáveis.
          </p>
          <Button onClick={analyzeProposal} className="w-full">
            <Brain className="h-4 w-4 mr-2" />
            Analisar Comportamento
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary animate-pulse" />
            Analisando...
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-5 w-5 text-primary" />
            AI Insights
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={analyzeProposal} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm font-medium">{analysis?.summary}</p>
        </div>

        {/* Engagement & Probability */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 border rounded-lg">
            <span className="text-xs text-muted-foreground">Engajamento</span>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-3 h-3 rounded-full ${getEngagementColor(analysis?.engagement_level || 'low')}`} />
              <span className="font-medium text-sm">
                {getEngagementLabel(analysis?.engagement_level || 'low')}
              </span>
            </div>
          </div>
          <div className="p-3 border rounded-lg">
            <span className="text-xs text-muted-foreground">Prob. de Fechamento</span>
            <div className="flex items-center gap-1 mt-1">
              {(analysis?.win_probability_delta || 0) > 0 ? (
                <TrendingUp className="h-4 w-4 text-green-500" />
              ) : (analysis?.win_probability_delta || 0) < 0 ? (
                <TrendingDown className="h-4 w-4 text-red-500" />
              ) : null}
              <span className={`font-medium text-sm ${
                (analysis?.win_probability_delta || 0) > 0 ? 'text-green-600' : 
                (analysis?.win_probability_delta || 0) < 0 ? 'text-red-600' : ''
              }`}>
                {(analysis?.win_probability_delta || 0) > 0 ? '+' : ''}
                {analysis?.win_probability_delta || 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Best Contact Time */}
        {analysis?.best_contact_time && (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-700">
                {analysis.best_contact_time}
              </span>
            </div>
          </div>
        )}

        {/* Insights */}
        {analysis?.insights && analysis.insights.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Insights</h4>
            <div className="space-y-2">
              {analysis.insights.map((insight, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border ${
                    insight.severity === 'critical' ? 'border-red-500/50 bg-red-500/5' :
                    insight.severity === 'warning' ? 'border-yellow-500/50 bg-yellow-500/5' :
                    insight.severity === 'success' ? 'border-green-500/50 bg-green-500/5' :
                    'border-blue-500/50 bg-blue-500/5'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      {getSeverityIcon(insight.severity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getInsightIcon(insight.type)}
                        <span className="font-medium text-sm">{insight.title}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Actions */}
        {analysis?.recommended_actions && analysis.recommended_actions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Ações Recomendadas</h4>
            <div className="space-y-2">
              {analysis.recommended_actions.map((action, idx) => (
                <div 
                  key={idx}
                  className={`p-3 rounded-lg border-l-4 ${getPriorityColor(action.priority)}`}
                >
                  <div className="flex items-center gap-2">
                    {getActionIcon(action.type)}
                    <span className="text-sm">{action.message}</span>
                    <Badge variant="outline" className="ml-auto text-xs">
                      {action.priority === 'high' ? 'Alta' : action.priority === 'medium' ? 'Média' : 'Baixa'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Metrics */}
        {analysis?.metrics && (
          <div className="pt-3 border-t">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-lg font-bold">{analysis.metrics.total_views}</div>
                <div className="text-xs text-muted-foreground">Visualizações</div>
              </div>
              <div>
                <div className="text-lg font-bold">
                  {Math.round(analysis.metrics.total_duration_seconds / 60)}min
                </div>
                <div className="text-xs text-muted-foreground">Tempo Total</div>
              </div>
              <div>
                <div className="text-lg font-bold">{analysis.metrics.max_scroll_depth}%</div>
                <div className="text-xs text-muted-foreground">Scroll Máx.</div>
              </div>
            </div>
          </div>
        )}

        {/* Analysis timestamp */}
        {analysis?.analyzed_at && (
          <p className="text-xs text-muted-foreground text-center pt-2">
            Analisado em {new Date(analysis.analyzed_at).toLocaleString('pt-BR')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
