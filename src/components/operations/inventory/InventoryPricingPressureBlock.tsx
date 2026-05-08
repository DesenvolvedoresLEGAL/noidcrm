import { Activity, AlertTriangle, BadgeDollarSign, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useInventoryPricingPressure } from '@/hooks/operations/useInventoryPricing';
import { formatBRL, formatPercent } from '@/lib/operations/inventoryPricing';

function Card1({ icon: Icon, title, value, hint }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );
}

export function InventoryPricingPressureBlock() {
  const { data, isLoading } = useInventoryPricingPressure(30);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pressão comercial do estoque</CardTitle>
        <CardDescription>
          Como a ocupação do estoque está afetando suas propostas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card1
              icon={Activity}
              title="Ocupação média 7d"
              value={formatPercent(data.avg_occupancy_next_7_days)}
            />
            <Card1
              icon={TrendingUp}
              title={`Ocupação média ${data.window_days}d`}
              value={formatPercent(data.avg_occupancy_window_days)}
            />
            <Card1
              icon={AlertTriangle}
              title="Categorias com acréscimo"
              value={data.categories_with_factor}
              hint="Risco médio ou maior"
            />
            <Card1
              icon={BadgeDollarSign}
              title="Receita protegida"
              value={formatBRL(data.protected_revenue)}
              hint={`últimos ${data.window_days} dias`}
            />
            <Card1
              icon={AlertTriangle}
              title="Propostas críticas com desconto"
              value={data.proposals_with_critical_discount}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
