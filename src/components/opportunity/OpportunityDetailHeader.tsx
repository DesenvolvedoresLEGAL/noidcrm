import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Check, Sparkles, HelpCircle, Search, Scale, Target, Lock, Volume2, ShieldQuestion } from 'lucide-react';
import { OpportunityDetails } from '@/hooks/useOpportunityDetails';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OpportunityDetailHeaderProps {
  opportunity: OpportunityDetails;
}

// Configuração dos estados de vibe
const VIBE_STATES = {
  neutral: { label: 'Neutro', icon: HelpCircle, color: 'bg-muted text-muted-foreground', description: 'Sem informação suficiente' },
  curious: { label: 'Curioso', icon: Sparkles, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', description: 'Demonstra interesse, faz perguntas' },
  exploratory: { label: 'Exploratório', icon: Search, color: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400', description: 'Quer entender mais, está aberto' },
  skeptical: { label: 'Cético', icon: ShieldQuestion, color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', description: 'Dúvidas, precisa de provas' },
  comparative: { label: 'Comparativo', icon: Scale, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400', description: 'Avaliando opções' },
  deciding: { label: 'Em Decisão', icon: Target, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', description: 'Perto do fechamento' },
  blocked: { label: 'Travado', icon: Lock, color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400', description: 'Bloqueio emocional' },
  hot_silent: { label: 'Quente Silencioso', icon: Volume2, color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', description: 'Alto interesse, pouca comunicação' },
  ready_insecure: { label: 'Pronto Inseguro', icon: ShieldQuestion, color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', description: 'Quer fechar mas tem medo' },
};

export function OpportunityDetailHeader({
  opportunity,
}: OpportunityDetailHeaderProps) {
  const navigate = useNavigate();

  const stages = opportunity.stages || [];
  const currentStageIndex = stages.findIndex(s => s.id === opportunity.stage_id);

  // Obter configuração do vibe state
  const vibeState = (opportunity as any).vibe_state || 'neutral';
  const vibeConfig = VIBE_STATES[vibeState as keyof typeof VIBE_STATES] || VIBE_STATES.neutral;
  const VibeIcon = vibeConfig.icon;

  // Clip-path para formato chevron
  const getClipPath = (isFirst: boolean, isLast: boolean) => {
    if (isFirst) {
      return 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%)';
    }
    if (isLast) {
      return 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 14px 50%)';
    }
    return 'polygon(0 0, calc(100% - 14px) 0, 100% 50%, calc(100% - 14px) 100%, 0 100%, 14px 50%)';
  };

  return (
    <div className="flex items-center gap-3 w-full min-h-[48px]">
      {/* Botão Voltar compacto */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => navigate(`/app/opportunities?pipeline=${opportunity.pipeline_id}`)}
        className="h-8 w-8 shrink-0"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      {/* Nome do Pipeline */}
      <span className="text-sm font-semibold text-foreground shrink-0 hidden md:inline">
        {opportunity.pipeline?.name}
      </span>

      {/* Separador vertical */}
      <div className="h-6 w-px bg-border shrink-0 hidden md:block" />

      {/* Pipeline Stages - Chevrons Premium */}
      <TooltipProvider>
        <div className="flex flex-1 overflow-x-auto scrollbar-hide">
          <div className="flex w-full min-w-max">
            {stages.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isFirst = index === 0;
              const isLast = index === stages.length - 1;
              
              return (
                <Tooltip key={stage.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        // Base
                        "relative flex items-center justify-center flex-1 min-w-[100px] h-10 px-4",
                        "text-[12px] font-semibold tracking-wide",
                        "transition-all duration-200 ease-out cursor-default select-none",
                        // Overlap para chevron
                        !isFirst && "-ml-2",
                        // Estados com gradientes
                        isCompleted && [
                          "bg-gradient-to-r from-primary via-primary/95 to-primary/85",
                          "text-primary-foreground",
                          "shadow-sm"
                        ],
                        isCurrent && [
                          "bg-gradient-to-r from-primary via-primary to-primary/90",
                          "text-primary-foreground",
                          "shadow-lg shadow-primary/25",
                          "z-20"
                        ],
                        !isCompleted && !isCurrent && [
                          "bg-muted/70 text-muted-foreground",
                          "backdrop-blur-sm"
                        ],
                        // Hover premium
                        "hover:scale-[1.02] hover:shadow-md hover:z-30"
                      )}
                      style={{ clipPath: getClipPath(isFirst, isLast) }}
                    >
                      {/* Ícone de check para concluídas */}
                      {isCompleted && (
                        <Check className="h-3.5 w-3.5 mr-1 shrink-0" />
                      )}
                      
                      {/* Indicador visual para etapa atual (interno) */}
                      {isCurrent && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-foreground/80 mr-1.5 shrink-0 animate-pulse" />
                      )}
                      
                      {/* Nome da etapa */}
                      <span className="truncate text-center leading-tight">
                        {stage.name}
                      </span>
                      
                      {/* Glow effect sutil na etapa atual */}
                      {isCurrent && (
                        <div 
                          className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse pointer-events-none" 
                          style={{ clipPath: getClipPath(isFirst, isLast) }} 
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold">{stage.name}</p>
                    {isCompleted && (
                      <p className="text-xs text-emerald-500 font-medium">✓ Concluída</p>
                    )}
                    {isCurrent && (
                      <p className="text-xs text-primary font-medium">● Etapa atual</p>
                    )}
                    {!isCompleted && !isCurrent && (
                      <p className="text-xs text-muted-foreground">Pendente</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </TooltipProvider>

      {/* Separador vertical */}
      <div className="h-6 w-px bg-border shrink-0 hidden md:block" />

      {/* Vibe State Badge - ao final */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1.5 shrink-0 cursor-default", vibeConfig.color)}>
              <VibeIcon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium hidden sm:inline">{vibeConfig.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Estado: {vibeConfig.label}</p>
            <p className="text-xs text-muted-foreground">{vibeConfig.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
