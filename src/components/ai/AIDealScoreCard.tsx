import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Loader2, Heart, Activity, Target } from 'lucide-react';
import { scoreDeal, type DealScore, isOperationalScore } from '@/services/crm/ai-sales';
import { useToast } from '@/hooks/use-toast';

interface AIDealScoreCardProps {
  opportunityId: string;
}

export function AIDealScoreCard({ opportunityId }: AIDealScoreCardProps) {
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState<DealScore | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    try {
      setLoading(true);
      const result = await scoreDeal(opportunityId);
      setScore(result);
    } catch (error) {
      console.error('Error scoring deal:', error);
      toast({
        title: 'Erro ao analisar',
        description: 'Não foi possível gerar a análise. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (value: number) => {
    if (value >= 70) return 'text-green-600';
    if (value >= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getRiskBadge = (risk: string) => {
    const variants = {
      low: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-red-100 text-red-800',
    };
    return variants[risk as keyof typeof variants] || variants.medium;
  };

  const getEngagementBadge = (level: string) => {
    const variants = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };
    return variants[level as keyof typeof variants] || variants.medium;
  };

  const getLevelLabel = (level: string) => {
    return level === 'low' ? 'Baixo' : level === 'medium' ? 'Médio' : 'Alto';
  };

  // Renderização para pipelines operacionais
  const renderOperationalScore = () => {
    if (!score || !isOperationalScore(score)) return null;

    return (
      <div className="space-y-6">
        {/* Health Score principal */}
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Heart className="h-6 w-6 text-emerald-600" />
            <span className="text-sm font-medium text-muted-foreground">Health Score</span>
          </div>
          <div className={`text-6xl font-bold ${getScoreColor(score.health_score)}`}>
            {score.health_score}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Saúde do relacionamento
          </p>
        </div>

        {/* Badges de status */}
        <div className="flex flex-wrap justify-center gap-2">
          <Badge className={getRiskBadge(score.churn_risk)} variant="secondary">
            Churn Risk: {getLevelLabel(score.churn_risk)}
          </Badge>
          <Badge className={getEngagementBadge(score.engagement_level)} variant="secondary">
            Engajamento: {getLevelLabel(score.engagement_level)}
          </Badge>
        </div>

        {/* Progresso do Onboarding */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span>Progresso Onboarding</span>
            </div>
            <span className="font-medium">{score.onboarding_progress}%</span>
          </div>
          <Progress value={score.onboarding_progress} className="h-2" />
        </div>

        {/* Key Insights */}
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg border border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800 dark:text-emerald-200">Análise do Cliente</span>
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">{score.key_insights}</p>
        </div>

        {/* Fatores e Recomendações - reutilizados */}
        {renderFactorsAndRecommendations()}
      </div>
    );
  };

  // Renderização para pipelines de vendas
  const renderSalesScore = () => {
    if (!score || isOperationalScore(score)) return null;

    return (
      <div className="space-y-6">
        {/* Score principal */}
        <div className="text-center">
          <div className={`text-6xl font-bold ${getScoreColor(score.score)}`}>
            {score.score}
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Probabilidade de ganhar
          </p>
          <Badge className={getRiskBadge(score.risk_level)} variant="secondary">
            Risco: {getLevelLabel(score.risk_level)}
          </Badge>
        </div>

        {/* Key Insights */}
        <div className="p-4 bg-primary/5 rounded-lg">
          <p className="text-sm">{score.key_insights}</p>
        </div>

        {/* Fatores e Recomendações - reutilizados */}
        {renderFactorsAndRecommendations()}
      </div>
    );
  };

  // Componente compartilhado para fatores e recomendações
  const renderFactorsAndRecommendations = () => {
    if (!score) return null;

    return (
      <>
        {/* Fatores positivos */}
        {score.factors.positive.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <h4 className="font-semibold text-sm">Fatores Positivos</h4>
            </div>
            <ul className="space-y-1">
              {score.factors.positive.map((factor, i) => (
                <li key={i} className="text-sm text-green-700 dark:text-green-400 flex items-start gap-2">
                  <span className="text-green-600">✓</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fatores negativos */}
        {score.factors.negative.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h4 className="font-semibold text-sm">
                {isOperationalScore(score) ? 'Riscos Identificados' : 'Fatores de Risco'}
              </h4>
            </div>
            <ul className="space-y-1">
              {score.factors.negative.map((factor, i) => (
                <li key={i} className="text-sm text-red-700 dark:text-red-400 flex items-start gap-2">
                  <span className="text-red-600">✗</span>
                  <span>{factor}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recomendações */}
        {score.recommendations.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <h4 className="font-semibold text-sm">
                {isOperationalScore(score) ? 'Próximos Passos' : 'Recomendações'}
              </h4>
            </div>
            <ul className="space-y-1">
              {score.recommendations.map((rec, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className="text-primary">→</span>
                  <span>{rec}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </>
    );
  };

  const isOperational = score && isOperationalScore(score);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isOperational ? (
              <Heart className="h-5 w-5 text-emerald-600" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            <CardTitle>
              {isOperational ? 'AI Customer Health' : 'AI Deal Score'}
            </CardTitle>
          </div>
          <Button onClick={handleAnalyze} disabled={loading} size="sm">
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Analisar
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!score ? (
          <div className="text-center py-8 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Clique em "Analisar" para ver os insights de IA</p>
          </div>
        ) : isOperationalScore(score) ? (
          renderOperationalScore()
        ) : (
          renderSalesScore()
        )}
      </CardContent>
    </Card>
  );
}
