import { TrendingUp } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function AccumulatedOpportunities() {
  return (
    <EmptyState
      icon={TrendingUp}
      title="Nenhuma oportunidade acumulada"
      description="O histórico acumulado de oportunidades será exibido aqui conforme você adicionar dados ao sistema."
    />
  );
}
