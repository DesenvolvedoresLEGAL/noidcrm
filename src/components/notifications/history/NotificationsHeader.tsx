import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox, AlertTriangle, CalendarDays, TrendingUp, TrendingDown, Download, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  total: number;
  critical: number;
  today: number;
  trendPct: number;
  trendCurrent: number;
  onExport: () => void;
}

export function NotificationsHeader({ total, critical, today, trendPct, trendCurrent, onExport }: Props) {
  const navigate = useNavigate();
  const trendUp = trendPct >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Central de Notificações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Histórico completo de tudo que aconteceu — alertas, propostas, conversas e novidades.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => navigate('/app/settings/notifications')}
          >
            <Settings className="h-3.5 w-3.5" />
            Configurar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={<Inbox className="h-4 w-4 text-primary" />}
          label="Total"
          value={total.toLocaleString('pt-BR')}
          hint="todas as fontes"
        />
        <KpiCard
          icon={<AlertTriangle className={cn('h-4 w-4', critical > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground')} />}
          label="Críticas pendentes"
          value={critical.toString()}
          hint={critical > 0 ? 'requerem atenção' : 'tudo limpo'}
          highlight={critical > 0}
        />
        <KpiCard
          icon={<CalendarDays className="h-4 w-4 text-blue-500" />}
          label="Recebidas hoje"
          value={today.toString()}
          hint="últimas 24h"
        />
        <KpiCard
          icon={<TrendIcon className={cn('h-4 w-4', trendUp ? 'text-green-500' : 'text-orange-500')} />}
          label="Tendência 7 dias"
          value={`${trendUp ? '+' : ''}${trendPct}%`}
          hint={`${trendCurrent} esta semana`}
        />
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        highlight && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold tracking-tight">{value}</div>
      <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>
    </Card>
  );
}
