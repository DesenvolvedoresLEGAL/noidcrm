/**
 * Sprint 2.7 — Estado de erro padrão.
 */
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ReportErrorState({
  title = 'Não foi possível carregar o relatório',
  message,
  onRetry,
}: Props) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          {message && <p className="mt-1 text-sm text-muted-foreground">{message}</p>}
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="gap-2">
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
