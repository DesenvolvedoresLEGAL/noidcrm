import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

export function EnrichmentStatusBadge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const config: Record<string, { icon: any; label: string; className: string }> = {
    queued: { icon: Clock, label: 'Na fila', className: 'bg-muted text-muted-foreground' },
    running: { icon: Loader2, label: 'Processando', className: 'bg-blue-500/10 text-blue-600 border-blue-500/20' },
    completed: { icon: CheckCircle2, label: 'Concluído', className: 'bg-green-500/10 text-green-600 border-green-500/20' },
    failed: { icon: XCircle, label: 'Falhou', className: 'bg-red-500/10 text-red-600 border-red-500/20' },
  };
  const c = config[status] || config.queued;
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={cn('gap-1', c.className)}>
      <Icon className={cn('h-3 w-3', status === 'running' && 'animate-spin')} />
      {c.label}
    </Badge>
  );
}
