import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CheckCircle2, XCircle, MoreVertical, Pencil, Copy, Snowflake, Trash2 } from 'lucide-react';
import { EditableField } from './EditableField';
import { Pipeline } from '@/services/crm/types';
import { cn } from '@/lib/utils';

interface OpportunityHeaderProps {
  opportunity: any;
  pipeline: Pipeline;
  onWon: () => void;
  onLost: () => void;
  onUpdateTitle: (newTitle: string) => Promise<void>;
  onEditClick: () => void;
}

export function OpportunityHeader({
  opportunity,
  pipeline,
  onWon,
  onLost,
  onUpdateTitle,
  onEditClick,
}: OpportunityHeaderProps) {
  const currentStageIndex = pipeline.stages.findIndex((s) => s.id === opportunity.stage_id);
  const prob = Math.min((opportunity.prob || 0) * 100, 100);

  const getTemperatureColor = (temp: string) => {
    const temperature = temp?.toLowerCase() || opportunity.temperature?.toLowerCase() || 'warm';
    switch (temperature) {
      case 'cold':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
      case 'warm':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
      case 'hot':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
      case 'burning':
        return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Row: Title, Badges, Actions */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <EditableField
            value={opportunity.title || opportunity.account_name || 'Sem título'}
            onSave={onUpdateTitle}
            type="text"
            className="mb-2"
            displayFormatter={(val) => val}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {prob.toFixed(0)}%
            </Badge>
            {opportunity.produto && (
              <Badge className="bg-primary text-primary-foreground text-xs">
                {opportunity.produto}
              </Badge>
            )}
            {(opportunity.temperatura || opportunity.temperature) && (
              <Badge className={cn('text-xs', getTemperatureColor(opportunity.temperatura || opportunity.temperature))}>
                {(opportunity.temperatura || opportunity.temperature).toUpperCase()}
              </Badge>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            variant="default"
            size="sm"
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={onWon}
          >
            <CheckCircle2 className="h-4 w-4 mr-1" />
            Ganhou
          </Button>
          <Button variant="destructive" size="sm" onClick={onLost}>
            <XCircle className="h-4 w-4 mr-1" />
            Perdeu
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEditClick}>
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Copy className="h-4 w-4 mr-2" />
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Snowflake className="h-4 w-4 mr-2" />
                Congelar
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Mover para lixeira
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Stage Progress Bar */}
      <div className="pt-2">
        <div className="text-xs text-muted-foreground mb-2">
          {pipeline.name} → {pipeline.stages[currentStageIndex]?.name || 'N/A'}
        </div>
        <div className="flex items-center justify-between">
          {pipeline.stages.map((stage, index) => (
            <div key={stage.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                    index <= currentStageIndex
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {index < currentStageIndex ? '✓' : index + 1}
                </div>
                <span className="text-xs mt-1 text-center max-w-[80px] truncate">
                  {stage.name}
                </span>
              </div>
              {index < pipeline.stages.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-1 mx-2 transition-colors',
                    index < currentStageIndex ? 'bg-primary' : 'bg-muted'
                  )}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
