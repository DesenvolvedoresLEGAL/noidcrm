import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Check } from 'lucide-react';
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

export function OpportunityDetailHeader({
  opportunity,
}: OpportunityDetailHeaderProps) {
  const navigate = useNavigate();

  const stages = opportunity.stages || [];
  const currentStageIndex = stages.findIndex(s => s.id === opportunity.stage_id);

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

      {/* Compact Progress Bar */}
      <TooltipProvider>
        <div className="flex items-center gap-1 flex-1 max-w-xl">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            
            return (
              <Tooltip key={stage.id}>
                <TooltipTrigger asChild>
                  <div className="flex items-center gap-1 flex-1">
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
