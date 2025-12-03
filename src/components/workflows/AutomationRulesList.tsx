import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Search,
  Zap,
  Plus,
} from 'lucide-react';
import { WorkflowRule, TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from '@/services/crm/workflow-rules';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AutomationRulesListProps {
  rules: WorkflowRule[];
  selectedCategory: string | null;
  onEdit: (rule: WorkflowRule) => void;
  onCreate: () => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

export function AutomationRulesList({
  rules,
  selectedCategory,
  onEdit,
  onCreate,
  onDelete,
  onDuplicate,
  onToggle,
}: AutomationRulesListProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [triggerFilter, setTriggerFilter] = useState<string>('all');

  // Get unique trigger types
  const triggerTypes = [...new Set(rules.map(r => r.trigger_type))];

  // Filter rules
  const filteredRules = rules.filter(rule => {
    // Category filter
    if (selectedCategory) {
      const name = rule.name || '';
      const categoryMatch = 
        (selectedCategory === 'PV' && name.startsWith('PV-')) ||
        (selectedCategory === 'ALU' && name.startsWith('ALU-')) ||
        (selectedCategory === 'ACT' && name.startsWith('ACT-')) ||
        (selectedCategory === 'PROP' && name.startsWith('PROP-')) ||
        (selectedCategory === 'ALERT' && name.startsWith('ALERT-')) ||
        (selectedCategory === 'OTHER' && !['PV-', 'ALU-', 'ACT-', 'PROP-', 'ALERT-'].some(p => name.startsWith(p)));
      if (!categoryMatch) return false;
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (
        !rule.name?.toLowerCase().includes(searchLower) &&
        !rule.description?.toLowerCase().includes(searchLower)
      ) {
        return false;
      }
    }

    // Status filter
    if (statusFilter === 'active' && !rule.is_active) return false;
    if (statusFilter === 'inactive' && rule.is_active) return false;

    // Trigger filter
    if (triggerFilter !== 'all' && rule.trigger_type !== triggerFilter) return false;

    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar automação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <SelectTrigger className="w-full sm:w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="inactive">Inativas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Gatilho" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os gatilhos</SelectItem>
            {triggerTypes.map(type => (
              <SelectItem key={type} value={type}>
                {TRIGGER_TYPE_LABELS[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Nova Automação</span>
        </Button>
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{filteredRules.length} de {rules.length} automações</span>
        {selectedCategory && (
          <Badge variant="secondary" className="gap-1">
            Categoria: {selectedCategory}
          </Badge>
        )}
      </div>

      {/* Rules List */}
      {filteredRules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {rules.length === 0 ? 'Nenhuma automação configurada' : 'Nenhuma automação encontrada'}
            </h3>
            <p className="text-muted-foreground mb-4">
              {rules.length === 0 
                ? 'Crie sua primeira automação para executar ações automaticamente'
                : 'Tente ajustar os filtros de busca'
              }
            </p>
            {rules.length === 0 && (
              <Button onClick={onCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Automação
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredRules.map((rule) => (
            <Card key={rule.id} className={`transition-opacity ${!rule.is_active ? 'opacity-60' : ''}`}>
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium truncate">{rule.name}</h3>
                      <Badge 
                        variant={rule.is_active ? 'default' : 'secondary'}
                        className="text-xs shrink-0"
                      >
                        {rule.is_active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </div>

                    {rule.description && (
                      <p className="text-sm text-muted-foreground truncate mb-2">
                        {rule.description}
                      </p>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-xs">
                        {TRIGGER_TYPE_LABELS[rule.trigger_type] || rule.trigger_type}
                      </Badge>
                      <span className="text-muted-foreground text-xs">→</span>
                      {rule.actions.slice(0, 2).map((action, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs bg-primary/5">
                          {ACTION_TYPE_LABELS[action.type] || action.type}
                        </Badge>
                      ))}
                      {rule.actions.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{rule.actions.length - 2}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    <div className="hidden md:block text-right">
                      <p>{rule.executions_count || 0} exec.</p>
                      {rule.last_executed_at && (
                        <p className="text-xs">
                          {formatDistanceToNow(new Date(rule.last_executed_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      )}
                    </div>

                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(checked) => onToggle(rule.id, checked)}
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEdit(rule)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onDuplicate(rule.id)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => onDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
