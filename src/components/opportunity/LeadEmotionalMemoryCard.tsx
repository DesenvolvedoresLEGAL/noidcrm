import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Brain,
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  AlertTriangle,
  Clock,
  Target,
  Zap,
  Heart,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { useLeadEmotionalMemory, useUpdateEmotionalMemory } from '@/hooks/useLeadEmotionalMemory';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LeadEmotionalMemoryCardProps {
  opportunityId: string;
}

const TONE_LABELS: Record<string, { label: string; icon: typeof MessageSquare }> = {
  direto: { label: 'Direto', icon: Target },
  tecnico: { label: 'Técnico', icon: Brain },
  provocativo: { label: 'Provocativo', icon: Zap },
  humano: { label: 'Humano', icon: Heart },
  acolhedor: { label: 'Acolhedor', icon: Shield },
  formal: { label: 'Formal', icon: MessageSquare },
};

const RHYTHM_LABELS: Record<string, string> = {
  rapido: 'Responde rápido',
  reflexivo: 'Precisa de tempo para pensar',
  lento: 'Ritmo lento de resposta',
};

const OBJECTION_LABELS: Record<string, string> = {
  preco: 'Preço',
  tempo: 'Tempo',
  autoridade: 'Autoridade',
  necessidade: 'Necessidade',
  concorrencia: 'Concorrência',
  confianca: 'Confiança',
};

const RISK_CONFIG: Record<string, { color: string; label: string }> = {
  low: { color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Baixo' },
  medium: { color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Médio' },
  high: { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', label: 'Alto' },
  critical: { color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', label: 'Crítico' },
};

export function LeadEmotionalMemoryCard({ opportunityId }: LeadEmotionalMemoryCardProps) {
  const { toast } = useToast();
  const { data: memory, isLoading, error } = useLeadEmotionalMemory(opportunityId);
  const updateMemory = useUpdateEmotionalMemory();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      await updateMemory.mutateAsync({ opportunityId, forceAnalysis: true });
      toast({ title: 'Memória emocional atualizada' });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Erro ao analisar com IA',
        description: e instanceof Error ? e.message : 'Tente novamente em instantes.',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Memória do Lead
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-8 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4" />
            Memória do Lead
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Erro ao carregar memória emocional</p>
        </CardContent>
      </Card>
    );
  }

  const hasMemory = !!memory;
  const riskConfig = memory?.risk_of_vibe_break ? RISK_CONFIG[memory.risk_of_vibe_break] : null;
  const toneConfig = memory?.ideal_tone ? TONE_LABELS[memory.ideal_tone] : null;
  const ToneIcon = toneConfig?.icon || MessageSquare;

  return (
    <Card className={cn(
      "transition-all",
      memory?.risk_of_vibe_break === 'critical' && "ring-2 ring-red-500/50",
      memory?.risk_of_vibe_break === 'high' && "ring-2 ring-orange-500/50"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-primary" />
            Memória do Lead
          </CardTitle>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleAnalyze}
                  disabled={isAnalyzing}
                >
                  <RefreshCw className={cn("h-4 w-4", isAnalyzing && "animate-spin")} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Reanalisar com IA</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Alerta de Risco */}
        {riskConfig && memory?.risk_of_vibe_break !== 'low' && (
          <div className={cn(
            "flex items-start gap-2 p-3 rounded-lg",
            riskConfig.color
          )}>
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                Risco de quebra de vibe: {riskConfig.label}
              </p>
              {memory?.vibe_break_reason && (
                <p className="text-xs opacity-80">{memory.vibe_break_reason}</p>
              )}
            </div>
          </div>
        )}

        {/* Última Interação */}
        {memory?.last_interaction_summary && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Última Interação
            </p>
            <p className="text-sm">{memory.last_interaction_summary}</p>
            {memory.last_emotional_state && (
              <p className="text-xs text-muted-foreground">
                Estado: {memory.last_emotional_state}
              </p>
            )}
          </div>
        )}

        {/* Tom Ideal e Ritmo */}
        {(toneConfig || memory?.response_rhythm) && (
          <div className="flex flex-wrap gap-2">
            {toneConfig && (
              <Badge variant="outline" className="gap-1">
                <ToneIcon className="h-3 w-3" />
                Tom: {toneConfig.label}
              </Badge>
            )}
            {memory?.response_rhythm && (
              <Badge variant="outline" className="gap-1">
                <Clock className="h-3 w-3" />
                {RHYTHM_LABELS[memory.response_rhythm] || memory.response_rhythm}
              </Badge>
            )}
          </div>
        )}

        {/* Gatilhos */}
        {(memory?.positive_triggers?.length > 0 || memory?.negative_triggers?.length > 0) && (
          <div className="space-y-2">
            {memory?.positive_triggers?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
                  <ThumbsUp className="h-3 w-3" />
                  Gatilhos que funcionam
                </p>
                <div className="flex flex-wrap gap-1">
                  {memory.positive_triggers.slice(0, 5).map((trigger, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            {memory?.negative_triggers?.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-red-600 dark:text-red-400 flex items-center gap-1">
                  <ThumbsDown className="h-3 w-3" />
                  Gatilhos que travam
                </p>
                <div className="flex flex-wrap gap-1">
                  {memory.negative_triggers.slice(0, 5).map((trigger, i) => (
                    <Badge key={i} variant="secondary" className="text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {trigger}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Sinais de Compra */}
        {memory?.buying_signals?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-primary flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              Sinais de Compra
            </p>
            <div className="flex flex-wrap gap-1">
              {memory.buying_signals.slice(0, 4).map((signal, i) => (
                <Badge key={i} variant="outline" className="text-xs">
                  {signal}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Objeção Dominante */}
        {memory?.dominant_objection_type && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Objeção dominante:</span>
            <Badge variant="outline" className="text-xs">
              {OBJECTION_LABELS[memory.dominant_objection_type] || memory.dominant_objection_type}
            </Badge>
          </div>
        )}

        {/* Sem dados */}
        {!hasMemory && (
          <div className="text-center py-4">
            <Brain className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhuma memória emocional registrada
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={handleAnalyze}
              disabled={isAnalyzing}
            >
              {isAnalyzing ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Analisando...
                </>
              ) : (
                <>
                  <Brain className="h-4 w-4 mr-2" />
                  Analisar com IA
                </>
              )}
            </Button>
          </div>
        )}

        {/* Metadata */}
        {memory?.last_ai_analysis_at && (
          <p className="text-[10px] text-muted-foreground pt-2 border-t">
            Última análise: {formatDistanceToNow(new Date(memory.last_ai_analysis_at), { addSuffix: true, locale: ptBR })}
            {memory.ai_confidence && ` • Confiança: ${Math.round(memory.ai_confidence * 100)}%`}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
