import { useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ForecastOpportunity } from '@/hooks/useForecastData';
import { ArrowUpDown, ExternalLink, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateShortBR, parseDateOnly } from '@/lib/dateUtils';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  subtitle: string;
  opportunities: ForecastOpportunity[];
  accentColor: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type SortKey = 'value' | 'date' | 'days';

export function ForecastRiskDetailSheet({
  open,
  onOpenChange,
  title,
  subtitle,
  opportunities,
  accentColor,
}: Props) {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('value');

  const total = opportunities.reduce((sum, o) => sum + o.valor_previsto, 0);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = opportunities;
    if (q) {
      list = list.filter(
        (o) =>
          o.title.toLowerCase().includes(q) ||
          o.owner_name.toLowerCase().includes(q) ||
          o.account_name.toLowerCase().includes(q),
      );
    }
    const sorted = [...list];
    if (sortBy === 'value') {
      sorted.sort((a, b) => b.valor_previsto - a.valor_previsto);
    } else if (sortBy === 'date') {
      sorted.sort((a, b) => {
        const da = a.close_date_prevista ? parseDateOnly(a.close_date_prevista).getTime() : Infinity;
        const db = b.close_date_prevista ? parseDateOnly(b.close_date_prevista).getTime() : Infinity;
        return da - db;
      });
    } else {
      sorted.sort((a, b) => b.days_since_activity - a.days_since_activity);
    }
    return sorted;
  }, [opportunities, search, sortBy]);

  const cycleSort = () => {
    setSortBy((s) => (s === 'value' ? 'date' : s === 'date' ? 'days' : 'value'));
  };

  const sortLabel = sortBy === 'value' ? 'Valor' : sortBy === 'date' ? 'Close date' : 'Dias parado';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className={cn('flex items-center gap-2', accentColor)}>
            {title}
          </SheetTitle>
          <SheetDescription>
            {subtitle} · {opportunities.length} deals · {formatCurrency(total)}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 mt-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar título, vendedor ou conta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Button variant="outline" size="sm" onClick={cycleSort} className="gap-1.5 h-9">
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortLabel}
          </Button>
        </div>

        <div className="space-y-2 mt-4">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum deal encontrado
            </p>
          ) : (
            filtered.map((opp) => (
              <div
                key={opp.id}
                className="border border-border rounded-lg p-3 hover:bg-muted/50 transition-colors cursor-pointer group"
                onClick={() => navigate(`/app/pipeline?opp=${opp.id}`)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{opp.title}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{opp.account_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opp.owner_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-sm">{formatCurrency(opp.valor_previsto)}</p>
                    {opp.close_date_prevista && (
                      <p className="text-xs text-muted-foreground">
                        {formatDateShortBR(opp.close_date_prevista)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-[10px]">
                    {opp.stage_name}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {opp.days_since_activity >= 999 ? 'Sem atividade' : `${opp.days_since_activity}d sem atividade`}
                  </Badge>
                  {opp.nrhs_score !== null && (
                    <Badge variant="outline" className="text-[10px]">
                      NRHS {opp.nrhs_score}
                    </Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
