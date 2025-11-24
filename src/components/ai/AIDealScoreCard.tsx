import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Loader2 } from 'lucide-react';
import { scoreDeal, type DealScore } from '@/services/crm/ai-sales';
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
        title: 'Erro ao analisar deal',
        description: 'Não foi possível gerar o score. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-600';
    if (score >= 40) return 'text-yellow-600';
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

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle>AI Deal Score</CardTitle>
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
            <p>Clique em "Analisar" para ver o score de IA</p>
          </div>
        ) : (
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
                Risco: {score.risk_level === 'low' ? 'Baixo' : score.risk_level === 'medium' ? 'Médio' : 'Alto'}
              </Badge>
            </div>

            {/* Key Insights */}
            <div className="p-4 bg-primary/5 rounded-lg">
              <p className="text-sm">{score.key_insights}</p>
            </div>

            {/* Fatores positivos */}
            {score.factors.positive.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <h4 className="font-semibold text-sm">Fatores Positivos</h4>
                </div>
                <ul className="space-y-1">
                  {score.factors.positive.map((factor, i) => (
                    <li key={i} className="text-sm text-green-700 flex items-start gap-2">
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
                  <h4 className="font-semibold text-sm">Fatores de Risco</h4>
                </div>
                <ul className="space-y-1">
                  {score.factors.negative.map((factor, i) => (
                    <li key={i} className="text-sm text-red-700 flex items-start gap-2">
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
                  <h4 className="font-semibold text-sm">Recomendações</h4>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
