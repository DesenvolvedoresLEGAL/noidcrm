import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, RefreshCw, Star, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ForecastFilters as FilterType } from '@/hooks/useForecastData';
import { toast } from 'sonner';

interface ForecastFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onRefresh: () => void | Promise<void>;
  isLoading?: boolean;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  /** Sprint F2.10 — official sales pipeline (read-only badge) */
  salesPipelineName?: string | null;
  /** Sprint F2.10 — true when no sales pipeline could be resolved (post-resolution only) */
  salesPipelineMissing?: boolean;
  /** F2.10.2 — true while resolving the official sales pipeline */
  salesPipelineLoading?: boolean;
}

export function ForecastFilters({
  filters,
  onFiltersChange,
  onRefresh,
  isLoading,
  isFetching,
  dataUpdatedAt,
  salesPipelineName,
  salesPipelineMissing,
  salesPipelineLoading,
}: ForecastFiltersProps) {
  const { data: team } = useQuery({
    queryKey: ['team-members-sales-cs'],
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return [];
      const { data: members, error: membersError } = await supabase
        .from('organization_members')
        .select('user_id, org_role')
        .eq('organization_id', orgData)
        .eq('status', 'active')
        .in('org_role', ['sales', 'cs']);
      if (membersError) throw membersError;
      if (!members || members.length === 0) return [];
      const userIds = members.map(m => m.user_id);
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds)
        .order('full_name');
      if (profilesError) throw profilesError;
      return (profiles || []).map(p => ({
        user_id: p.user_id,
        full_name: p.full_name || 'Sem nome',
      }));
    },
  });

  const handlePeriodChange = (periodType: 'monthly' | 'quarterly' | 'yearly') => {
    const now = new Date();
    let periodStart: Date;
    let periodEnd: Date;
    switch (periodType) {
      case 'quarterly':
        periodStart = startOfQuarter(now);
        periodEnd = endOfQuarter(now);
        break;
      case 'yearly':
        periodStart = startOfYear(now);
        periodEnd = endOfYear(now);
        break;
      default:
        periodStart = startOfMonth(now);
        periodEnd = endOfMonth(now);
    }
    onFiltersChange({ ...filters, periodType, periodStart, periodEnd });
  };

  const periodLabel = format(filters.periodStart, 'MMM yyyy', { locale: ptBR });
  const busy = !!(isFetching || isLoading);

  const handleRefresh = async () => {
    try {
      await onRefresh();
      toast.success('Forecast atualizado');
    } catch {
      toast.error('Erro ao atualizar forecast');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3 p-4 bg-card border border-border rounded-lg">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.periodType}
          onValueChange={(v) => handlePeriodChange(v as 'monthly' | 'quarterly' | 'yearly')}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="monthly">Mensal</SelectItem>
            <SelectItem value="quarterly">Trimestral</SelectItem>
            <SelectItem value="yearly">Anual</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground capitalize">{periodLabel}</span>
      </div>

      {/* Sprint F2.10 — Pipeline de vendas é resolvido automaticamente, não editável */}
      {salesPipelineLoading ? (
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-border bg-muted text-muted-foreground">
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          Pipeline de Vendas: carregando...
        </Badge>
      ) : salesPipelineMissing ? (
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-red-500/40 bg-red-500/10 text-red-600">
          <AlertTriangle className="h-3.5 w-3.5" />
          Pipeline de vendas não configurado
        </Badge>
      ) : (
        <Badge variant="outline" className="gap-1.5 px-3 py-1.5 border-emerald-500/30 bg-emerald-500/10 text-emerald-700">
          <Star className="h-3.5 w-3.5 fill-current" />
          Pipeline de Vendas: {salesPipelineName ?? '—'}
        </Badge>
      )}

      <Select
        value={filters.userId || 'all'}
        onValueChange={(v) => onFiltersChange({ ...filters, userId: v === 'all' ? undefined : v })}
      >
        <SelectTrigger className="w-[180px]">
          <SelectValue placeholder="Todos os vendedores" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os vendedores</SelectItem>
          {team?.map((m) => (
            <SelectItem key={m.user_id} value={m.user_id}>
              {m.full_name || 'Sem nome'}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="ml-auto flex items-center gap-2">
        {dataUpdatedAt ? (
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Atualizado {formatDistanceToNow(new Date(dataUpdatedAt), { addSuffix: true, locale: ptBR })}
          </span>
        ) : null}
        <Button variant="outline" size="icon" onClick={handleRefresh} disabled={busy}>
          <RefreshCw className={`h-4 w-4 ${busy ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
}
