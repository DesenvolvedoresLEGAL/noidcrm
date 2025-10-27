import { Target } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function ProcessedOpportunities() {
  return (
    <EmptyState
      icon={Target}
      title="Nenhuma oportunidade processada"
      description="Os dados de oportunidades processadas aparecerão aqui quando você começar a gerenciar suas vendas."
    />
  );
}
