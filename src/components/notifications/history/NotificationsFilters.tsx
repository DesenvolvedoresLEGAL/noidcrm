import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Search, X, RotateCcw } from 'lucide-react';
import {
  HistoryFilters,
  HistoryStatus,
  HistoryPeriod,
  DEFAULT_FILTERS,
} from '@/hooks/useNotificationsHistory';
import type { InboxCategory, InboxPriority, InboxSource } from '@/hooks/useUnifiedInbox';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Props {
  filters: HistoryFilters;
  onChange: (next: HistoryFilters) => void;
  totalShown: number;
  totalAll: number;
}

const PERIODS: { value: HistoryPeriod; label: string }[] = [
  { value: 'today', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: '90d', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo o histórico' },
];

const STATUS_OPTIONS: { value: HistoryStatus; label: string }[] = [
  { value: 'unread', label: 'Não lidas' },
  { value: 'read', label: 'Lidas' },
  { value: 'snoozed', label: 'Adiadas' },
  { value: 'dismissed', label: 'Dispensadas' },
];

const CATEGORY_OPTIONS: { value: InboxCategory; label: string }[] = [
  { value: 'priority', label: 'Prioridade (crítico/alta)' },
  { value: 'activities', label: 'Atividades' },
  { value: 'proposals', label: 'Propostas' },
  { value: 'conversations', label: 'Conversas' },
  { value: 'news', label: 'Novidades' },
];

const PRIORITY_OPTIONS: { value: InboxPriority; label: string; color: string }[] = [
  { value: 'critical', label: 'Crítico', color: 'bg-destructive' },
  { value: 'high', label: 'Alta', color: 'bg-orange-500' },
  { value: 'medium', label: 'Média', color: 'bg-primary' },
  { value: 'low', label: 'Baixa', color: 'bg-muted-foreground' },
];

const SOURCE_OPTIONS: { value: InboxSource; label: string }[] = [
  { value: 'v2', label: 'Sistema PRIME' },
  { value: 'v1', label: 'Legado' },
  { value: 'release_note', label: 'Novidades' },
];

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export function NotificationsFilters({ filters, onChange, totalShown, totalAll }: Props) {
  const isFiltered =
    filters.search !== DEFAULT_FILTERS.search ||
    filters.period !== DEFAULT_FILTERS.period ||
    filters.status.length !== DEFAULT_FILTERS.status.length ||
    filters.categories.length !== DEFAULT_FILTERS.categories.length ||
    filters.priorities.length !== DEFAULT_FILTERS.priorities.length ||
    filters.sources.length !== DEFAULT_FILTERS.sources.length;

  return (
    <div className="flex flex-col h-full min-w-0">
      <div className="px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-semibold tracking-tight">Filtros</h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {totalShown} de {totalAll} no período
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="px-4 py-4 space-y-5 pr-5">
          {/* Search */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Buscar
            </Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Título ou mensagem..."
                value={filters.search}
                onChange={(e) => onChange({ ...filters, search: e.target.value })}
                className="pl-8 pr-8 h-9 text-sm"
              />
              {filters.search && (
                <button
                  onClick={() => onChange({ ...filters, search: '' })}
                  className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <Separator />

          {/* Period */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Período
            </Label>
            <div className="space-y-1.5">
              {PERIODS.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-2 cursor-pointer text-sm hover:text-primary"
                >
                  <input
                    type="radio"
                    name="period"
                    checked={filters.period === p.value}
                    onChange={() => onChange({ ...filters, period: p.value })}
                    className="h-3.5 w-3.5 accent-primary"
                  />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Status */}
          <FilterGroup
            label="Status"
            options={STATUS_OPTIONS}
            selected={filters.status}
            onToggle={(v) => onChange({ ...filters, status: toggle(filters.status, v) })}
          />

          <Separator />

          {/* Category */}
          <FilterGroup
            label="Categoria"
            options={CATEGORY_OPTIONS}
            selected={filters.categories}
            onToggle={(v) =>
              onChange({ ...filters, categories: toggle(filters.categories, v) })
            }
          />

          <Separator />

          {/* Priority */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Prioridade
            </Label>
            <div className="space-y-1.5">
              {PRIORITY_OPTIONS.map((p) => (
                <label key={p.value} className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={filters.priorities.includes(p.value)}
                    onCheckedChange={() =>
                      onChange({ ...filters, priorities: toggle(filters.priorities, p.value) })
                    }
                  />
                  <span className={`inline-block h-2 w-2 rounded-full ${p.color}`} />
                  {p.label}
                </label>
              ))}
            </div>
          </div>

          <Separator />

          {/* Source */}
          <FilterGroup
            label="Origem"
            options={SOURCE_OPTIONS}
            selected={filters.sources}
            onToggle={(v) => onChange({ ...filters, sources: toggle(filters.sources, v) })}
          />
        </div>
      </ScrollArea>

      <div className="border-t p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          disabled={!isFiltered}
          onClick={() => onChange(DEFAULT_FILTERS)}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      </div>
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  selected: T[];
  onToggle: (v: T) => void;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        {label}
      </Label>
      <div className="space-y-1.5">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox
              checked={selected.includes(o.value)}
              onCheckedChange={() => onToggle(o.value)}
            />
            {o.label}
          </label>
        ))}
      </div>
    </div>
  );
}
