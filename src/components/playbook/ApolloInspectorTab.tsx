import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Database,
  RefreshCw,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  useApolloQueryLogs,
  useApolloReplay,
} from '@/hooks/intelligence/useApolloQueryLogs';
import type { ApolloQueryLog } from '@/services/intelligence/apolloInvisible';

interface Props {
  prospectId: string;
  isAdmin?: boolean;
}

/**
 * KAI.18.5 — Apollo Inspector
 * Aba do drawer com logs detalhados de cada consulta ao Apollo.
 * Mostra payload, resposta, motivos de descarte, cache, créditos.
 */
export function ApolloInspectorTab({ prospectId, isAdmin }: Props) {
  const { data: logs, isLoading, refetch } = useApolloQueryLogs(prospectId, 25);
  const replay = useApolloReplay(prospectId);

  const handleReplay = async () => {
    try {
      await replay.mutateAsync();
      toast.success('Busca reproduzida — cache ignorado');
      refetch();
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao reproduzir busca');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Apollo Inspector</h3>
          <p className="text-xs text-muted-foreground">
            Histórico completo de consultas ao Apollo. Toda decisão é explicável.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={handleReplay}
          disabled={replay.isPending}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${replay.isPending ? 'animate-spin' : ''}`} />
          Reproduzir busca
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !logs || logs.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            Nenhuma consulta Apollo registrada para este prospect ainda.
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[520px] pr-3">
          <div className="space-y-3">
            {logs.map((log) => (
              <LogCard key={log.id} log={log} isAdmin={isAdmin} />
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}

function LogCard({ log, isAdmin }: { log: ApolloQueryLog; isAdmin?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const statusOk = log.status === 'ok';
  const modeColor: Record<string, string> = {
    smart: 'bg-blue-500/10 text-blue-700 border-blue-500/30',
    raw: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
    replay: 'bg-amber-500/10 text-amber-700 border-amber-500/30',
    system: 'bg-muted text-muted-foreground border-muted-foreground/20',
  };

  const cacheColor: Record<string, string> = {
    hit: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30',
    miss: 'bg-slate-500/10 text-slate-700 border-slate-500/30',
    expired: 'bg-orange-500/10 text-orange-700 border-orange-500/30',
    bypass: 'bg-purple-500/10 text-purple-700 border-purple-500/30',
    invalidated: 'bg-red-500/10 text-red-700 border-red-500/30',
  };

  return (
    <Card className="border-l-2" style={{ borderLeftColor: statusOk ? '#10b981' : '#ef4444' }}>
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2">
            {expanded ? (
              <ChevronDown className="h-4 w-4 mt-0.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-0.5 text-muted-foreground" />
            )}
            <div>
              <CardTitle className="text-xs font-mono">{log.endpoint}</CardTitle>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${modeColor[log.mode] ?? ''}`}>
                  {log.mode}
                </Badge>
                <Badge variant="outline" className={`text-[10px] ${cacheColor[log.cache_status] ?? ''}`}>
                  <Database className="h-2.5 w-2.5 mr-0.5" />
                  cache: {log.cache_status}
                </Badge>
                {log.fallback_used && (
                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/30">
                    fallback
                  </Badge>
                )}
                {statusOk ? (
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/30">
                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                    OK
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">
                    <AlertCircle className="h-2.5 w-2.5 mr-0.5" />
                    {log.status}
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="text-right text-[10px] text-muted-foreground shrink-0">
            <div className="flex items-center gap-1 justify-end">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: ptBR })}
            </div>
            {log.latency_ms != null && (
              <div className="mt-0.5">
                <Zap className="h-3 w-3 inline mr-0.5" />
                {log.latency_ms}ms
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0 pb-3">
        <div className="grid grid-cols-4 gap-2 text-center text-[11px] mb-2">
          <Metric label="Retornou" value={log.people_returned} tone="text-emerald-700" />
          <Metric label="Recomendou" value={log.people_recommended} tone="text-blue-700" />
          <Metric label="Escondeu" value={log.people_hidden} tone="text-amber-700" />
          <Metric label="Créditos" value={log.credits_used} tone="text-muted-foreground" />
        </div>

        {log.people_hidden > 0 && (
          <div className="mb-2 rounded-md bg-amber-500/5 border border-amber-500/20 px-2 py-1.5">
            <div className="text-[10px] font-medium text-amber-800 mb-1">
              Motivos de descarte (recomendação, não exclusão)
            </div>
            <div className="flex flex-wrap gap-1">
              {Object.entries(log.hidden_reasons ?? {}).map(([reason, count]) =>
                count > 0 ? (
                  <Badge key={reason} variant="outline" className="text-[10px]">
                    {reason}: {String(count)}
                  </Badge>
                ) : null,
              )}
            </div>
          </div>
        )}

        {expanded && (
          <div className="space-y-2 mt-3 border-t pt-3">
            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Payload enviado
              </div>
              <pre className="text-[10px] bg-muted/40 rounded p-2 overflow-x-auto max-h-40">
                {JSON.stringify(log.request_payload, null, 2)}
              </pre>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">
                Resposta Apollo (amostra)
              </div>
              <pre className="text-[10px] bg-muted/40 rounded p-2 overflow-x-auto max-h-52">
                {JSON.stringify(log.response_body, null, 2)}
              </pre>
            </div>

            {log.error_message && (
              <div>
                <div className="text-[10px] font-semibold text-red-700 uppercase mb-1">Erro</div>
                <pre className="text-[10px] bg-red-500/10 border border-red-500/20 rounded p-2 overflow-x-auto">
                  {log.error_message}
                </pre>
              </div>
            )}

            {isAdmin && (
              <div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => setShowDebug((v) => !v)}
                >
                  {showDebug ? 'Ocultar' : 'Ver'} debug de engenharia
                </Button>
                {showDebug && (
                  <div className="mt-2 space-y-1 text-[10px] font-mono bg-slate-900 text-slate-100 rounded p-2">
                    <div>id: {log.id}</div>
                    <div>apollo_request_id: {log.apollo_request_id ?? '—'}</div>
                    <div>response_status: {log.response_status ?? '—'}</div>
                    <div>retries: {log.retries}</div>
                    <div>latency_ms: {log.latency_ms ?? '—'}</div>
                    <div>headers: {JSON.stringify(log.request_headers_safe)}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md bg-muted/30 py-1.5">
      <div className={`text-sm font-semibold ${tone}`}>{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
