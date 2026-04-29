import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Info } from 'lucide-react';
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
    <div className="flex items-center gap-2">
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
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Como o período se aplica"
            >
              <Info className="h-4 w-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <p className="text-xs">
              Central do Dia usa o dia atual. Pace Diário usa a meta mensal.
              Os demais indicadores respeitam o período selecionado quando aplicável.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
