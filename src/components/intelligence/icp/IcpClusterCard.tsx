import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, TrendingUp, Repeat, MapPin } from 'lucide-react';
import type { IntelligenceICP } from '@/hooks/intelligence/useIcpIntelligence';

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function IcpClusterCard({ cluster }: { cluster: IntelligenceICP }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="font-semibold text-sm">{cluster.name}</div>
            <div className="text-xs text-muted-foreground">{cluster.segment}</div>
          </div>
          <Badge variant="outline" className="capitalize">{cluster.tier}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <Metric icon={Users} label="Clientes" value={String(cluster.count)} />
          <Metric icon={TrendingUp} label="Receita" value={fmtBRL(cluster.totalRevenue)} />
          <Metric icon={TrendingUp} label="Ticket médio" value={fmtBRL(cluster.avgTicket)} />
          <Metric icon={Repeat} label="Recompra" value={`${cluster.repurchaseRate.toFixed(0)}%`} />
        </div>

        {cluster.topCities.length > 0 && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span>
              Top: {cluster.topCities.slice(0, 3).map(c => c.city).join(' · ')}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon, label, value,
}: { icon: typeof Users; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <div>
        <div className="text-muted-foreground">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}
