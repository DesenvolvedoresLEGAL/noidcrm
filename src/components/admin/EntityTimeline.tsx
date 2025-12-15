import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Activity,
  Bot,
  FileText,
  GitBranch,
  User,
  Zap,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useEntityTimeline, type TimelineEvent } from '@/hooks/admin/useEntityTimeline';
import { Link } from 'react-router-dom';

interface EntityTimelineProps {
  entityType: string;
  entityId: string;
  maxHeight?: string;
}

const typeIcons = {
  event: Activity,
  audit: FileText,
  ai_run: Bot,
  workflow: GitBranch,
};

const sourceIcons = {
  user: User,
  system: Zap,
  automation: GitBranch,
  ai_agent: Bot,
};

const statusIcons = {
  success: CheckCircle,
  failed: XCircle,
  pending: Clock,
  running: Loader2,
};

const statusColors = {
  success: 'text-green-500',
  failed: 'text-red-500',
  pending: 'text-yellow-500',
  running: 'text-blue-500 animate-spin',
};

function TimelineItem({ event }: { event: TimelineEvent }) {
  const TypeIcon = typeIcons[event.type];
  const SourceIcon = sourceIcons[event.source];
  const StatusIcon = event.status ? statusIcons[event.status] : null;

  return (
    <div className="flex gap-3 py-3 border-b border-border/50 last:border-0">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            'p-1.5 rounded-full',
            event.type === 'ai_run' && 'bg-purple-500/10',
            event.type === 'workflow' && 'bg-blue-500/10',
            event.type === 'audit' && 'bg-orange-500/10',
            event.type === 'event' && 'bg-green-500/10'
          )}
        >
          <TypeIcon
            className={cn(
              'h-3.5 w-3.5',
              event.type === 'ai_run' && 'text-purple-500',
              event.type === 'workflow' && 'text-blue-500',
              event.type === 'audit' && 'text-orange-500',
              event.type === 'event' && 'text-green-500'
            )}
          />
        </div>
        <div className="w-px flex-1 bg-border/50 mt-1" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium">{event.action}</span>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {event.type}
          </Badge>
          {event.status && StatusIcon && (
            <StatusIcon
              className={cn('h-3 w-3', statusColors[event.status])}
            />
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {event.description}
        </p>

        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <SourceIcon className="h-2.5 w-2.5" />
            <span>{event.actorName || event.source}</span>
          </div>

          <span className="text-[10px] text-muted-foreground">
            {format(new Date(event.timestamp), "HH:mm:ss", { locale: ptBR })}
          </span>

          {event.latencyMs && (
            <span className="text-[10px] text-muted-foreground">
              {event.latencyMs}ms
            </span>
          )}

          {event.traceId && (
            <Link
              to={`/admin/trace/${event.traceId}`}
              className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
            >
              trace
              <ExternalLink className="h-2 w-2" />
            </Link>
          )}
        </div>

        {event.metadata && Object.keys(event.metadata).length > 0 && (
          <div className="mt-1.5 p-1.5 bg-muted/50 rounded text-[10px] font-mono overflow-hidden">
            <pre className="truncate">
              {JSON.stringify(event.metadata, null, 0).slice(0, 100)}...
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export function EntityTimeline({
  entityType,
  entityId,
  maxHeight = '400px',
}: EntityTimelineProps) {
  const { data: timeline, isLoading } = useEntityTimeline(entityType, entityId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!timeline || timeline.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">Nenhum evento registrado</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="space-y-0">
        {timeline.map((event) => (
          <TimelineItem key={event.id} event={event} />
        ))}
      </div>
    </ScrollArea>
  );
}
