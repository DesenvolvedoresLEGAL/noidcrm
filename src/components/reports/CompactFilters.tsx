import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { formatDateBR } from '@/lib/dateUtils';

interface CompactFiltersProps {
  filters: {
    pipelines: string[];
    users: string;
    period: string;
    startDate: string;
    endDate: string;
  };
  availablePipelines: Array<{ id: string; name: string; }>;
  availableUsers: Array<{ id: string; name: string; }>;
  onFiltersChange: (filters: any) => void;
  onTogglePipeline: (pipelineId: string) => void;
  loading?: boolean;
}

export function CompactFilters({ 
  filters, 
  availablePipelines,
  availableUsers, 
  onFiltersChange, 
  onTogglePipeline,
  loading = false 
}: CompactFiltersProps) {
  
  const formatDateRange = () => {
    if (!filters.startDate || !filters.endDate) return 'Selecione um período';
    
    const start = formatDateBR(filters.startDate);
    const end = formatDateBR(filters.endDate);
    
    // Calculate comparative period (same interval, 1 month before)
    const startDate = new Date(filters.startDate);
    const endDate = new Date(filters.endDate);
    const diffDays = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    const compStart = new Date(startDate);
    compStart.setMonth(compStart.getMonth() - 1);
    
    const compEnd = new Date(compStart);
    compEnd.setDate(compEnd.getDate() + diffDays);
    
    const compStartStr = formatDateBR(compStart);
    const compEndStr = formatDateBR(compEnd);
    
    return `Período filtrado: ${start} até ${end} • Período comparativo: ${compStartStr} até ${compEndStr}`;
  };
  
  if (loading) {
    return (
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-2 px-4 md:px-6 py-3">
          <Filter className="h-4 w-4 text-muted-foreground animate-pulse" />
          <span className="text-sm text-muted-foreground">Carregando filtros...</span>
        </div>
      </div>
    );
  }
  
  return (
    <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Main filter row */}
      <div className="flex flex-col lg:flex-row lg:items-center gap-3 px-4 md:px-6 py-3">
        {/* Filter label */}
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground min-w-fit">
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline">Filtros:</span>
        </div>

        {/* Pipelines */}
        <div className="flex items-center gap-2 flex-wrap lg:flex-nowrap overflow-x-auto scrollbar-hide">
          {availablePipelines.length === 0 ? (
            <span className="text-sm text-muted-foreground italic">
              Nenhum pipeline encontrado
            </span>
          ) : (
            availablePipelines.map(pipeline => (
              <Badge
                key={pipeline.id}
                variant={filters.pipelines.includes(pipeline.id) ? "default" : "outline"}
                className="cursor-pointer hover:opacity-80 transition-opacity text-xs px-2 py-1 whitespace-nowrap"
                onClick={() => onTogglePipeline(pipeline.id)}
              >
                {pipeline.name}
                {filters.pipelines.includes(pipeline.id) && (
                  <X className="ml-1 h-3 w-3" />
                )}
              </Badge>
            ))
          )}
        </div>

        {/* Selects and button */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 lg:ml-auto">
          <Select
            value={filters.users}
            onValueChange={(value) => onFiltersChange({ ...filters, users: value })}
          >
            <SelectTrigger className="h-9 w-full sm:w-[200px] text-sm">
              <SelectValue placeholder="Usuários" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os usuários</SelectItem>
              {availableUsers.map(user => (
                <SelectItem key={user.id} value={user.id}>
                  {user.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.period}
            onValueChange={(value) => onFiltersChange({ ...filters, period: value })}
          >
            <SelectTrigger className="h-9 w-full sm:w-[180px] text-sm">
              <SelectValue placeholder="Período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="this-week">Esta semana</SelectItem>
              <SelectItem value="last-week">Semana passada</SelectItem>
              <SelectItem value="this-month">Este mês</SelectItem>
              <SelectItem value="last-month">Mês passado</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>

          <Button size="sm" className="h-9 whitespace-nowrap">
            Gerar relatório
          </Button>
        </div>
      </div>

      {/* Custom date inputs */}
      {filters.period === 'custom' && (
        <div className="px-4 md:px-6 pb-3 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground min-w-fit">Datas personalizadas:</span>
            <Input
              type="date"
              value={filters.startDate}
              onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
              className="h-9 w-full sm:w-[160px] text-sm"
            />
            <span className="hidden sm:inline text-xs text-muted-foreground">até</span>
            <Input
              type="date"
              value={filters.endDate}
              onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
              className="h-9 w-full sm:w-[160px] text-sm"
            />
          </div>
        </div>
      )}

      {/* Period info */}
      <div className="px-4 md:px-6 py-2 bg-muted/30 text-xs text-muted-foreground border-t">
        {formatDateRange()}
      </div>
    </div>
  );
}
