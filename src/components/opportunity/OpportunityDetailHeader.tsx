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
      <span className="text-sm font-medium text-muted-foreground shrink-0">
        {opportunity.pipeline?.name}
      </span>

      {/* Vibe State Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn("gap-1.5 shrink-0 cursor-default", vibeConfig.color)}>
              <VibeIcon className="h-3 w-3" />
              <span className="text-xs font-medium">{vibeConfig.label}</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p className="font-medium">Estado: {vibeConfig.label}</p>
            <p className="text-xs text-muted-foreground">{vibeConfig.description}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Spacer to push pipeline to the right */}
      <div className="flex-1" />

      {/* Compact Progress Bar - Now full width aligned */}
      <TooltipProvider>
        <div className="flex items-center gap-1 flex-shrink-0 min-w-0 max-w-2xl">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            
            return (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 flex-1 min-w-0">
                    <div
                      className={cn(
                        "flex items-center justify-center",
                        "w-5 h-5 rounded-full text-[10px] font-medium shrink-0 transition-colors cursor-default",
                        isCompleted && "bg-primary text-primary-foreground",
                        isCurrent && "bg-primary/20 text-primary border-2 border-primary",
                        !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                      )}
                    >
                      {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
                    </div>
                    {index < stages.length - 1 && (
                      <div
                        className={cn(
                          "flex-1 h-0.5 rounded-full transition-colors min-w-2",
                          isCompleted ? "bg-primary" : "bg-muted"
                        )}
                      />
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-medium">{stage.name}</p>
                  {isCurrent && <p className="text-xs text-muted-foreground">Estágio atual</p>}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </TooltipProvider>
    </div>
  );
}
