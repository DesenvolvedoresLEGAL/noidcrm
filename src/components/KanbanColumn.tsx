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
        "flex-shrink-0 w-[220px] flex flex-col border-r last:border-r-0 bg-card transition-colors",
        isOver && "bg-primary/5"
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
          items={opportunities.map((o) => o.id)}
          strategy={verticalListSortingStrategy}
        >
          {opportunities.length === 0 ? (
            <div className="flex items-center justify-center h-20 text-xs text-muted-foreground border-2 border-dashed rounded-lg bg-muted/30">
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
