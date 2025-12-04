import { useState, useRef } from 'react';
import {
  DndContext,
  DragEndEvent,
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
import { cn } from '@/lib/utils';

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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const targetStage = pipeline.stages.find((s) => s.id === over.id);
      if (targetStage) {
        onMoveOpportunity(active.id as string, targetStage.id);
      }
    }

    setActiveId(null);
  };

  const getOpportunitiesByStage = (stageId: string) => {
    return opportunities.filter((opp) => opp.stage_id === stageId);
  };

  const activeOpportunity = activeId
    ? opportunities.find((opp) => opp.id === activeId)
    : null;

  const totalValue = opportunities.reduce((sum, opp) => sum + (opp.valor_previsto || 0), 0);

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
