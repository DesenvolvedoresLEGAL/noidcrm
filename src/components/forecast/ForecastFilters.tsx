import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Calendar, RefreshCw, Filter } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ForecastFilters as FilterType } from '@/hooks/useForecastData';

interface ForecastFiltersProps {
  filters: FilterType;
  onFiltersChange: (filters: FilterType) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export function ForecastFilters({ filters, onFiltersChange, onRefresh, isLoading }: ForecastFiltersProps) {
  // Fetch sales and renewal pipelines (pós-vendas)
  const { data: pipelines } = useQuery({
    queryKey: ['forecast-pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('id, name, pipeline_type')
        .in('pipeline_type', ['sales', 'renewal'])
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch team members - ONLY sales and CS roles
  const { data: team } = useQuery({
    queryKey: ['team-members-sales-cs'],
    queryFn: async () => {
      const { data: orgData } = await supabase.rpc('get_user_organization_id');
      if (!orgData) return [];

      const { data, error } = await supabase
        .from('organization_members')
        .select(`
          user_id,
          org_role,
          profiles!inner(user_id, full_name)
        `)
        .eq('organization_id', orgData)
        .in('org_role', ['sales', 'cs'])
        .order('profiles(full_name)');

      if (error) throw error;
      
      return (data || []).map(m => ({
        user_id: m.user_id,
        full_name: (m.profiles as any)?.full_name || 'Sem nome'
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

      <div className="flex items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select
          value={filters.pipelineId || 'all'}
          onValueChange={(v) => onFiltersChange({ ...filters, pipelineId: v === 'all' ? undefined : v })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Todos os pipelines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os pipelines</SelectItem>
            {pipelines?.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

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

      <Button
        variant="outline"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        className="ml-auto"
      >
        <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
      </Button>
    </div>
  );
}
