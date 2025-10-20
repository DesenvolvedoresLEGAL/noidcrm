import { Pipeline } from '@/services/crm/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Copy, Trash2, Pencil } from 'lucide-react';
import { StageCard } from './StageCard';
import type { Stage } from '@/services/crm/types';

interface PipelineCardProps {
  pipeline: Pipeline;
  onEditPipeline: (pipeline: Pipeline) => void;
  onDeletePipeline: (pipeline: Pipeline) => void;
  onDuplicatePipeline: (pipeline: Pipeline) => void;
  onAddStage: (pipeline: Pipeline) => void;
  onEditStage: (pipeline: Pipeline, stage: Stage) => void;
}

export function PipelineCard({
  pipeline,
  onEditPipeline,
  onDeletePipeline,
  onDuplicatePipeline,
  onAddStage,
  onEditStage,
}: PipelineCardProps) {
  return (
    <Card className="w-[320px] shrink-0 shadow-card">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-base mb-1 truncate">{pipeline.name}</CardTitle>
            <div className="flex flex-wrap gap-1 mb-1">
              {pipeline.bu.map((bu) => (
                <Badge key={bu} variant="secondary" className="text-xs">
                  {bu}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {pipeline.stages.length} {pipeline.stages.length === 1 ? 'etapa' : 'etapas'}
            </p>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEditPipeline(pipeline)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onDuplicatePipeline(pipeline)}
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-destructive hover:text-destructive"
              onClick={() => onDeletePipeline(pipeline)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {pipeline.stages
          .sort((a, b) => a.position - b.position)
          .map((stage) => (
            <StageCard
              key={stage.id}
              stage={stage}
              onEdit={(stage) => onEditStage(pipeline, stage)}
            />
          ))}
        
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => onAddStage(pipeline)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Nova etapa
        </Button>
      </CardContent>
    </Card>
  );
}
