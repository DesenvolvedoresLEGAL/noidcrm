import { LineChart } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function RevenueForecast() {
  return (
    <EmptyState
      icon={LineChart}
      title="Nenhuma previsão de receita disponível"
      description="A previsão de receita será calculada automaticamente com base nas oportunidades em aberto e suas probabilidades."
    />
  );
}
