import { Percent } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function ConversionRate() {
  return (
    <EmptyState
      icon={Percent}
      title="Nenhuma taxa de conversão disponível"
      description="As taxas de conversão entre estágios aparecerão aqui quando você processar oportunidades pelo funil."
    />
  );
}
