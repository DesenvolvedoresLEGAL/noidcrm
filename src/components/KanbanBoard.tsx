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

    console.log('[DragEnd] active:', active.id, 'over:', over?.id);
    console.log('[DragEnd] over.data:', over?.data.current);

    if (!over) {
      console.log('[DragEnd] No over target');
      setActiveId(null);
      return;
    }

    // Get the active opportunity's current stage
    const activeOpportunity = opportunities.find((opp) => opp.id === active.id);
    if (!activeOpportunity) {
      console.log('[DragEnd] Active opportunity not found');
      setActiveId(null);
      return;
    }

    // Try multiple methods to determine the target stage
    let targetStageId: string | null = null;

    // Method 1: over.id is directly a stage ID (dropping on empty column)
    if (pipeline.stages.find((s) => s.id === over.id)) {
      targetStageId = over.id as string;
      console.log('[DragEnd] Method 1 - over.id is stage:', targetStageId);
    }
    
    // Method 2: Get container ID from sortable context data (dropping on another card)
    if (!targetStageId && over.data.current?.sortable?.containerId) {
      const containerId = over.data.current.sortable.containerId;
      if (pipeline.stages.find((s) => s.id === containerId)) {
        targetStageId = containerId;
        console.log('[DragEnd] Method 2 - containerId:', targetStageId);
      }
    }
    
    // Method 3: over.id is an opportunity, get its stage_id from state
    if (!targetStageId) {
      const targetOpportunity = opportunities.find((opp) => opp.id === over.id);
      if (targetOpportunity) {
        targetStageId = targetOpportunity.stage_id;
        console.log('[DragEnd] Method 3 - opportunity stage_id:', targetStageId);
      }
    }

    console.log('[DragEnd] Final targetStageId:', targetStageId);
    console.log('[DragEnd] Current stage:', activeOpportunity.stage_id);

    // Only move if we have a valid target stage and it's different from current
    if (targetStageId && targetStageId !== activeOpportunity.stage_id) {
      console.log('[DragEnd] Moving opportunity to:', targetStageId);
      onMoveOpportunity(active.id as string, targetStageId);
    } else {
      console.log('[DragEnd] No move - same stage or invalid target');
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
