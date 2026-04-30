import { useEffect } from 'react';
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
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
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
  // Sprint Active Users SoT: limpar filtro salvo se o usuário não está mais ativo.
  useEffect(() => {
    if (!selectedUserId || !onUserFilterChange || users.length === 0) return;
    const exists = users.some((u) => u.id === selectedUserId);
    if (!exists) {
      onUserFilterChange('');
      toast.info('Filtro de vendedor foi limpo (usuário não está mais ativo).');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUserId, users]);

  return (
    <div className="flex flex-col md:flex-row md:items-center gap-2 px-3 md:px-4 py-2 bg-card border-b md:h-[48px]">
      {/* Row 1 mobile: Search + Create */}
      <div className="flex items-center gap-2 w-full md:w-auto md:flex-1">
        <div className="relative flex-1 min-w-0 md:max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
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

        {/* Create Button */}
        <Button
          onClick={onCreateClick}
          size="sm"
          className="h-9 gap-1.5 bg-primary hover:bg-primary/90 shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Oportunidade</span>
        </Button>
      </div>

      {/* Row 2 mobile: Filters + Pipeline */}
      <div className="flex items-center gap-2 overflow-x-auto md:overflow-visible pb-1 md:pb-0 -mb-1 md:mb-0 scrollbar-none">
        {/* Pipeline Selector */}
        <Select value={selectedPipelineId} onValueChange={onPipelineChange}>
          <SelectTrigger className="w-[140px] md:w-[180px] h-9 font-medium shrink-0">
            <SelectValue placeholder="Funil" />
          </SelectTrigger>
          <SelectContent>
            {pipelines.map((pipeline) => (
              <SelectItem key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Advanced Filters */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 shrink-0">
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filtros</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Filtros Avançados</h4>

              {/* Hygiene Filter inside popover on mobile */}
              {onHygieneFilterChange && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Higiene</Label>
                  <Select value={hygieneFilter || 'all'} onValueChange={(v) => onHygieneFilterChange(v === 'all' ? '' : v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Higiene" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="healthy">≥75 Saudável</SelectItem>
                      <SelectItem value="risk">60-74 Em Risco</SelectItem>
                      <SelectItem value="critical">&lt;60 Crítico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* User Filter inside popover on mobile */}
              {users.length > 0 && onUserFilterChange && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Vendedor</Label>
                  <Select value={selectedUserId || 'all'} onValueChange={(v) => onUserFilterChange(v === 'all' ? '' : v)}>
                    <SelectTrigger className="h-9">
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
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                Em breve: filtros por temperatura, origem, probabilidade e data de fechamento.
              </p>
            </div>
          </PopoverContent>
        </Popover>

        {/* Hygiene Filter - visible on desktop only */}
        {onHygieneFilterChange && (
          <div className="hidden md:block">
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
          </div>
        )}

        {/* User Filter - visible on desktop only */}
        {users.length > 0 && onUserFilterChange && (
          <div className="hidden md:block">
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
          </div>
        )}
      </div>
    </div>
  );
}
