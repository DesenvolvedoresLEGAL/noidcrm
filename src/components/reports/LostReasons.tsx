import { TrendingDown } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';

export function LostReasons() {
  return (
    <EmptyState
      icon={TrendingDown}
      title="Nenhum motivo de perda registrado"
      description="Análises de motivos de perda aparecerão aqui quando você registrar oportunidades perdidas."
    />
  );
}
