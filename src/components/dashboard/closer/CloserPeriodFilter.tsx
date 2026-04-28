import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CloserPeriodKey } from '@/types/dashboard/closer';

interface Props {
  value: CloserPeriodKey;
  onChange: (v: CloserPeriodKey) => void;
}

const OPTIONS: { value: CloserPeriodKey; label: string }[] = [
  { value: 'current_month', label: 'Mês atual' },
  { value: 'last_7_days', label: 'Últimos 7 dias' },
  { value: 'last_30_days', label: 'Últimos 30 dias' },
  { value: 'current_quarter', label: 'Trimestre atual' },
];

export function CloserPeriodFilter({ value, onChange }: Props) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as CloserPeriodKey)}>
      <SelectTrigger className="w-[200px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
