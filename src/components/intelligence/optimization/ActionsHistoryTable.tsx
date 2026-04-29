import { useOptimizationActionsLog } from '@/hooks/optimization/useOptimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function ActionsHistoryTable() {
  const { data, isLoading } = useOptimizationActionsLog();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico de ações</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
          </div>
        )}
        {!isLoading && (data?.length ?? 0) === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma ação registrada ainda.</p>
        )}
        <div className="space-y-2">
          {data?.map((a) => (
            <div key={a.id} className="flex items-start gap-3 rounded-md border p-3">
              {a.executed ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
              ) : (
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{a.action_type}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(a.executed_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {a.error_message && (
                  <p className="text-xs text-red-600 mt-1">{a.error_message}</p>
                )}
                {a.executed && Object.keys(a.result ?? {}).length > 0 && (
                  <pre className="text-[11px] text-muted-foreground mt-1 overflow-auto">
                    {JSON.stringify(a.result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
