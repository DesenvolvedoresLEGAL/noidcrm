import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { OpportunityCard } from './OpportunityCard';
import { StageColumnHeader } from './pipeline/StageColumnHeader';
import { Stage } from '@/services/crm/types';
import { cn } from '@/lib/utils';

interface KanbanColumnProps {
  stage: Stage;
  opportunities: any[];
  onOpportunityClick: (oppId: string) => void;
  isFirst?: boolean;
  isLast?: boolean;
  pipelineTotalValue: number;
}

export function KanbanColumn({
  stage,
  opportunities,
  onOpportunityClick,
  isFirst,
  isLast,
  pipelineTotalValue,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: stage.id,
  });

  const stageValue = opportunities.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);

  return (
    <div
      className={cn(
        "flex-shrink-0 w-[220px] flex flex-col border-r last:border-r-0 bg-card transition-all duration-300",
        isOver && "bg-primary/5 ring-2 ring-primary/30 ring-inset"
      )}
    >
      {/* Integrated Stage Header */}
      <StageColumnHeader
        stage={stage}
        opportunityCount={opportunities.length}
        totalValue={stageValue}
        pipelineTotalValue={pipelineTotalValue}
      />

      {/* Drop zone with cards */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex-1 p-2 overflow-y-auto",
          isFirst && "pl-3",
          isLast && "pr-3"
        )}
      >
        <SortableContext
          id={stage.id}
          items={opportunities.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {opportunities.length === 0 ? (
            <div className={cn(
              "flex items-center justify-center h-20 text-xs text-muted-foreground border-2 border-dashed rounded-lg transition-all duration-300",
              isOver ? "bg-primary/10 border-primary/50 scale-[1.02]" : "bg-muted/30"
            )}>
              Arraste aqui
            </div>
          ) : (
            <div className="space-y-2">
              {opportunities.map((opp) => (
                <OpportunityCard
                  key={opp.id}
                  opportunity={opp}
                  onClick={() => onOpportunityClick(opp.id)}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}
