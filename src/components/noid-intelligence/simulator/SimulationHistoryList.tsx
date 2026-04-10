import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  history: any[];
  onSelect?: (run: any) => void;
}

export default function SimulationHistoryList({ history, onSelect }: Props) {
  if (!history || history.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Nenhuma simulação registrada
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Histórico Recente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {history.slice(0, 10).map((run: any) => {
          const validation = run.validation_result_json || {};
          const status = validation.overall_status;
          return (
            <button
              key={run.id}
              onClick={() => onSelect?.(run)}
              className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 text-left transition-colors"
            >
              {status === 'passed' ? (
                <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              ) : status === 'blocked' ? (
                <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              ) : (
                <Clock className="h-4 w-4 text-yellow-600 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{run.scenario_type || 'Simulação'}</p>
                <p className="text-[10px] text-muted-foreground">
                  {run.created_at ? formatDistanceToNow(new Date(run.created_at), { addSuffix: true, locale: ptBR }) : '—'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline" className="text-[10px]">{run.execution_mode}</Badge>
                {validation.score != null && (
                  <span className="text-xs font-medium">{Math.round(validation.score)}</span>
                )}
              </div>
            </button>
          );
        })}
      </CardContent>
    </Card>
  );
}
