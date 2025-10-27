import { BarChart3 } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

interface GeneralOverviewProps {
  data: any;
}

export function GeneralOverview({ data }: GeneralOverviewProps) {
  return (
    <EmptyState
      icon={BarChart3}
      title="Nenhum dado disponível"
      description="Os relatórios serão gerados automaticamente conforme você usar o CRM e adicionar oportunidades."
    />
  );
}
