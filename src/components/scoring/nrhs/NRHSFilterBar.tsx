// Sprint NRHS 1.5.1 — barra visual de filtros do Revenue Hygiene Dashboard.
// Consome filterOptions vindos do RPC get_nrhs_analytics.

import { Filter, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { NRHSFilters } from '@/hooks/useNRHSAnalytics';
import type { NRHSFilterOptions } from '@/services/crm/nrhs-analytics';
import type { NRHSTier } from '@/services/crm/nrhs-calculator';

interface Props {
  filters: NRHSFilters;
  options: NRHSFilterOptions | null;
  onChange: (next: NRHSFilters) => void;
  onClear: () => void;
}

const TIER_LABEL: Record<NRHSTier, string> = {
  elite: 'Elite (90+)',
  healthy: 'Saudável (75-89)',
  risk: 'Em risco (50-74)',
  critical: 'Crítico (25-49)',
  insalubrious: 'Insalubre (<25)',
};

const ALL = '__all__';

export function NRHSFilterBar({ filters, options, onChange, onClear }: Props) {
  const pipelineOptions = options?.pipelineOptions ?? [];
  const ownerOptions = (options?.ownerOptions ?? []).filter(
    (o) => filters.showInactive || !o.isInactive,
  );
  const stageOptions = (options?.stageOptions ?? []).filter(
    (s) => !filters.pipelineId || s.pipelineId === filters.pipelineId,
  );

  const set = (patch: Partial<NRHSFilters>) => onChange({ ...filters, ...patch });

  const activeCount = [
    filters.tier, filters.ownerId, filters.stageId, filters.pipelineId,
    filters.hasBlocker, filters.showInactive, filters.search,
  ].filter((v) => v !== undefined && v !== null && v !== '' && v !== false).length;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filtros</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">{activeCount} ativo{activeCount !== 1 ? 's' : ''}</Badge>
          )}
          <Badge variant="outline" className="text-[10px] text-muted-foreground">
            Escopo: {options?.appliedScope ?? 'comercial'}
          </Badge>
        </div>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onClear}>
            <X className="h-3 w-3 mr-1" /> Limpar
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Pipeline</Label>
          <Select
            value={filters.pipelineId ?? ALL}
            onValueChange={(v) => set({ pipelineId: v === ALL ? undefined : v, stageId: undefined })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos comerciais" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos comerciais</SelectItem>
              {pipelineOptions.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}{p.pipelineType ? ` · ${p.pipelineType}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Estágio</Label>
          <Select
            value={filters.stageId ?? ALL}
            onValueChange={(v) => set({ stageId: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos os estágios" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os estágios</SelectItem>
              {stageOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Responsável</Label>
          <Select
            value={filters.ownerId ?? ALL}
            onValueChange={(v) => set({ ownerId: v === ALL ? undefined : v })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Todos responsáveis" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos responsáveis</SelectItem>
              {ownerOptions.map((o) => (
                <SelectItem key={o.userId} value={o.userId}>
                  {o.fullName}{o.isInactive ? ' (inativo)' : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">Faixa NRHS</Label>
          <Select
            value={(filters.tier as string) ?? ALL}
            onValueChange={(v) => set({ tier: v === ALL ? undefined : (v as NRHSTier) })}
          >
            <SelectTrigger className="h-9"><SelectValue placeholder="Todas as faixas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as faixas</SelectItem>
              {(Object.keys(TIER_LABEL) as NRHSTier[]).map((t) => (
                <SelectItem key={t} value={t}>{TIER_LABEL[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 pt-1">
        <div className="flex items-center gap-2">
          <Switch
            id="nrhs-show-inactive"
            checked={!!filters.showInactive}
            onCheckedChange={(v) => set({ showInactive: v })}
          />
          <Label htmlFor="nrhs-show-inactive" className="text-xs">Mostrar inativos</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="nrhs-only-blockers"
            checked={!!filters.hasBlocker}
            onCheckedChange={(v) => set({ hasBlocker: v ? true : undefined })}
          />
          <Label htmlFor="nrhs-only-blockers" className="text-xs">Somente com blockers</Label>
        </div>
      </div>
    </div>
  );
}
