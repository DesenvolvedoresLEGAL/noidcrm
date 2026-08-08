import { useMemo } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Filter, GitBranch } from 'lucide-react';
import { type Pipeline } from '@/services/supabase/pipelines';
import { WinLossPeriodSelector } from './WinLossPeriodSelector';

interface WinLossContextSelectorProps {
  pipelines: Pipeline[];
  selectedPipelineId: string | null;
  onPipelineChange: (id: string | null) => void;
}

const PIPELINE_TYPE_LABELS: Record<string, string> = {
  sales: 'Vendas',
  qualification: 'Pré-Vendas',
};

const PIPELINE_TYPE_COLORS: Record<string, string> = {
  sales: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
  qualification: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
};

// Win/Loss é inteligência comercial — somente pipelines comerciais aparecem aqui.
const ALLOWED_TYPES = new Set(['sales', 'qualification']);

export function WinLossContextSelector({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
}: WinLossContextSelectorProps) {
  const commercialPipelines = useMemo(
    () => pipelines.filter((p) => p.pipeline_type && ALLOWED_TYPES.has(p.pipeline_type)),
    [pipelines],
  );

  return (
    <div className="flex flex-col gap-3 p-4 rounded-lg border bg-card">
      {/* Pipeline Selector */}
      <div className="flex items-center gap-2 min-w-0">
        <GitBranch className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={selectedPipelineId || 'all'}
          onValueChange={(val) => onPipelineChange(val === 'all' ? null : val)}
        >
          <SelectTrigger className="w-full sm:w-[260px]">
            <SelectValue placeholder="Pré-Vendas + Vendas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <span className="flex items-center gap-2">
                <Filter className="h-3.5 w-3.5" />
                Todos (Pré-Vendas + Vendas)
              </span>
            </SelectItem>
            {commercialPipelines.map((p) => (
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

      {/* Período, navegação histórica e comparação (SSoT via URL) */}
      <WinLossPeriodSelector />
    </div>
  );
}
