import { Badge } from '@/components/ui/badge';
import type { DashboardResolutionSource } from '@/services/crm/dashboardProfiles';

const LABELS: Record<DashboardResolutionSource, string> = {
  user: 'Usuário',
  business_function: 'Função',
  department: 'Área',
  permission_role: 'Permissão',
  default: 'Padrão',
  legacy_fallback: 'Fallback legado',
  error_fallback: 'Erro',
};

const VARIANTS: Record<DashboardResolutionSource, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  user: 'default',
  business_function: 'default',
  department: 'secondary',
  permission_role: 'secondary',
  default: 'outline',
  legacy_fallback: 'outline',
  error_fallback: 'destructive',
};

export function DashboardResolutionBadge({ source }: { source: DashboardResolutionSource }) {
  return <Badge variant={VARIANTS[source]}>{LABELS[source]}</Badge>;
}
