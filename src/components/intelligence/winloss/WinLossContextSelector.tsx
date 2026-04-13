import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, GitBranch } from 'lucide-react';
import { type TimeframePreset } from '@/hooks/useWinLossData';
import { type Pipeline } from '@/services/supabase/pipelines';

interface WinLossContextSelectorProps {
  pipelines: Pipeline[];
  selectedPipelineId: string | null;
  onPipelineChange: (id: string | null) => void;
  timeframe: TimeframePreset;
  onTimeframeChange: (t: TimeframePreset) => void;
}

const PIPELINE_TYPE_LABELS: Record<string, string> = {
  sales: 'Vendas',
  qualification: 'Pré-Vendas',
  onboarding: 'Operacional',
  renewal: 'Renovação',
  cs: 'CS',
};

const PIPELINE_TYPE_COLORS: Record<string, string> = {
  sales: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  qualification: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
  onboarding: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  renewal: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
};

export function WinLossContextSelector({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
  timeframe,
  onTimeframeChange,
}: WinLossContextSelectorProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4 rounded-lg border bg-card">
      {/* Pipeline Selector */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={selectedPipelineId || 'all'}
          onValueChange={(val) => onPipelineChange(val === 'all' ? null : val)}
        >
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder="Todos os pipelines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Todos os Pipelines
              </span>
            </SelectItem>
            {pipelines.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="flex items-center gap-2">
                  {p.name}
                  {p.pipeline_type && (
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 ${PIPELINE_TYPE_COLORS[p.pipeline_type] || ''}`}
                    >
                      {PIPELINE_TYPE_LABELS[p.pipeline_type] || p.pipeline_type}
                    </Badge>
                  )}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Timeframe Selector */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
        <ToggleGroup
          type="single"
          value={timeframe}
          onValueChange={(val) => val && onTimeframeChange(val as TimeframePreset)}
          className="justify-start"
        >
          <ToggleGroupItem value="month" className="text-xs px-2.5 h-8">Mês</ToggleGroupItem>
          <ToggleGroupItem value="quarter" className="text-xs px-2.5 h-8">Trimestre</ToggleGroupItem>
          <ToggleGroupItem value="semester" className="text-xs px-2.5 h-8">Semestre</ToggleGroupItem>
          <ToggleGroupItem value="year" className="text-xs px-2.5 h-8">Ano</ToggleGroupItem>
        </ToggleGroup>
      </div>
    </div>
  );
}
