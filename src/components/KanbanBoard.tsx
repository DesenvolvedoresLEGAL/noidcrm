import { useState, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { OpportunityCard } from './OpportunityCard';
import { Pipeline } from '@/services/crm/types';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface KanbanBoardProps {
  pipeline: Pipeline;
  opportunities: any[];
  onMoveOpportunity: (oppId: string, newStageId: string) => void;
  onOpportunityClick: (oppId: string) => void;
}

export function KanbanBoard({
  pipeline,
  opportunities,
  onMoveOpportunity,
  onOpportunityClick,
}: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localOpportunities, setLocalOpportunities] = useState(opportunities);
  const [originalStageId, setOriginalStageId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Sincronizar opportunities externas com estado local
  if (opportunities !== localOpportunities && !activeId) {
    setLocalOpportunities(opportunities);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Helper: encontrar qual stage contém um item (opportunity ou stage id)
  const findContainer = (id: string): string | null => {
    // Se o ID é diretamente um stage, retorna ele
    if (pipeline.stages.find(s => s.id === id)) {
      return id;
    }
    
    // Senão, procura qual stage contém essa oportunidade
    const opp = localOpportunities.find(o => o.id === id);
    if (opp) {
      return opp.stage_id;
    }
    
    return null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const activeOpp = localOpportunities.find(o => o.id === event.active.id);
    if (activeOpp) {
      setOriginalStageId(activeOpp.stage_id);
    }
    setActiveId(event.active.id as string);
  };

  // Handler crítico: detecta mudança de container DURANTE o arrasto
  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    // Encontra os containers (stages) de origem e destino
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);
    
    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }
    
    // Container mudou! Atualizar estado local para feedback visual imediato
    setLocalOpportunities(prev => 
      prev.map(opp => 
        opp.id === activeId ? { ...opp, stage_id: overContainer } : opp
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    
    // Encontra o container atual (após possíveis mudanças no onDragOver)
    const currentContainer = findContainer(activeId);
    
    // Se mudou de stage, persiste na API
    if (currentContainer && originalStageId && currentContainer !== originalStageId) {
      onMoveOpportunity(activeId, currentContainer);
    }
    
    setActiveId(null);
    setOriginalStageId(null);
  };

  const getOpportunitiesByStage = (stageId: string) => {
    return localOpportunities.filter((opp) => opp.stage_id === stageId);
  };

  const activeOpportunity = activeId
    ? localOpportunities.find((opp) => opp.id === activeId)
    : null;

  const totalValue = localOpportunities.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);

  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -240, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 240, behavior: 'smooth' });
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="relative h-full">
        {/* Scroll Navigation - Left */}
        {canScrollLeft && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute left-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-background/90 hover:bg-background"
            onClick={scrollLeft}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}

        {/* Scroll Navigation - Right */}
        {canScrollRight && pipeline.stages.length > 5 && (
          <Button
            variant="secondary"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 z-20 h-10 w-10 rounded-full shadow-lg bg-background/90 hover:bg-background"
            onClick={scrollRight}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        )}

        {/* Kanban Columns */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex h-full overflow-x-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        >
          {pipeline.stages.map((stage, index) => {
            const stageOpportunities = getOpportunitiesByStage(stage.id);
            return (
              <KanbanColumn
                key={stage.id}
                stage={stage}
                opportunities={stageOpportunities}
                onOpportunityClick={onOpportunityClick}
                isFirst={index === 0}
                isLast={index === pipeline.stages.length - 1}
                pipelineTotalValue={totalValue}
              />
            );
          })}
        </div>
      </div>

      <DragOverlay>
        {activeOpportunity ? (
          <div className="w-[200px]">
            <OpportunityCard
              opportunity={activeOpportunity}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
