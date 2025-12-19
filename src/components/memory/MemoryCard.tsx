import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  MessageSquare, 
  Shield,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Calendar,
  Tag
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Memory, MemoryType } from '@/hooks/useMemories';
import { cn } from '@/lib/utils';

const safeParseDate = (value?: string | null) => {
  if (!value) return null;
  const d = parseISO(value);
  return isValid(d) ? d : null;
};

interface MemoryCardProps {
  memory: Memory;
  compact?: boolean;
  showActions?: boolean;
  onApply?: () => void;
  onReject?: () => void;
  onClick?: () => void;
}

const memoryTypeConfig: Record<MemoryType, {
  icon: typeof Brain;
  label: string;
  color: string;
  bgColor: string;
}> = {
  objection: {
    icon: MessageSquare,
    label: 'Objeção',
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20'
  },
  win_pattern: {
    icon: TrendingUp,
    label: 'Padrão de Ganho',
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-900/20'
  },
  loss_pattern: {
    icon: TrendingDown,
    label: 'Padrão de Perda',
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-900/20'
  },
  churn_signal: {
    icon: AlertTriangle,
    label: 'Sinal de Churn',
    color: 'text-amber-600',
    bgColor: 'bg-amber-50 dark:bg-amber-900/20'
  },
  converting_language: {
    icon: MessageSquare,
    label: 'Linguagem que Converte',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20'
  },
  countermeasure: {
    icon: Shield,
    label: 'Contramedida',
    color: 'text-purple-600',
    bgColor: 'bg-purple-50 dark:bg-purple-900/20'
  }
};

export function MemoryCard({ 
  memory, 
  compact = false, 
  showActions = false,
  onApply,
  onReject,
  onClick 
}: MemoryCardProps) {
  const config = memoryTypeConfig[memory.memory_type];
  const Icon = config?.icon || Brain;

  const successPercent = memory.success_rate 
    ? Math.round(memory.success_rate * 100) 
    : null;

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div 
              className={cn(
                "flex items-start gap-2 p-2 rounded-lg cursor-pointer transition-colors",
                config?.bgColor,
                "hover:opacity-80"
              )}
              onClick={onClick}
            >
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", config?.color)} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{memory.title}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <Eye className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">{memory.usage_count}x</span>
                  {successPercent !== null && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className={cn(
                        "text-[10px]",
                        successPercent >= 70 ? "text-green-600" : 
                        successPercent >= 40 ? "text-amber-600" : "text-red-600"
                      )}>
                        {successPercent}% eficaz
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs">
            <p className="font-medium">{memory.title}</p>
            <p className="text-xs text-muted-foreground mt-1">{memory.content}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card 
      className={cn(
        "transition-all hover:shadow-md cursor-pointer",
        onClick && "hover:border-primary/50"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn(
            "p-2 rounded-lg shrink-0",
            config?.bgColor
          )}>
            <Icon className={cn("h-4 w-4", config?.color)} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Badge variant="secondary" className="text-[10px] mb-1">
                  {config?.label}
                </Badge>
                <h4 className="font-medium text-sm">{memory.title}</h4>
              </div>
              
              {memory.validated && (
                <Badge variant="outline" className="text-[10px] bg-green-50 text-green-700 border-green-200">
                  Validado
                </Badge>
              )}
            </div>
            
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
              {memory.content}
            </p>
            
            {/* Keywords */}
            {memory.keywords?.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                <Tag className="h-3 w-3 text-muted-foreground" />
                {memory.keywords.slice(0, 3).map((keyword, i) => (
                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">
                    {keyword}
                  </Badge>
                ))}
                {memory.keywords.length > 3 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{memory.keywords.length - 3}
                  </span>
                )}
              </div>
            )}
            
            {/* Stats */}
            <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <Eye className="h-3 w-3" />
                <span>{memory.usage_count} usos</span>
              </div>
              
              {successPercent !== null && (
                <div className={cn(
                  "flex items-center gap-1",
                  successPercent >= 70 ? "text-green-600" : 
                  successPercent >= 40 ? "text-amber-600" : "text-red-600"
                )}>
                  <TrendingUp className="h-3 w-3" />
                  <span>{successPercent}% eficácia</span>
                </div>
              )}
              
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {(() => {
                    const createdAt = safeParseDate(memory.created_at);
                    if (!createdAt) return '—';
                    return formatDistanceToNow(createdAt, {
                      addSuffix: true,
                      locale: ptBR,
                    });
                  })()}
                </span>
              </div>
            </div>
            
            {/* Source */}
            {memory.source_metadata && (
              <p className="text-[10px] text-muted-foreground mt-2 italic">
                Fonte: {memory.source_metadata.account_name || memory.source_type}
                {(() => {
                  const extractedAt = safeParseDate(memory.source_metadata?.extraction_date);
                  if (!extractedAt) return null;
                  return <> em {extractedAt.toLocaleDateString('pt-BR')}</>;
                })()}
              </p>
            )}
            
            {/* Actions */}
            {showActions && (
              <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onApply?.();
                  }}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  Útil
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs flex-1"
                  onClick={(e) => {
                    e.stopPropagation();
                    onReject?.();
                  }}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  Não aplicável
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
