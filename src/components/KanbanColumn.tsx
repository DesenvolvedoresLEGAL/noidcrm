import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Card } from '@/components/ui/card';
import { OpportunityCard } from './OpportunityCard';
import { Stage } from '@/services/crm/types';

interface KanbanColumnProps {
  stage: Stage;
  opportunities: any[];
  onOpportunityClick: (oppId: string) => void;
  totalValue: number;
  count: number;
}

export function KanbanColumn({
  stage,
  opportunities,
  onOpportunityClick,
  totalValue,
  count,
}: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({
    id: stage.id,
  });

  return (
    <div className="flex-shrink-0 w-80 animate-fade-in">
      <Card className="bg-muted/30 border-2 transition-all duration-300 hover:border-primary/50">
        {/* Cabeçalho da coluna */}
        <div className="p-4 border-b bg-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-sm text-foreground">{stage.name}</h3>
            <Badge variant="secondary" className="text-xs">
              {count}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground space-y-1">
            <div className="flex justify-between">
              <span>P&S:</span>
              <span className="font-semibold">
                {new Intl.NumberFormat('pt-BR', {
                  style: 'currency',
                  currency: 'BRL',
                  minimumFractionDigits: 0,
                }).format(totalValue)}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Percentual:</span>
              <span className="font-semibold">
                {count > 0 ? ((count / opportunities.length) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>

        {/* Lista de oportunidades */}
        <div
          ref={setNodeRef}
          className="p-3 min-h-[500px] max-h-[calc(100vh-300px)] overflow-y-auto"
        >
          <SortableContext
            items={opportunities.map((o) => o.id)}
            strategy={verticalListSortingStrategy}
          >
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onClick={() => onOpportunityClick(opp.id)}
              />
            ))}
          </SortableContext>
        </div>
      </Card>
    </div>
  );
}

// Import Badge that was missing
import { Badge } from '@/components/ui/badge';
