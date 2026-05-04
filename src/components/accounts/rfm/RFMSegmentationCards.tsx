import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RFM_SEGMENTS, RFM_SEGMENT_LABEL, type RFMSegmentRow, type RFMSegment } from '@/services/crm/account-rfm';

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(v || 0);

const SEGMENT_TONE: Record<RFMSegment, string> = {
  campeao: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  vip: 'bg-violet-500/10 text-violet-600 border-violet-500/30',
  leal: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  promissor: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
  novo_cliente: 'bg-teal-500/10 text-teal-600 border-teal-500/30',
  precisa_atencao: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30',
  em_risco: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
  hibernando: 'bg-slate-500/10 text-slate-600 border-slate-500/30',
  perdido: 'bg-red-500/10 text-red-600 border-red-500/30',
};

interface Props {
  segments: RFMSegmentRow[] | undefined;
  onSegmentClick?: (s: RFMSegment) => void;
}

export function RFMSegmentationCards({ segments, onSegmentClick }: Props) {
  const map = new Map<RFMSegment, RFMSegmentRow>();
  (segments || []).forEach((s) => map.set(s.segment, s));

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {RFM_SEGMENTS.map((seg) => {
        const row = map.get(seg);
        return (
          <Card
            key={seg}
            className={onSegmentClick ? 'cursor-pointer hover:shadow-md transition-shadow' : undefined}
            onClick={onSegmentClick ? () => onSegmentClick(seg) : undefined}
          >
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">{RFM_SEGMENT_LABEL[seg]}</CardTitle>
                <Badge variant="outline" className={SEGMENT_TONE[seg]}>
                  {row?.count ?? 0}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Receita</span>
                <span className="font-medium">{fmtBRL(row?.revenue ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Ticket médio</span>
                <span className="font-medium">{fmtBRL(row?.avg_ticket ?? 0)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">% da carteira</span>
                <span className="font-medium">{(row?.percent ?? 0).toFixed(1)}%</span>
              </div>
              <div className="pt-2 border-t mt-2 text-xs text-muted-foreground">
                {row?.action ?? '—'}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
