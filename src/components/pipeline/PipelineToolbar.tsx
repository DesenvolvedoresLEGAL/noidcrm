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
import { Plus, Search, Filter, X, User, Shield } from 'lucide-react';
import { Pipeline } from '@/services/crm/types';

interface PipelineToolbarProps {
  pipelines: Pipeline[];
  selectedPipelineId: string;
  onPipelineChange: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateClick: () => void;
  selectedUserId?: string;
  onUserFilterChange?: (userId: string) => void;
  users?: { id: string; name: string }[];
  hygieneFilter?: string;
  onHygieneFilterChange?: (filter: string) => void;
}

export function PipelineToolbar({
  pipelines,
  selectedPipelineId,
  onPipelineChange,
  searchQuery,
  onSearchChange,
  onCreateClick,
  selectedUserId,
  onUserFilterChange,
  users = [],
  hygieneFilter,
  onHygieneFilterChange,
}: PipelineToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-card border-b h-[48px]">
      {/* Search - Expanded */}
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por empresa, contato ou título..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9 h-9 bg-muted/50"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Advanced Filters */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">Filtros</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80" align="start">
          <div className="space-y-4">
            <h4 className="font-medium text-sm">Filtros Avançados</h4>
            <p className="text-xs text-muted-foreground">
              Em breve: filtros por temperatura, origem, probabilidade e data de fechamento.
            </p>
          </div>
        </PopoverContent>
      </Popover>

      {/* Hygiene Filter */}
      {onHygieneFilterChange && (
        <Select value={hygieneFilter || 'all'} onValueChange={(v) => onHygieneFilterChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[140px] h-9">
            <Shield className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Higiene" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="healthy">≥75 Saudável</SelectItem>
            <SelectItem value="risk">60-74 Em Risco</SelectItem>
            <SelectItem value="critical">&lt;60 Crítico</SelectItem>
          </SelectContent>
        </Select>
      )}

      {/* User Filter */}
      {users.length > 0 && onUserFilterChange && (
        <Select value={selectedUserId || 'all'} onValueChange={(v) => onUserFilterChange(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[160px] h-9">
            <User className="h-4 w-4 mr-2 text-muted-foreground" />
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {users.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Pipeline Selector */}
      <Select value={selectedPipelineId} onValueChange={onPipelineChange}>
        <SelectTrigger className="w-[180px] h-9 font-medium">
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

      {/* Create Button */}
      <Button
        onClick={onCreateClick}
        size="sm"
        className="h-9 gap-1.5 bg-primary hover:bg-primary/90"
      >
        <Plus className="h-4 w-4" />
        <span className="hidden sm:inline">Oportunidade</span>
      </Button>
    </div>
  );
}
