import { useState, useRef, useEffect } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  pointerWithin,
  rectIntersection,
  CollisionDetection,
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
  const [items, setItems] = useState(opportunities);
  const originalStageRef = useRef<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Sincronizar quando opportunities externas mudam (mas NÃO durante arrasto)
  useEffect(() => {
    if (!activeId) {
      setItems(opportunities);
    }
  }, [opportunities, activeId]);

  // Custom collision detection que prioriza droppables (colunas) sobre items
  const customCollisionDetection: CollisionDetection = (args) => {
    // Primeiro, tenta detectar colisão com pointer dentro de droppables
    const pointerCollisions = pointerWithin(args);
    
    // Se encontrou colisões, retorna elas (prioriza colunas)
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    
    // Fallback para rectIntersection
    return rectIntersection(args);
  };

  // Mouse (desktop) ativa após mover 8px; Touch (mobile) ativa após segurar 250ms
  // com tolerância de 8px para não conflitar com scroll vertical.
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
  );

  // Helper: encontrar qual stage contém um item
  const findContainer = (id: string): string | null => {
    // Se o ID é diretamente um stage
    if (pipeline.stages.find(s => s.id === id)) {
      return id;
    }
    // Procura qual stage contém essa oportunidade
    const opp = items.find(o => o.id === id);
    return opp?.stage_id || null;
  };

  const handleDragStart = (event: DragStartEvent) => {
    const opp = items.find(o => o.id === event.active.id);
    originalStageRef.current = opp?.stage_id || null;
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeIdStr = active.id as string;
    const overId = over.id as string;

    const activeContainer = findContainer(activeIdStr);
    const overContainer = findContainer(overId);

    console.log('[DragOver]', { activeIdStr, overId, activeContainer, overContainer });

    if (!activeContainer || !overContainer || activeContainer === overContainer) {
      return;
    }

    console.log('[DragOver] Moving to new container:', overContainer);

    // Mover item visualmente para o novo container
    setItems(prev =>
      prev.map(opp =>
        opp.id === activeIdStr ? { ...opp, stage_id: overContainer } : opp
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;
    const activeId = active.id as string;
    const currentContainer = findContainer(activeId);
    const originalStage = originalStageRef.current;

    // Se mudou de stage, persistir na API
    if (currentContainer && originalStage && currentContainer !== originalStage) {
      onMoveOpportunity(activeId, currentContainer);
    } else if (originalStage && currentContainer !== originalStage) {
      // Rollback visual se não moveu
      setItems(prev =>
        prev.map(opp =>
          opp.id === activeId ? { ...opp, stage_id: originalStage } : opp
        )
      );
    }

    setActiveId(null);
    originalStageRef.current = null;
  };

  const handleDragCancel = () => {
    // Rollback para estado original
    if (activeId && originalStageRef.current) {
      setItems(prev =>
        prev.map(opp =>
          opp.id === activeId ? { ...opp, stage_id: originalStageRef.current! } : opp
        )
      );
    }
    setActiveId(null);
    originalStageRef.current = null;
  };

  const getOpportunitiesByStage = (stageId: string) => {
    return items.filter((opp) => opp.stage_id === stageId);
  };

  const activeOpportunity = activeId
    ? items.find((opp) => opp.id === activeId)
    : null;

  const totalValue = items.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);

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
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="relative h-full">
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
              href={`/app/opportunities/${activeOpportunity.id}`}
              onClick={() => {}}
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
