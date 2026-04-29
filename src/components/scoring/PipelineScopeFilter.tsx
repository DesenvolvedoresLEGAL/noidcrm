// Sprint Scoring 1.3 — Pipeline scope filter for the Scoring screen.
// Lists real pipelines (no hardcoded ids), groups by pipeline_type, and
// supports an "all" selection. Reused across Lead, Opportunity and NRHS tabs.

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';

interface Props {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
  placeholder?: string;
  /** Restrict choices to a specific pipeline_type (eg. 'sales'). */
  onlyType?: string;
}

const TYPE_LABEL: Record<string, string> = {
  sales: 'Vendas',
  qualification: 'Pré-Vendas',
  onboarding: 'Operacional / Onboarding',
  renewal: 'Expansão / Renovação',
};

export function PipelineScopeFilter({ value, onChange, className, placeholder = 'Pipeline', onlyType }: Props) {
  const { pipelines, loading } = useOrganizationPipelines();

  const grouped = useMemo(() => {
    const visible = pipelines.filter((p) => !onlyType || (p as any).pipeline_type === onlyType);
    const groups = new Map<string, typeof visible>();
    for (const p of visible) {
      const t = (p as any).pipeline_type ?? 'other';
      if (!groups.has(t)) groups.set(t, [] as any);
      (groups.get(t) as any).push(p);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [pipelines, onlyType]);

  return (
    <Select
      value={value ?? '__all__'}
      onValueChange={(v) => onChange(v === '__all__' ? null : v)}
      disabled={loading}
    >
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[400px]">
        <SelectItem value="__all__">Todos os pipelines</SelectItem>
        {grouped.map(([type, items]) => (
          <SelectGroup key={type}>
            <SelectLabel>{TYPE_LABEL[type] ?? type}</SelectLabel>
            {items.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
