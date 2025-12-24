import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useSeatHistory, SeatEvent } from '@/hooks/useSeatHistory';
import { formatCurrencyFull } from '@/lib/i18n';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  UserPlus, 
  UserMinus, 
  ArrowUpCircle,
  ArrowDownCircle,
  History,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface SeatHistoryCardProps {
  limit?: number;
}

function getEventConfig(eventType: string) {
  switch (eventType) {
    case 'seat_added':
      return {
        icon: UserPlus,
        label: 'Usuário adicionado',
        variant: 'default' as const,
        color: 'text-green-600'
      };
    case 'seat_removed':
      return {
        icon: UserMinus,
        label: 'Usuário removido',
        variant: 'secondary' as const,
        color: 'text-red-600'
      };
    case 'plan_upgrade':
      return {
        icon: ArrowUpCircle,
        label: 'Upgrade de plano',
        variant: 'default' as const,
        color: 'text-primary'
      };
    case 'plan_downgrade':
      return {
        icon: ArrowDownCircle,
        label: 'Downgrade de plano',
        variant: 'secondary' as const,
        color: 'text-orange-600'
      };
    default:
      return {
        icon: History,
        label: eventType,
        variant: 'outline' as const,
        color: 'text-muted-foreground'
      };
  }
}

function SeatEventRow({ event }: { event: SeatEvent }) {
  const config = getEventConfig(event.event_type);
  const Icon = config.icon;
  const isPositive = event.delta_mrr > 0;

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg bg-muted ${config.color}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{config.label}</span>
            <Badge variant={config.variant} className="text-xs">
              {event.old_seat_count} → {event.new_seat_count} seats
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {format(new Date(event.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className={`flex items-center gap-1 font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {isPositive ? (
            <TrendingUp className="h-3 w-3" />
          ) : (
            <TrendingDown className="h-3 w-3" />
          )}
          <span>{isPositive ? '+' : ''}{formatCurrencyFull(event.delta_mrr)}/mês</span>
        </div>
        <div className="text-xs text-muted-foreground">
          MRR: {formatCurrencyFull(event.new_mrr)}
        </div>
      </div>
    </div>
  );
}

export function SeatHistoryCard({ limit = 10 }: SeatHistoryCardProps) {
  const { data: events, isLoading } = useSeatHistory(limit);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Histórico de Usuários
        </CardTitle>
        <CardDescription>
          Adições, remoções e mudanças de plano que afetaram seu custo mensal
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!events || events.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma mudança registrada ainda</p>
            <p className="text-sm text-muted-foreground mt-1">
              As alterações de usuários aparecerão aqui
            </p>
          </div>
        ) : (
          <div className="divide-y">
            {events.map(event => (
              <SeatEventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
