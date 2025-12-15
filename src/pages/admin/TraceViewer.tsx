import { useParams, Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft,
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
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTraceTimeline, type TimelineEvent } from '@/hooks/admin/useEntityTimeline';
import { toast } from 'sonner';

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

const typeColors = {
  event: 'border-l-green-500 bg-green-500/5',
  audit: 'border-l-orange-500 bg-orange-500/5',
  ai_run: 'border-l-purple-500 bg-purple-500/5',
  workflow: 'border-l-blue-500 bg-blue-500/5',
};

function TraceEvent({ event, index }: { event: TimelineEvent; index: number }) {
  const TypeIcon = typeIcons[event.type];
  const SourceIcon = sourceIcons[event.source];
  const StatusIcon = event.status ? statusIcons[event.status] : null;

  return (
    <div
      className={cn(
        'border-l-4 rounded-r-lg p-4 relative',
        typeColors[event.type]
      )}
    >
      {/* Timeline connector */}
      <div className="absolute -left-[11px] top-4 h-5 w-5 rounded-full bg-background border-2 border-border flex items-center justify-center">
        <span className="text-[10px] font-bold">{index + 1}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div
              className={cn(
                'p-1.5 rounded-full',
                event.type === 'ai_run' && 'bg-purple-500/20',
                event.type === 'workflow' && 'bg-blue-500/20',
                event.type === 'audit' && 'bg-orange-500/20',
                event.type === 'event' && 'bg-green-500/20'
              )}
            >
              <TypeIcon
                className={cn(
                  'h-4 w-4',
                  event.type === 'ai_run' && 'text-purple-500',
                  event.type === 'workflow' && 'text-blue-500',
                  event.type === 'audit' && 'text-orange-500',
                  event.type === 'event' && 'text-green-500'
                )}
              />
            </div>
            <span className="font-medium">{event.action}</span>
            <Badge variant="outline" className="text-xs">
              {event.type}
            </Badge>
            {event.status && StatusIcon && (
              <StatusIcon
                className={cn('h-4 w-4', statusColors[event.status])}
              />
            )}
          </div>

          <p className="text-sm text-muted-foreground mt-1">
            {event.description}
          </p>

          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <SourceIcon className="h-3 w-3" />
              <span>{event.actorName || event.source}</span>
            </div>

            <span className="text-xs text-muted-foreground">
              {format(new Date(event.timestamp), "dd/MM/yyyy HH:mm:ss.SSS", {
                locale: ptBR,
              })}
            </span>

            {event.latencyMs && (
              <Badge variant="secondary" className="text-xs">
                {event.latencyMs}ms
              </Badge>
            )}
          </div>
        </div>
      </div>

      {event.metadata && Object.keys(event.metadata).length > 0 && (
        <div className="mt-3 p-3 bg-muted/50 rounded-lg">
          <p className="text-xs font-medium mb-1 text-muted-foreground">
            Metadata
          </p>
          <pre className="text-xs font-mono overflow-x-auto whitespace-pre-wrap">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function TraceViewer() {
  const { traceId } = useParams<{ traceId: string }>();
  const { data: timeline, isLoading } = useTraceTimeline(traceId || '');

  const copyTraceId = () => {
    if (traceId) {
      navigator.clipboard.writeText(traceId);
      toast.success('Trace ID copiado!');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/admin/control-room">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Trace Viewer</h1>
          <div className="flex items-center gap-2 mt-1">
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
              {traceId}
            </code>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={copyTraceId}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Timeline do Trace
            {timeline && (
              <Badge variant="secondary">{timeline.length} eventos</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          ) : !timeline || timeline.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Nenhum evento encontrado para este trace</p>
            </div>
          ) : (
            <div className="space-y-4 ml-2">
              {timeline.map((event, index) => (
                <TraceEvent key={event.id} event={event} index={index} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
