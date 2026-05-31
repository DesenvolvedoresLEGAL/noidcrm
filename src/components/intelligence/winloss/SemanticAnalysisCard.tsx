import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Brain, RefreshCw, MessageSquareQuote, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  useLossSemanticDetail,
  useReprocessLossSemantic,
} from '@/hooks/useLossSemantic';
import { getLossCategoryLabel } from '@/utils/category-labels';

interface Props {
  opportunityId: string;
}

/**
 * Análise semântica completa de uma oportunidade perdida.
 * - Mostra texto integral (escopo autenticado, LGPD respeitado a nível de RLS).
 * - Permite reprocessar via edge function ai-loss-semantic-analyzer.
 */
export function SemanticAnalysisCard({ opportunityId }: Props) {
  const { toast } = useToast();
  const { data, isLoading } = useLossSemanticDetail(opportunityId);
  const reprocess = useReprocessLossSemantic();

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-56" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const quality = data.diagnosis_quality_score ?? 0;
  const qualityLabel =
    quality >= 70 ? 'Forte' : quality >= 40 ? 'Médio' : quality > 0 ? 'Fraco' : 'Sem texto';
  const qualityColor =
    quality >= 70
      ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'
      : quality >= 40
        ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
        : 'border-red-500/30 text-red-600 bg-red-500/10';

  const onReprocess = async () => {
    try {
      await reprocess.mutateAsync(opportunityId);
      toast({ title: 'Análise reprocessada', description: 'A IA reanalisou os textos da oportunidade.' });
    } catch (e: any) {
      toast({
        title: 'Erro ao reprocessar',
        description: e?.message || 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const seller = data.source_texts?.seller_diagnosis || data.seller_diagnosis_excerpt;
  const customer = data.source_texts?.customer_comment || data.customer_comment_excerpt;

  return (
    <Card className="border-purple-500/20 bg-purple-500/5">
      <CardHeader>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-purple-500" />
              Análise Semântica da IA
            </CardTitle>
            <CardDescription>
              {data.model_used || 'IA'} · v{data.rule_version || '1'} ·{' '}
              {data.analyzed_at
                ? new Date(data.analyzed_at).toLocaleString('pt-BR')
                : 'ainda não analisado'}
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={onReprocess}
            disabled={reprocess.isPending}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${reprocess.isPending ? 'animate-spin' : ''}`} />
            Reprocessar
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid sm:grid-cols-3 gap-2">
          <Badge variant="outline" className={`justify-center py-1.5 ${qualityColor}`}>
            Qualidade: {quality}/100 · {qualityLabel}
          </Badge>
          <Badge variant="outline" className="justify-center py-1.5">
            Confiança IA: {data.ai_confidence_score ?? 0}%
          </Badge>
          {data.seller_customer_gap ? (
            <Badge variant="outline" className="justify-center py-1.5 border-amber-500/30 text-amber-600 bg-amber-500/10">
              <AlertTriangle className="h-3 w-3 mr-1" /> Gap vendedor × cliente
            </Badge>
          ) : (
            <Badge variant="outline" className="justify-center py-1.5 border-emerald-500/30 text-emerald-600 bg-emerald-500/10">
              Sem gap detectado
            </Badge>
          )}
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="p-3 rounded-md border bg-background/50">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Categoria detectada (IA)
            </p>
            <p className="text-sm font-semibold">
              {getLossCategoryLabel(data.ai_detected_loss_category)}
            </p>
            {data.ai_detected_loss_reason && (
              <p className="text-xs text-muted-foreground mt-1">{data.ai_detected_loss_reason}</p>
            )}
          </div>
          <div className="p-3 rounded-md border bg-background/50">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Concorrente detectado
            </p>
            <p className="text-sm font-semibold">
              {data.ai_detected_competitor || data.competitor_human || '—'}
            </p>
          </div>
        </div>

        {data.gap_explanation && (
          <div className="p-3 rounded-md border border-amber-500/20 bg-amber-500/5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-amber-700 dark:text-amber-400 mb-1">
              Explicação do gap
            </p>
            <p className="text-sm">{data.gap_explanation}</p>
          </div>
        )}

        {data.recommended_action && (
          <div className="p-3 rounded-md border border-purple-500/20 bg-purple-500/5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-purple-700 dark:text-purple-400 mb-1">
              Ação recomendada
            </p>
            <p className="text-sm font-medium">{data.recommended_action}</p>
          </div>
        )}

        {seller && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
              Diagnóstico do vendedor
            </p>
            <p className="text-sm italic text-muted-foreground border-l-2 border-muted pl-3">
              "{seller}"
            </p>
          </div>
        )}

        {customer && (
          <div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
              <MessageSquareQuote className="h-3 w-3" /> Comentário do cliente
            </p>
            <p className="text-sm italic text-muted-foreground border-l-2 border-muted pl-3">
              "{customer}"
            </p>
          </div>
        )}

        {data.ai_summary_excerpt && (
          <div className="text-xs text-muted-foreground pt-2 border-t">
            <span className="font-medium">Síntese IA:</span> {data.ai_summary_excerpt}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
