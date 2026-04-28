import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AlertCircle, Info, Star, Users, Shuffle, Scale, Dice5, MapPin, Ban } from 'lucide-react';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { Pipeline, LeadDistributionStrategy } from '@/services/crm/types';

interface EditPipelineModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: Partial<Pipeline>) => void;
  pipeline?: Pipeline;
}

const PIPELINE_TYPES = [
  { 
    value: 'qualification', 
    label: 'Qualificação (Pré-Vendas)', 
    description: 'Funil para qualificar e nutrir leads antes de entrarem em vendas' 
  },
  { 
    value: 'sales', 
    label: 'Vendas', 
    description: 'Funil principal de vendas onde negócios são fechados' 
  },
  { 
    value: 'onboarding', 
    label: 'Onboarding / CS', 
    description: 'Funil de ativação e sucesso do cliente após a venda' 
  },
  { 
    value: 'renewal', 
    label: 'Renovação', 
    description: 'Funil para gerenciar renovações e upsells' 
  },
] as const;

const DISTRIBUTION_STRATEGIES: Array<{
  value: LeadDistributionStrategy;
  label: string;
  description: string;
  icon: typeof Shuffle;
}> = [
  {
    value: 'none',
    label: 'Sem distribuição automática',
    description: 'Os leads precisam ser atribuídos manualmente.',
    icon: Ban,
  },
  {
    value: 'round_robin',
    label: 'Round Robin (revezamento)',
    description: 'Distribui leads em ordem rotativa entre os usuários elegíveis.',
    icon: Shuffle,
  },
  {
    value: 'load_balanced',
    label: 'Carga balanceada',
    description: 'Atribui ao usuário com menor número de oportunidades abertas no momento.',
    icon: Scale,
  },
  {
    value: 'random',
    label: 'Aleatório',
    description: 'Sorteia um usuário elegível a cada novo lead.',
    icon: Dice5,
  },
  {
    value: 'territory',
    label: 'Por território (UF)',
    description: 'Atribui pelo estado (UF) da empresa, com fallback para round robin.',
    icon: MapPin,
  },
];

const DISTRIBUTION_ROLES = [
  { value: 'sdr', label: 'SDR / Pré-vendas' },
  { value: 'closer', label: 'Closer / Vendedor' },
  { value: 'cs', label: 'Customer Success' },
  { value: 'any', label: 'Qualquer cargo (usar lista)' },
];

export function EditPipelineModal({ open, onClose, onSave, pipeline }: EditPipelineModalProps) {
  const { businessUnits, loading: loadingBUs } = useBusinessUnits();
  const { users: orgUsers, loading: loadingUsers } = useOrganizationUsers(
    pipeline?.lead_distribution_user_ids || [],
  );
  const [name, setName] = useState('');
  const [pipelineType, setPipelineType] = useState<Pipeline['pipeline_type']>('sales');
  const [isPrimary, setIsPrimary] = useState(false);
  const [selectedBUIds, setSelectedBUIds] = useState<string[]>([]);
  const [distributionStrategy, setDistributionStrategy] =
    useState<LeadDistributionStrategy>('none');
  const [distributionRole, setDistributionRole] = useState<string>('any');
  const [distributionUserIds, setDistributionUserIds] = useState<string[]>([]);

  useEffect(() => {
    if (pipeline) {
      setName(pipeline.name);
      setPipelineType(pipeline.pipeline_type || 'sales');
      setIsPrimary(pipeline.is_primary ?? false);
      if (pipeline.business_unit_ids && pipeline.business_unit_ids.length > 0) {
        setSelectedBUIds(pipeline.business_unit_ids);
      } else {
        setSelectedBUIds([]);
      }
      setDistributionStrategy(
        (pipeline.lead_distribution_strategy as LeadDistributionStrategy) || 'none',
      );
      setDistributionRole(pipeline.lead_distribution_role ?? 'any');
      setDistributionUserIds(pipeline.lead_distribution_user_ids || []);
    } else {
      setName('');
      setPipelineType('sales');
      setIsPrimary(false);
      setSelectedBUIds([]);
      setDistributionStrategy('none');
      setDistributionRole('any');
      setDistributionUserIds([]);
    }
  }, [pipeline, open]);

  const toggleBU = (buId: string) => {
    setSelectedBUIds((prev) => {
      if (prev.includes(buId)) {
        if (prev.length === 1) return prev;
        return prev.filter((id) => id !== buId);
      }
      return [...prev, buId];
    });
  };

  const toggleDistributionUser = (userId: string) => {
    setDistributionUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSave = () => {
    if (!name.trim() || selectedBUIds.length === 0) return;
    // Validar: se distribuição ativa + cargo "any", precisa pelo menos 1 usuário
    if (
      distributionStrategy !== 'none' &&
      distributionRole === 'any' &&
      distributionUserIds.length === 0
    ) {
      return;
    }
    // Mapear 'any' -> null para satisfazer constraint pipelines_lead_distribution_role_check
    const normalizedRole =
      distributionStrategy === 'none' || distributionRole === 'any'
        ? null
        : distributionRole;
    onSave({
      name: name.trim(),
      pipeline_type: pipelineType,
      is_primary: pipelineType === 'sales' ? isPrimary : false,
      business_unit_ids: selectedBUIds,
      lead_distribution_strategy: distributionStrategy,
      lead_distribution_role: normalizedRole,
      lead_distribution_user_ids:
        distributionStrategy === 'none' ? [] : distributionUserIds,
    });
    onClose();
  };

  const selectedTypeInfo = PIPELINE_TYPES.find((t) => t.value === pipelineType);
  const selectedStrategyInfo = DISTRIBUTION_STRATEGIES.find(
    (s) => s.value === distributionStrategy,
  );
  const showDistributionConfig = distributionStrategy !== 'none';
  const showUserList = distributionRole === 'any';
  // Distribuição de leads só deve listar usuários ATIVOS da organização.
  // O hook marca inativos com sufixo "(Inativo)" — filtramos esses.
  const activeOrgUsers = orgUsers.filter((u) => !u.name.endsWith('(Inativo)'));
  const distributionInvalid =
    showDistributionConfig &&
    showUserList &&
    distributionUserIds.length === 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pipeline ? 'Editar Funil' : 'Novo Funil'}</DialogTitle>
          <DialogDescription>
            {pipeline ? 'Edite as informações do funil.' : 'Crie um novo funil para organizar seu processo comercial.'}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do funil *</Label>
            <Input
              id="name"
              placeholder="Ex: Vendas, Pré-vendas, Onboarding"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline_type">Tipo de Funil *</Label>
            <Select value={pipelineType} onValueChange={(v) => setPipelineType(v as Pipeline['pipeline_type'])}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo de funil" />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedTypeInfo && (
              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{selectedTypeInfo.description}</p>
              </div>
            )}
          </div>

          {pipelineType === 'sales' && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-amber-500" />
                <div>
                  <Label htmlFor="is_primary" className="text-sm font-medium cursor-pointer">
                    Funil Principal para Forecast
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Este funil será usado como referência para o Forecast de vendas
                  </p>
                </div>
              </div>
              <Switch
                id="is_primary"
                checked={isPrimary}
                onCheckedChange={setIsPrimary}
              />
            </div>
          )}

          <div className="space-y-3">
            <Label>Unidades de Negócio *</Label>
            {loadingBUs ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : businessUnits.length === 0 ? (
              <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                <AlertCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Nenhuma unidade de negócio cadastrada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Configure as unidades de negócio em Configurações antes de criar funis.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground">
                  Selecione as unidades de negócio que utilizarão este funil
                </p>
                <div className="space-y-2">
                  {businessUnits.map((bu) => (
                    <div key={bu.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`bu-${bu.id}`}
                        checked={selectedBUIds.includes(bu.id)}
                        onCheckedChange={() => toggleBU(bu.id)}
                      />
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: bu.color }}
                      />
                      <label
                        htmlFor={`bu-${bu.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {bu.name}
                      </label>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Distribuição de leads */}
          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Distribuição automática de leads</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Define como novas oportunidades neste funil serão atribuídas a um responsável.
            </p>

            <Select
              value={distributionStrategy}
              onValueChange={(v) => setDistributionStrategy(v as LeadDistributionStrategy)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma estratégia" />
              </SelectTrigger>
              <SelectContent>
                {DISTRIBUTION_STRATEGIES.map((s) => {
                  const Icon = s.icon;
                  return (
                    <SelectItem key={s.value} value={s.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" />
                        {s.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>

            {selectedStrategyInfo && (
              <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground">{selectedStrategyInfo.description}</p>
              </div>
            )}

            {showDistributionConfig && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs">Cargo elegível</Label>
                  <Select value={distributionRole} onValueChange={setDistributionRole}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DISTRIBUTION_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Quando "Qualquer cargo" é selecionado, a distribuição usa apenas a lista de
                    usuários abaixo.
                  </p>
                </div>

                {showUserList && (
                  <div className="space-y-2">
                    <Label className="text-xs">Usuários elegíveis</Label>
                    {loadingUsers ? (
                      <p className="text-sm text-muted-foreground">Carregando usuários...</p>
                    ) : activeOrgUsers.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        Nenhum usuário ativo na organização.
                      </p>
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto rounded-md border border-border p-2">
                        {activeOrgUsers.map((u) => (
                          <div key={u.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`dist-user-${u.id}`}
                              checked={distributionUserIds.includes(u.id)}
                              onCheckedChange={() => toggleDistributionUser(u.id)}
                            />
                            <label
                              htmlFor={`dist-user-${u.id}`}
                              className="text-sm leading-none cursor-pointer"
                            >
                              {u.name}
                            </label>
                          </div>
                        ))}
                      </div>
                    )}
                    {distributionUserIds.length === 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-500">
                        Selecione ao menos um usuário para esta estratégia funcionar.
                      </p>
                    )}
                  </div>
                )}

                {distributionStrategy === 'territory' && (
                  <div className="flex items-start gap-2 p-2 bg-muted/50 rounded-md">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <p className="text-[11px] text-muted-foreground">
                      Caso o estado (UF) da empresa não esteja mapeado para nenhum usuário, o
                      sistema cai automaticamente para Round Robin entre os elegíveis.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || selectedBUIds.length === 0 || businessUnits.length === 0 || distributionInvalid}
          >
            {pipeline ? 'Salvar' : 'Criar Funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
