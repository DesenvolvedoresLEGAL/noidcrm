import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  MessageSquare, 
  Shield,
  ExternalLink
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import type { MemoryType } from '@/hooks/useMemories';
import { cn } from '@/lib/utils';

interface MemoryCitationProps {
  memoryId: string;
  memoryType: MemoryType;
  title: string;
  sourceSummary?: string;
  relevanceScore?: number;
  onClick?: () => void;
}

const memoryTypeConfig: Record<MemoryType, {
  icon: typeof Brain;
  color: string;
  bgColor: string;
}> = {
  objection: {
    icon: MessageSquare,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100 dark:bg-orange-900/30'
  },
  win_pattern: {
    icon: TrendingUp,
    color: 'text-green-600',
    bgColor: 'bg-green-100 dark:bg-green-900/30'
  },
  loss_pattern: {
    icon: TrendingDown,
    color: 'text-red-600',
    bgColor: 'bg-red-100 dark:bg-red-900/30'
  },
  churn_signal: {
    icon: AlertTriangle,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100 dark:bg-amber-900/30'
  },
  converting_language: {
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100 dark:bg-blue-900/30'
  },
  countermeasure: {
    icon: Shield,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100 dark:bg-purple-900/30'
  }
};

export function MemoryCitation({
  memoryId,
  memoryType,
  title,
  sourceSummary,
  relevanceScore,
  onClick
}: MemoryCitationProps) {
  const config = memoryTypeConfig[memoryType];
  const Icon = config?.icon || Brain;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={onClick}
            className={cn(
              "inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs transition-colors",
              config?.bgColor,
              "hover:opacity-80 cursor-pointer"
            )}
          >
            <Icon className={cn("h-3 w-3", config?.color)} />
            <span className="max-w-[150px] truncate">{title}</span>
            {relevanceScore !== undefined && relevanceScore >= 0.7 && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4">
                {Math.round(relevanceScore * 100)}%
              </Badge>
            )}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="font-medium text-sm">{title}</p>
          {sourceSummary && (
            <p className="text-xs text-muted-foreground mt-1">{sourceSummary}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface MemoryCitationsListProps {
  memories: Array<{
    memory_id: string;
    memory_type: MemoryType;
    title: string;
    relevance_score?: number;
    source_summary?: string;
  }>;
  onMemoryClick?: (memoryId: string) => void;
}

export function MemoryCitationsList({ memories, onMemoryClick }: MemoryCitationsListProps) {
  if (!memories?.length) return null;

  return (
    <div className="flex flex-col gap-2 p-3 bg-muted/30 rounded-lg border border-dashed">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Brain className="h-3.5 w-3.5" />
        <span className="font-medium">Baseado em {memories.length} memória{memories.length > 1 ? 's' : ''}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {memories.map((memory) => (
          <MemoryCitation
            key={memory.memory_id}
            memoryId={memory.memory_id}
            memoryType={memory.memory_type}
            title={memory.title}
            sourceSummary={memory.source_summary}
            relevanceScore={memory.relevance_score}
            onClick={() => onMemoryClick?.(memory.memory_id)}
          />
        ))}
      </div>
    </div>
  );
}
