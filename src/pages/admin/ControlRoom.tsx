import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  Bot,
  CheckCircle,
  ExternalLink,
  GitBranch,
  RefreshCw,
  User,
  XCircle,
  Zap,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusCard } from '@/components/admin/StatusCard';
import { useControlRoomMetrics, type RecentExecution } from '@/hooks/admin/useControlRoomMetrics';

const typeIcons = {
  user: User,
  ai: Bot,
  automation: GitBranch,
  system: Zap,
};

const typeColors = {
  user: 'bg-blue-500/10 text-blue-500',
  ai: 'bg-purple-500/10 text-purple-500',
  automation: 'bg-green-500/10 text-green-500',
  system: 'bg-orange-500/10 text-orange-500',
};

function ExecutionRow({ execution }: { execution: RecentExecution }) {
  const Icon = typeIcons[execution.type];
  const StatusIcon = execution.status === 'success' ? CheckCircle : XCircle;

  return (
    <div className="flex items-center gap-3 py-2 px-3 border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
      <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
        {format(new Date(execution.timestamp), 'HH:mm:ss')}
      </span>

      <div className={cn('p-1 rounded', typeColors[execution.type])}>
        <Icon className="h-3 w-3" />
      </div>

      <span className="text-xs font-medium truncate flex-1 min-w-0">
        {execution.action}
      </span>

      <Badge variant="outline" className="text-[10px] shrink-0">
        {execution.entityType}
      </Badge>

      <StatusIcon
        className={cn(
          'h-3.5 w-3.5 shrink-0',
          execution.status === 'success' ? 'text-green-500' : 'text-red-500'
        )}
      />

      {execution.latencyMs && (
        <span className="text-[10px] text-muted-foreground w-12 text-right shrink-0">
          {execution.latencyMs}ms
        </span>
      )}

      <Link
        to={`/admin/trace/${execution.traceId}`}
        className="text-[10px] text-primary hover:underline shrink-0"
      >
        <ExternalLink className="h-3 w-3" />
      </Link>
    </div>
  );
}

export default function ControlRoom() {
  const { metrics, isLoadingMetrics, recentExecutions, isLoadingExecutions, refetch } =
    useControlRoomMetrics();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control Room</h1>
          <p className="text-sm text-muted-foreground">
            NOID RevenueOS - Observabilidade em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-medium text-green-600">
              OPERACIONAL
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-1" />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {isLoadingMetrics ? (
          [...Array(5)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="h-4 w-20 mb-3" />
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton className="h-3 w-24" />
              </CardContent>
            </Card>
          ))
        ) : (
          metrics?.cards.map((card) => (
            <StatusCard
              key={card.id}
              label={card.label}
              value={card.value}
              subValue={card.subValue}
              status={card.status}
              icon={card.icon}
            />
          ))
        )}
      </div>

      {/* Recent Executions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Últimas Execuções
            </CardTitle>
            {metrics?.lastEventAt && (
              <span className="text-xs text-muted-foreground">
                Último evento:{' '}
                {format(new Date(metrics.lastEventAt), "dd/MM HH:mm:ss", {
                  locale: ptBR,
                })}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[400px]">
            {isLoadingExecutions ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : recentExecutions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma execução recente</p>
              </div>
            ) : (
              recentExecutions.map((execution) => (
                <ExecutionRow key={execution.id} execution={execution} />
              ))
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link to="/admin/logs">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Activity className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Logs</p>
                <p className="text-xs text-muted-foreground">Ver todos os logs</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/audit">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Zap className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Audit Trail</p>
                <p className="text-xs text-muted-foreground">Histórico de ações</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/ai">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <Bot className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">AI Runs</p>
                <p className="text-xs text-muted-foreground">Execuções de IA</p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link to="/admin/automations">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardContent className="p-4 flex items-center gap-3">
              <GitBranch className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-sm">Automations</p>
                <p className="text-xs text-muted-foreground">Workflows ativos</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
