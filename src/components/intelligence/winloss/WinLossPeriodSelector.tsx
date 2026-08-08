import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComp } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Calendar, ChevronLeft, ChevronRight, GitCompareArrows, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useWinLossPeriod } from '@/contexts/WinLossPeriodContext';
import {
  COMPARISON_LABELS, PERIOD_LABELS, PERIOD_LABELS_LONG, compactRangeLabel, fullDate,
  type WinLossPeriodType, type WinLossComparisonMode,
} from '@/lib/winloss/period';
import type { DateRange as DayPickerRange } from 'react-day-picker';

const PERIOD_ORDER: WinLossPeriodType[] = ['today', '7d', '15d', 'month', 'quarter', 'semester', 'year'];
const COMPARE_ORDER: WinLossComparisonMode[] = ['none', 'previous_period', 'previous_year', 'custom'];

function CustomRangePicker({
  onApply,
  label,
}: {
  onApply: (start: Date, end: Date) => void;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [selection, setSelection] = useState<DayPickerRange | undefined>();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarComp
          mode="range"
          selected={selection}
          onSelect={setSelection}
          numberOfMonths={1}
          initialFocus
          className={cn('p-3 pointer-events-auto')}
        />
        <div className="flex items-center justify-end gap-2 border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => setSelection(undefined)}>Limpar</Button>
          <Button
            size="sm"
            disabled={!selection?.from || !selection?.to}
            onClick={() => {
              if (selection?.from && selection?.to) {
                onApply(selection.from, selection.to);
                setOpen(false);
              }
            }}
          >
            Aplicar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function PeriodControls({ compact }: { compact?: boolean }) {
  const {
    periodType, range, comparisonMode, comparisonRange, isNavigablePeriod,
    canGoForward, setPeriodType, setCustomRange, navigate, goToCurrent,
    setComparisonMode, setCustomComparison,
  } = useWinLossPeriod();

  return (
    <div className={cn('flex gap-3', compact ? 'flex-col' : 'flex-col xl:flex-row xl:items-center')}>
      {/* Presets */}
      <div className="flex items-center gap-2 overflow-x-auto">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <ToggleGroup
          type="single"
          value={periodType}
          onValueChange={(val) => val && setPeriodType(val as WinLossPeriodType)}
          className="justify-start flex-wrap"
        >
          {PERIOD_ORDER.map((p) => (
            <ToggleGroupItem key={p} value={p} className="text-xs px-2.5 h-8">
              {compact ? PERIOD_LABELS_LONG[p] : PERIOD_LABELS[p]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <CustomRangePicker
          label={periodType === 'custom' ? `${fullDate(range.start)} – ${fullDate(range.end)}` : 'Personalizado'}
          onApply={setCustomRange}
        />
      </div>

      {/* Navegação histórica */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!isNavigablePeriod}
          onClick={() => navigate(-1)}
          aria-label="Período anterior"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Badge variant="secondary" className="h-8 px-3 text-xs font-medium whitespace-nowrap">
          {compact ? compactRangeLabel(range) : range.label}
        </Badge>
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8"
          disabled={!isNavigablePeriod || !canGoForward}
          onClick={() => navigate(1)}
          aria-label="Próximo período"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        {isNavigablePeriod && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={goToCurrent}
            aria-label="Voltar ao período atual"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Atual
          </Button>
        )}
      </div>

      {/* Comparação */}
      <div className="flex items-center gap-2">
        <GitCompareArrows className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select value={comparisonMode} onValueChange={(v) => setComparisonMode(v as WinLossComparisonMode)}>
          <SelectTrigger className="h-8 w-full sm:w-[230px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COMPARE_ORDER.map((m) => (
              <SelectItem key={m} value={m} className="text-xs">{COMPARISON_LABELS[m]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {comparisonMode === 'custom' && (
          <CustomRangePicker
            label={comparisonRange ? `${fullDate(comparisonRange.start)} – ${fullDate(comparisonRange.end)}` : 'Escolher'}
            onApply={setCustomComparison}
          />
        )}
      </div>

      {comparisonRange && (
        <p className="text-[11px] text-muted-foreground whitespace-nowrap">
          vs {comparisonRange.label}
        </p>
      )}
    </div>
  );
}

export function WinLossPeriodSelector() {
  const isMobile = useIsMobile();
  const { range, comparisonRange } = useWinLossPeriod();

  if (!isMobile) return <PeriodControls />;

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 w-full justify-between text-xs">
          <span className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5" />
            {compactRangeLabel(range)}
          </span>
          {comparisonRange && <Badge variant="secondary" className="text-[10px]">vs {compactRangeLabel(comparisonRange)}</Badge>}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="text-base">Período e comparação</DrawerTitle>
        </DrawerHeader>
        <div className="p-4 pb-8">
          <PeriodControls compact />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
