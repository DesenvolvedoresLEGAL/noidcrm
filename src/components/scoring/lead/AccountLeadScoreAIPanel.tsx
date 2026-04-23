import { Brain, Sparkles, RefreshCw, TrendingUp, AlertTriangle, CheckCircle2, Target, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useLeadScoreAI, useGenerateLeadScoreAI } from '@/hooks/useLeadScoreAI';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AccountLeadScoreAIPanelProps {
  accountId: string;
}

export function AccountLeadScoreAIPanel({ accountId }: AccountLeadScoreAIPanelProps) {
  const { data: analysis, isLoading } = useLeadScoreAI(accountId);
  const generate = useGenerateLeadScoreAI();

  const handleGenerate = (forceRefresh = false) => {
    generate.mutate({ accountId, forceRefresh });
  };

  const isGenerating = generate.isPending;

  return (
    <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 via-transparent to-purple-500/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Brain className="h-4 w-4 text-blue-500" />
            </div>
            Análise IA
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 text-[10px]">
              <Sparkles className="h-2.5 w-2.5 mr-1" />
              GPT-5-mini
            </Badge>
          </CardTitle>
          {analysis && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleGenerate(true)}
              disabled={isGenerating}
              className="h-7 px-2"
            >
              <RefreshCw className={isGenerating ? 'h-3 w-3 animate-spin' : 'h-3 w-3'} />
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : !analysis ? (
          <div className="text-center py-6 space-y-3">
            <Brain className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium">Nenhuma análise gerada ainda</p>
              <p className="text-xs text-muted-foreground mt-1">
                Gere uma análise inteligente baseada em todo o contexto da conta
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => handleGenerate(false)}
              disabled={isGenerating}
              className="bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90"
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Sparkles className="h-3 w-3 mr-2" />
                  Analisar com IA
                </>
              )}
            </Button>
          </div>
        ) : (
          <>
            {/* AI Score + Probability */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-background/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Score IA
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">{analysis.ai_score}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                  <Badge variant="outline" className="ml-auto text-[10px] h-5">
                    {analysis.ai_grade}
                  </Badge>
                </div>
              </div>
              <div className="rounded-lg border bg-background/50 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  Prob. Conversão
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold">
                    {analysis.conversion_probability != null
                      ? Math.round(analysis.conversion_probability * 100)
                      : '—'}
                  </span>
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                {analysis.conversion_probability != null && (
                  <Progress value={analysis.conversion_probability * 100} className="h-1 mt-1.5" />
                )}
              </div>
            </div>

            {/* Justifications */}
            {(analysis.fit_justification || analysis.intent_justification) && (
              <div className="space-y-2">
                {analysis.fit_justification && (
                  <div className="rounded-md bg-background/50 border p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-blue-600 mb-1">
                      <Target className="h-3 w-3" />
                      FIT
                    </div>
                    <p className="text-xs leading-relaxed">{analysis.fit_justification}</p>
                  </div>
                )}
                {analysis.intent_justification && (
                  <div className="rounded-md bg-background/50 border p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-amber-600 mb-1">
                      <TrendingUp className="h-3 w-3" />
                      INTENT
                    </div>
                    <p className="text-xs leading-relaxed">{analysis.intent_justification}</p>
                  </div>
                )}
              </div>
            )}

            {/* Signals */}
            {(analysis.positive_signals?.length || analysis.risk_signals?.length) ? (
              <div className="grid grid-cols-1 gap-2">
                {analysis.positive_signals?.length > 0 && (
                  <div className="rounded-md border border-green-500/20 bg-green-500/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-green-600 mb-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Sinais Positivos
                    </div>
                    <ul className="space-y-1">
                      {analysis.positive_signals.slice(0, 5).map((s, i) => (
                        <li key={i} className="text-xs flex gap-1.5">
                          <span className="text-green-600">+</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {analysis.risk_signals?.length > 0 && (
                  <div className="rounded-md border border-red-500/20 bg-red-500/5 p-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-red-600 mb-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Sinais de Risco
                    </div>
                    <ul className="space-y-1">
                      {analysis.risk_signals.slice(0, 5).map((s, i) => (
                        <li key={i} className="text-xs flex gap-1.5">
                          <span className="text-red-600">!</span>
                          <span>{s}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ) : null}

            {/* Next Best Action */}
            {analysis.next_best_action && (
              <div className="rounded-md border border-purple-500/20 bg-purple-500/5 p-2.5">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-purple-600 mb-1">
                  <Sparkles className="h-3 w-3" />
                  Próxima Ação Recomendada
                </div>
                <p className="text-xs leading-relaxed">{analysis.next_best_action}</p>
                {analysis.recommended_owner_role && (
                  <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                    <User className="h-2.5 w-2.5" />
                    Responsável sugerido: <span className="font-medium">{analysis.recommended_owner_role}</span>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t">
              <span>
                Gerada {formatDistanceToNow(new Date(analysis.created_at), { addSuffix: true, locale: ptBR })}
              </span>
              <span className="opacity-60">{analysis.model_used}</span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
