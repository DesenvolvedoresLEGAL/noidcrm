import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  ArrowLeft, 
  MoreHorizontal, 
  Edit, 
  Copy, 
  Trash2, 
  Snowflake,
  Trophy,
  XCircle,
  Check
} from 'lucide-react';
import { EditableField } from './EditableField';
import { OpportunityDetails } from '@/hooks/useOpportunityDetails';
import { cn } from '@/lib/utils';

interface OpportunityDetailHeaderProps {
  opportunity: OpportunityDetails;
  onWon: () => void;
  onLost: () => void;
  onUpdateTitle: (title: string) => Promise<void>;
  onEdit: () => void;
  onDelete: () => void;
}

export function OpportunityDetailHeader({
  opportunity,
  onWon,
  onLost,
  onUpdateTitle,
  onEdit,
  onDelete,
}: OpportunityDetailHeaderProps) {
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveTitle = async (newTitle: string) => {
    setIsSaving(true);
    try {
      await onUpdateTitle(newTitle);
    } finally {
      setIsSaving(false);
    }
  };

  const isWon = opportunity.status === 'won';
  const isLost = opportunity.status === 'lost';
  const isClosed = isWon || isLost;

  const temperatureStyles: Record<string, string> = {
    cold: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    warm: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    hot: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    burning: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const temperatureLabels: Record<string, string> = {
    cold: 'Frio',
    warm: 'Morno',
    hot: 'Quente',
    burning: 'Urgente',
  };

  const stages = opportunity.stages || [];
  const currentStageIndex = stages.findIndex(s => s.id === opportunity.stage_id);

  return (
    <div className="space-y-6">
      {/* Top Row: Back button */}
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/app/opportunities')}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao Pipeline
        </Button>
      </div>

      {/* Title + Badges + Actions - All in one row */}
      <div className="flex flex-wrap items-center gap-3">
        <EditableField
          value={opportunity.title}
          onSave={handleSaveTitle}
          className="text-2xl md:text-3xl font-bold"
        />

        {isWon && (
          <Badge className="bg-green-500 text-white">
            ✓ GANHOU
          </Badge>
        )}
        {isLost && (
          <Badge className="bg-red-500 text-white">
            ✗ PERDEU
          </Badge>
        )}

        <Badge variant="outline">
          {opportunity.prob || 0}% probabilidade
        </Badge>
        {opportunity.produto && (
          <Badge variant="secondary">
            {opportunity.produto}
          </Badge>
        )}
        {opportunity.temperature && (
          <Badge className={temperatureStyles[opportunity.temperature] || ''}>
            {temperatureLabels[opportunity.temperature] || opportunity.temperature}
          </Badge>
        )}

        {/* Spacer to push action buttons to right */}
        <div className="flex-1" />

        {/* Won/Lost/More Buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onWon}
            disabled={isClosed}
            className={cn(
              "gap-2",
              isWon && "bg-green-100 border-green-500 text-green-700 dark:bg-green-900/30 dark:text-green-400"
            )}
          >
            <Trophy className="h-4 w-4" />
            Ganhou
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onLost}
            disabled={isClosed}
            className={cn(
              "gap-2",
              isLost && "bg-red-100 border-red-500 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            )}
          >
            <XCircle className="h-4 w-4" />
            Perdeu
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Pipeline Progress with Stage Labels */}
      <div className="bg-card border rounded-lg p-4">
        <div className="mb-3">
          <span className="text-sm font-medium text-muted-foreground">
            {opportunity.pipeline?.name}
          </span>
        </div>
        
        {/* Progress Bars */}
        <div className="flex items-center gap-1 mb-3">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            
            return (
              <div
                key={stage.id}
                className={cn(
                  "flex-1 h-2 rounded-full transition-colors",
                  isCompleted && "bg-primary",
                  isCurrent && "bg-primary/70",
                  !isCompleted && !isCurrent && "bg-muted"
                )}
              />
            );
          })}
        </div>

        {/* Stage Circles with Labels */}
        <div className="flex items-start justify-between">
          {stages.map((stage, index) => {
            const isCompleted = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            
            return (
              <div
                key={stage.id}
                className="flex flex-col items-center flex-1 min-w-0"
              >
                <div
                  className={cn(
                    "flex items-center justify-center",
                    "w-6 h-6 rounded-full text-xs font-medium mb-1",
                    isCompleted && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary/20 text-primary border-2 border-primary",
                    !isCompleted && !isCurrent && "bg-muted text-muted-foreground"
                  )}
                >
                  {isCompleted ? <Check className="h-3 w-3" /> : index + 1}
                </div>
                <span 
                  className={cn(
                    "text-[10px] text-center leading-tight truncate w-full px-1",
                    isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                  )}
                  title={stage.name}
                >
                  {stage.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
