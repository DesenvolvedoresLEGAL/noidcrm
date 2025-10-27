import { Filter } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function FunnelBalance() {
  return (
    <EmptyState
      icon={Filter}
      title="Nenhum dado de funil disponível"
      description="A análise de balanceamento do funil será mostrada aqui quando houver oportunidades em diferentes estágios."
    />
  );
}
