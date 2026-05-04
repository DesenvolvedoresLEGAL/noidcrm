import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, DollarSign, ShoppingBag, TrendingUp, Crown, Star, Heart, AlertTriangle, Moon, XCircle } from 'lucide-react';
import type { RFMOverview } from '@/services/crm/account-rfm';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

interface Props {
  overview: RFMOverview | undefined;
  loading?: boolean;
}

export function RFMOverviewCards({ overview, loading }: Props) {
  const o = overview;
  const items = [
    { title: 'Clientes analisados', value: o?.clientes_analisados ?? 0, icon: Users },
    { title: 'Receita total', value: fmtBRL(o?.receita_total ?? 0), icon: DollarSign },
    { title: 'Ticket médio', value: fmtBRL(o?.ticket_medio ?? 0), icon: ShoppingBag },
    { title: 'Score RFM médio', value: (o?.score_rfm_medio ?? 0).toFixed(1), icon: TrendingUp },
    { title: 'Campeões', value: o?.campeoes ?? 0, icon: Crown },
    { title: 'VIP', value: o?.vip ?? 0, icon: Star },
    { title: 'Leais', value: o?.leais ?? 0, icon: Heart },
    { title: 'Em risco', value: o?.em_risco ?? 0, icon: AlertTriangle },
    { title: 'Hibernando', value: o?.hibernando ?? 0, icon: Moon },
    { title: 'Perdidos', value: o?.perdidos ?? 0, icon: XCircle },
  ];

  return (
    <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <Card key={it.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{it.title}</CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{loading ? '—' : it.value}</div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
