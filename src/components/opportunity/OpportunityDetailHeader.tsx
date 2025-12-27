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

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Linha 1: Navegação e Info */}
      <div className="flex items-center gap-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/app/opportunities?pipeline=${opportunity.pipeline_id}`)}
          className="gap-2 shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Pipeline</span>
        </Button>

        {/* Pipeline Name */}
        <span className="text-base font-semibold text-foreground shrink-0">
          {opportunity.pipeline?.name}
        </span>

        {/* Vibe State Badge */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={cn("gap-1.5 shrink-0 cursor-default", vibeConfig.color)}>
                <VibeIcon className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">{vibeConfig.label}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              <p className="font-medium">Estado: {vibeConfig.label}</p>
              <p className="text-xs text-muted-foreground">{vibeConfig.description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Linha 2: Pipeline Stages - Design Premium com Chevrons */}
      <TooltipProvider>
        <div className="flex w-full overflow-x-auto pb-2 pt-1">
          <div className="flex w-full min-w-max">
            {stages.map((stage, index) => {
              const isCompleted = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isFirst = index === 0;
              const isLast = index === stages.length - 1;
              
              // Clip-path para formato chevron
              const getClipPath = () => {
                if (isFirst) {
                  return 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%)';
                }
                if (isLast) {
                  return 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 16px 50%)';
                }
                return 'polygon(0 0, calc(100% - 16px) 0, 100% 50%, calc(100% - 16px) 100%, 0 100%, 16px 50%)';
              };
              
              return (
                <Tooltip key={stage.id}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        // Base
                        "relative flex items-center justify-center flex-1 min-w-[120px] h-12 px-5",
                        "text-[13px] font-semibold tracking-wide",
                        "transition-all duration-200 ease-out cursor-default",
                        // Overlap para chevron
                        !isFirst && "-ml-3",
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
                          "ring-2 ring-primary/40 ring-offset-1 ring-offset-background",
                          "z-20"
                        ],
                        !isCompleted && !isCurrent && [
                          "bg-muted/70 text-muted-foreground",
                          "backdrop-blur-sm"
                        ],
                        // Hover premium
                        "hover:scale-[1.02] hover:shadow-lg hover:z-30"
                      )}
                      style={{ clipPath: getClipPath() }}
                    >
                      {/* Badge ATUAL para etapa corrente */}
                      {isCurrent && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 text-[9px] bg-background text-primary rounded-full font-bold shadow-md border border-primary/20 uppercase tracking-wider">
                          Atual
                        </span>
                      )}
                      
                      {/* Ícone de check para concluídas */}
                      {isCompleted && (
                        <Check className="h-4 w-4 mr-1.5 shrink-0 drop-shadow-sm" />
                      )}
                      
                      {/* Nome da etapa */}
                      <span className="truncate text-center leading-tight drop-shadow-sm">
                        {stage.name}
                      </span>
                      
                      {/* Glow effect sutil na etapa atual */}
                      {isCurrent && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 animate-pulse pointer-events-none" style={{ clipPath: getClipPath() }} />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px] backdrop-blur-sm">
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
    </div>
  );
}
