import { Stage } from '@/services/crm/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pencil, Check, X } from 'lucide-react';

interface StageCardProps {
  stage: Stage;
  onEdit: (stage: Stage) => void;
}

export function StageCard({ stage, onEdit }: StageCardProps) {
  return (
    <Card 
      className="p-3 mb-2 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={() => onEdit(stage)}
      style={{ borderLeftColor: stage.color || 'hsl(var(--primary))', borderLeftWidth: '4px' }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm mb-1 truncate">{stage.name}</h4>
          {stage.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {stage.description}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {stage.probability !== undefined && (
              <span className="flex items-center gap-1">
                <span className="font-medium">{stage.probability}%</span>
              </span>
            )}
            {stage.stagnation_alert_days !== undefined && stage.stagnation_alert_days > 0 && (
              <span>Alerta: {stage.stagnation_alert_days}d</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            {stage.allow_create_opportunity && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-primary mr-1" />
                Criar
              </span>
            )}
            {stage.allow_win_opportunity && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <Check className="w-3 h-3 text-success mr-1" />
                Ganhar
              </span>
            )}
            {stage.allow_lose_opportunity && (
              <span className="inline-flex items-center text-xs text-muted-foreground">
                <X className="w-3 h-3 text-destructive mr-1" />
                Perder
              </span>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 shrink-0"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(stage);
          }}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}
