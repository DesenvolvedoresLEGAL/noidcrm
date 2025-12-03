import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Plus, Search, Filter, LayoutGrid, List, X } from 'lucide-react';
import { Pipeline } from '@/services/crm/types';

interface PipelineHeaderProps {
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onPipelineChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateClick: () => void;
  totalOpportunities: number;
  totalValue: number;
  totalMRR: number;
}

export function PipelineHeader({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
  searchQuery,
  onSearchChange,
  onCreateClick,
  totalOpportunities,
  totalValue,
  totalMRR,
}: PipelineHeaderProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1000000) {
      return `R$ ${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `R$ ${(value / 1000).toFixed(0)}K`;
    }
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-card border-b">
      {/* Pipeline Selector */}
      <Select value={selectedPipelineId} onValueChange={onPipelineChange}>
        <SelectTrigger className="w-[180px] h-9 font-semibold">
          <SelectValue placeholder="Selecione o funil" />
        </SelectTrigger>
        <SelectContent>
          {pipelines.map((pipeline) => (
            <SelectItem key={pipeline.id} value={pipeline.id}>
              {pipeline.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-8 h-9"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Filters Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Filter className="h-4 w-4" />
            Filtros
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="end">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Filtros Avançados</h4>
            <p className="text-xs text-muted-foreground">
              Em breve: filtros por vendedor, temperatura, origem e tags.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Spacer */}
      <div className="flex-1" />

      {/* KPIs inline */}
      <div className="hidden md:flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Deals:</span>
          <span className="font-bold text-foreground">{totalOpportunities}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">P&S:</span>
          <span className="font-bold text-primary">{formatCurrency(totalValue)}</span>
        </div>
        {totalMRR > 0 && (
          <>
            <div className="h-4 w-px bg-border" />
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground">MRR:</span>
              <span className="font-bold text-accent">{formatCurrency(totalMRR)}</span>
            </div>
          </>
        )}
      </div>

      {/* Create Button */}
      <Button
        onClick={onCreateClick}
        size="sm"
        className="h-9 gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Oportunidade</span>
      </Button>
    </div>
  );
}
