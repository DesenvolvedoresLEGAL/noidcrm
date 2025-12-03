import { useState } from 'react';
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

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex h-full">
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
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeOpportunity ? (
          <div className="w-[260px]">
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
