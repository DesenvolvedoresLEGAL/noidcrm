import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';
import { Package } from 'lucide-react';
import { useProductsSold, useProductsMonthly, useProductsCross } from '@/hooks/useProductsReport';
import { ProductsKpiCards } from './products/ProductsKpiCards';
import { ProductsRankingTable } from './products/ProductsRankingTable';
import { ProductsCharts } from './products/ProductsCharts';
import { ProductsCrossAnalysis } from './products/ProductsCrossAnalysis';

export function ProductsReport() {
  const sold = useProductsSold();
  const monthly = useProductsMonthly(5);
  const cross = useProductsCross();

  if (sold.isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-80" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-72" /><Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  if (sold.error) {
    return <EmptyState icon={Package} title="Erro ao carregar relatório" description={String((sold.error as any)?.message || sold.error)} />;
  }

  const data = sold.data || [];
  if (data.length === 0) {
    return <EmptyState icon={Package} title="Nenhum produto vendido no período" description="Ajuste os filtros de período, funil ou responsável e tente novamente." />;
  }

  return (
    <div className="space-y-6">
      <ProductsKpiCards data={data} />
      <ProductsCharts data={data} monthly={monthly.data || []} />
      <ProductsRankingTable data={data} />
      <ProductsCrossAnalysis data={cross.data || []} />
    </div>
  );
}
