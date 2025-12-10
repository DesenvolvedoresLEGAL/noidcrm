import { Filter } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function FunnelBalance() {
  // Simplified version - will implement full data fetching later
  return (
    <EmptyState
      icon={Filter}
      title="Balanceamento do Funil"
      description="A análise de balanceamento do funil será mostrada aqui. Clique em 'Gerar relatório' para atualizar os dados."
    />
  );
}
