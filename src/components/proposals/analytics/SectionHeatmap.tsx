import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface SectionHeatmapProps {
  sections: Record<string, number>;
  className?: string;
}

const sectionLabels: Record<string, string> = {
  introduction: 'Introdução',
  items: 'Itens/Produtos',
  pricing: 'Preços',
  payment: 'Pagamento',
  terms: 'Termos',
  notes: 'Notas',
};

export function SectionHeatmap({ sections, className }: SectionHeatmapProps) {
  const totalTime = Object.values(sections).reduce((a, b) => a + b, 0);
  
  if (totalTime === 0) {
    return (
      <div className={cn('p-4 rounded-xl bg-muted/30 border', className)}>
        <div className="flex items-center gap-2 mb-3">
          <Flame className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">Mapa de Atenção</span>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          Dados de engajamento indisponíveis
        </p>
      </div>
    );
  }

  const sortedSections = Object.entries(sections)
    .map(([key, time]) => ({
      key,
      label: sectionLabels[key] || key,
      time,
      percentage: Math.round((time / totalTime) * 100),
    }))
    .sort((a, b) => b.percentage - a.percentage);

  const maxPercentage = Math.max(...sortedSections.map(s => s.percentage));
  const focusSection = sortedSections[0];

  const getHeatColor = (percentage: number) => {
    const intensity = percentage / maxPercentage;
    if (intensity >= 0.8) return 'bg-red-500';
    if (intensity >= 0.6) return 'bg-orange-500';
    if (intensity >= 0.4) return 'bg-amber-500';
    if (intensity >= 0.2) return 'bg-yellow-500';
    return 'bg-slate-300';
  };

  return (
    <div className={cn('p-4 rounded-xl bg-muted/30 border', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium">Mapa de Atenção</span>
        </div>
        {focusSection && focusSection.percentage >= 40 && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-500 font-medium">
            🔥 Foco: {focusSection.label}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {sortedSections.map(({ key, label, percentage }) => (
          <div key={key}>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="font-medium">{label}</span>
              <span className="text-muted-foreground">{percentage}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  getHeatColor(percentage)
                )}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-4 pt-3 border-t border-muted">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-[10px] text-muted-foreground">Alto</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500" />
          <span className="text-[10px] text-muted-foreground">Médio</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-slate-300" />
          <span className="text-[10px] text-muted-foreground">Baixo</span>
        </div>
      </div>
    </div>
  );
}
