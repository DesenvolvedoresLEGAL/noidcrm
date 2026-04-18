import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import {
  Inbox,
  AlertTriangle,
  CalendarDays,
  TrendingUp,
  TrendingDown,
  Download,
  Settings,
  Bell,
  Filter,
  CheckCheck,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface Props {
  total: number;
  critical: number;
  today: number;
  trendPct: number;
  trendCurrent: number;
  unreadGlobal?: number;
  isMarkingAllRead?: boolean;
  onExport: () => void;
  onMarkAllReadGlobal?: () => void;
  onOpenMobileFilters?: () => void;
}

export function NotificationsHeader({
  total,
  critical,
  today,
  trendPct,
  trendCurrent,
  unreadGlobal = 0,
  isMarkingAllRead = false,
  onExport,
  onMarkAllReadGlobal,
  onOpenMobileFilters,
}: Props) {
  const navigate = useNavigate();
  const trendUp = trendPct >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;

  const handleMarkAllRead = () => {
    if (!onMarkAllReadGlobal || unreadGlobal === 0) return;
    if (unreadGlobal > 50) {
      const ok = window.confirm(
        `Marcar TODAS as ${unreadGlobal} notificações não lidas como lidas? Esta ação afeta todas as visualizações (caixa de entrada, badges, modais).`,
      );
      if (!ok) return;
    }
    onMarkAllReadGlobal();
  };

  return (
    <div className="space-y-4 md:space-y-6">
      <PageHeader
        icon={Bell}
        title="Central de Notificações"
        subtitle="Histórico completo de tudo que aconteceu — alertas, propostas, conversas e novidades."
        variant="primary"
        actions={
          <>
            {onOpenMobileFilters && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 lg:hidden"
                onClick={onOpenMobileFilters}
              >
                <Filter className="h-3.5 w-3.5" />
                Filtros
              </Button>
            )}
            {onMarkAllReadGlobal && unreadGlobal > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleMarkAllRead}
                disabled={isMarkingAllRead}
                title={`Marcar todas as ${unreadGlobal} não lidas em todas as visualizações`}
              >
                {isMarkingAllRead ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="h-3.5 w-3.5" />
                )}
                <span className="hidden sm:inline">
                  Marcar {unreadGlobal} como lidas
                </span>
                <span className="sm:hidden">{unreadGlobal} lidas</span>
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Exportar CSV</span>
              <span className="sm:hidden">CSV</span>
            </Button>
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => navigate('/app/settings/notifications')}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Configurar</span>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <KpiCard
          icon={<Inbox className="h-5 w-5 text-primary" />}
          label="Total"
          value={total.toLocaleString('pt-BR')}
          hint="todas as fontes"
        />
        <KpiCard
          icon={
            <AlertTriangle
              className={cn(
                'h-5 w-5',
                critical > 0 ? 'text-destructive animate-pulse' : 'text-muted-foreground',
              )}
            />
          }
          label="Críticas pendentes"
          value={critical.toString()}
          hint={critical > 0 ? 'requerem atenção' : 'tudo limpo'}
          highlight={critical > 0}
        />
        <KpiCard
          icon={<CalendarDays className="h-5 w-5 text-blue-500" />}
          label="Recebidas hoje"
          value={today.toString()}
          hint="últimas 24h"
        />
        <KpiCard
          icon={
            <TrendIcon
              className={cn('h-5 w-5', trendUp ? 'text-emerald-500' : 'text-orange-500')}
            />
          }
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
        'p-4 md:p-5 shadow-card hover:shadow-card-hover transition-all duration-300 hover:scale-[1.02] animate-fade-in',
        highlight && 'border-destructive/40 bg-destructive/5',
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide leading-tight">
          {label}
        </span>
        <div className="shrink-0">{icon}</div>
      </div>
      <div className="text-2xl md:text-3xl font-bold tracking-tight">{value}</div>
      <p className="text-[11px] text-muted-foreground mt-1">{hint}</p>
    </Card>
  );
}
