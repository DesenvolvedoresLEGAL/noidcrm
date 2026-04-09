import { Badge } from '@/components/ui/badge';

interface Signal {
  signal_type: string;
  signal_value: string | null;
  source_provider: string | null;
  weight: number | null;
  confidence: number | null;
}

const typeLabels: Record<string, string> = {
  growth: '📈 Crescimento',
  tech: '💻 Tecnologia',
  pain: '🎯 Dor',
  industry: '🏭 Setor',
};

export function EnrichmentSignalsList({ signals }: { signals: Signal[] }) {
  if (!signals?.length) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sinais Detectados</h4>
      <div className="space-y-1.5">
        {signals.map((s, i) => (
          <div key={i} className="flex items-center justify-between text-xs p-2 rounded-md bg-muted/50">
            <div className="flex items-center gap-2">
              <span>{typeLabels[s.signal_type] || s.signal_type}</span>
              <span className="text-muted-foreground">{s.signal_value}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Badge variant="secondary" className="text-[10px] px-1.5">peso: {s.weight}</Badge>
              {s.confidence != null && (
                <Badge variant="outline" className="text-[10px] px-1.5">{Math.round((s.confidence as number) * 100)}%</Badge>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
