import { FileText } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function BottleneckExecutiveSummary({
  summary,
  loading,
}: {
  summary: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-full bg-primary/10 p-2">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-semibold">Diagnóstico executivo</h3>
          {loading ? (
            <Skeleton className="h-4 w-80" />
          ) : (
            <p className="text-sm text-muted-foreground">{summary}</p>
          )}
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground/70">
            Gerado a partir dos dados oficiais — sem IA.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
