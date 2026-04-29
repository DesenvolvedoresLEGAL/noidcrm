import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FeedbackSummary } from '@/services/crm/dynamicDashboardFeedback';
import type { FeedbackRow } from '@/services/crm/dynamicDashboardFeedback';

interface Props {
  summary?: FeedbackSummary;
  list: FeedbackRow[];
}

export function CloserDashboardFeedbackSummary({ summary, list }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Feedback dos pilotos</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-xs uppercase text-muted-foreground">Média</p>
            <p className="text-xl font-semibold">{summary?.avgRating ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Total</p>
            <p className="text-xl font-semibold">{summary?.total ?? 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Lentos</p>
            <p className="text-xl font-semibold">{summary?.slowCount ?? 0}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-muted-foreground">Confusos</p>
            <p className="text-xl font-semibold">{summary?.confusingCount ?? 0}</p>
          </div>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">Últimos comentários</p>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sem feedbacks ainda.</p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {list.map((f) => (
                <div key={f.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">Nota {f.rating}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(f.created_at).toLocaleString('pt-BR')}
                    </span>
                  </div>
                  {f.comment && <p className="text-muted-foreground mt-1">{f.comment}</p>}
                  {f.missing_info && (
                    <p className="text-xs text-muted-foreground mt-1">Faltou: {f.missing_info}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
