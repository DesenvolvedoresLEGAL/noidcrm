import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Pipeline } from '@/services/crm/types';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { supabase } from '@/integrations/supabase/client';
import { AccountCombobox } from '@/components/opportunity/AccountCombobox';
import { ContactCombobox } from '@/components/opportunity/ContactCombobox';
import { TagsMultiSelect } from '@/components/opportunity/TagsMultiSelect';
import { OriginSelect } from '@/components/opportunity/OriginSelect';
import { setOpportunityTags } from '@/hooks/useOrganizationTags';
import { Loader2, Sparkles, Building2, User as UserIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { findOrCreatePersonAccount } from '@/services/crm/createPersonAccount';

interface CreateOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  onCreateOpportunity: (data: any) => Promise<void>;
  defaultAccountId?: string;
  defaultPipelineId?: string;
}

export function CreateOpportunityModal({
  open,
  onOpenChange,
  pipelines,
  onCreateOpportunity,
  defaultAccountId,
  defaultPipelineId,
}: CreateOpportunityModalProps) {
  const { toast } = useToast();
  const { users } = useOrganizationUsers();
  const [loading, setLoading] = useState(false);
  const isSubmittingRef = useRef(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
  const [entityType, setEntityType] = useState<'PJ' | 'PF'>('PJ');
  const [formData, setFormData] = useState({
    title: '',
    account_id: defaultAccountId || '',
    account_name: '',
    contact_id: '',
    pipeline_id: '',
    owner_user_id: '',
    origem: '',
    close_date_prevista: '',
    temperatura: 'warm' as 'cold' | 'warm' | 'hot' | 'burning',
    prob: 30,
    tags: [] as string[],
  });
  const [pfData, setPfData] = useState({
    firstName: '',
    lastName: '',
    cpf: '',
    email: '',
    phone: '',
  });
  const [pipelineAutoSelected, setPipelineAutoSelected] = useState(false);

  // Detect pipeline type for the selected pipeline
  const selectedPipeline = pipelines.find(p => p.id === formData.pipeline_id);
  const pipelineType = selectedPipeline?.pipeline_type || 'sales';
  const isSalesPipeline = pipelineType === 'sales' || pipelineType === 'qualification';

  // Helper function to find pipeline by type
  const findPipelineByType = (type: 'sales' | 'qualification'): Pipeline | undefined => {
    return pipelines.find(p => p.pipeline_type === type);
  };

  // Get current user and set as owner when modal opens
  useEffect(() => {
    if (!open) return;
    
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setFormData(prev => ({ ...prev, owner_user_id: user.id }));
      }
    };
    getCurrentUser();
  }, [open]);

  // Pre-select pipeline when defaultPipelineId is provided
  useEffect(() => {
    if (defaultPipelineId && pipelines.some(p => p.id === defaultPipelineId)) {
      setFormData(prev => ({ ...prev, pipeline_id: defaultPipelineId }));
    }
  }, [defaultPipelineId, pipelines]);

  // Load account name if defaultAccountId is provided
  useEffect(() => {
    if (defaultAccountId) {
      supabase
        .from('accounts')
        .select('razao_social, nome_fantasia')
        .eq('id', defaultAccountId)
        .single()
        .then(({ data }) => {
          if (data) {
            const name = data.nome_fantasia || data.razao_social;
            setFormData(prev => ({ 
              ...prev, 
              account_id: defaultAccountId,
              account_name: name,
              title: `Oportunidade - ${name}` 
            }));
          }
        });
    }
  }, [defaultAccountId]);

  const handleAccountChange = (accountId: string, accountName: string, isNewAccount: boolean) => {
    // Smart pipeline selection based on account type (only for sales context)
    const targetPipelineType = isNewAccount ? 'qualification' : 'sales';
    const targetPipeline = findPipelineByType(targetPipelineType);
    
    setFormData(prev => ({ 
      ...prev, 
      account_id: accountId, 
      account_name: accountName,
      title: prev.title || `Oportunidade - ${accountName}`,
      contact_id: '',
      // Only auto-select pipeline if no pipeline is set or it's a sales context
      pipeline_id: (!prev.pipeline_id && targetPipeline) ? targetPipeline.id : prev.pipeline_id,
    }));
    
    if (!formData.pipeline_id && targetPipeline) {
      setPipelineAutoSelected(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isSubmittingRef.current || loading) return;
    isSubmittingRef.current = true;
    
    if (!formData.title.trim() && entityType === 'PJ') {
      toast({ title: 'Campo obrigatório', description: 'Preencha o título da oportunidade', variant: 'destructive' });
      isSubmittingRef.current = false;
      return;
    }

    if (entityType === 'PJ') {
      if (!formData.account_id) {
        toast({ title: 'Campo obrigatório', description: 'Selecione ou crie uma empresa', variant: 'destructive' });
        isSubmittingRef.current = false;
        return;
      }
      if (!formData.contact_id) {
        toast({ title: 'Campo obrigatório', description: 'Selecione ou crie um contato', variant: 'destructive' });
        isSubmittingRef.current = false;
        return;
      }
    } else {
      if (!pfData.firstName.trim()) {
        toast({ title: 'Campo obrigatório', description: 'Informe o nome da pessoa', variant: 'destructive' });
        isSubmittingRef.current = false;
        return;
      }
    }

    if (!formData.pipeline_id) {
      toast({ title: 'Campo obrigatório', description: 'Selecione um funil', variant: 'destructive' });
      isSubmittingRef.current = false;
      return;
    }

    if (!formData.owner_user_id) {
      toast({ title: 'Campo obrigatório', description: 'Selecione um responsável', variant: 'destructive' });
      isSubmittingRef.current = false;
      return;
    }

    // Origem and close_date are required only for sales/qualification pipelines
    if (isSalesPipeline && !formData.origem) {
      toast({ title: 'Campo obrigatório', description: 'Selecione uma origem', variant: 'destructive' });
      isSubmittingRef.current = false;
      return;
    }

    if (isSalesPipeline && !formData.close_date_prevista) {
      toast({ title: 'Campo obrigatório', description: 'Preencha a data prevista de fechamento', variant: 'destructive' });
      isSubmittingRef.current = false;
      return;
    }

    setLoading(true);
    try {
      const firstStage = selectedPipeline?.stages[0];

      let accountId = formData.account_id;
      let contactId = formData.contact_id;
      let titleFallback = formData.account_name;

      if (entityType === 'PF') {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: orgId } = await supabase.rpc('get_user_organization_id');
        if (!orgId) throw new Error('Usuário sem organização');

        const result = await findOrCreatePersonAccount({
          firstName: pfData.firstName,
          lastName: pfData.lastName,
          cpf: pfData.cpf,
          email: pfData.email,
          phone: pfData.phone,
          organizationId: orgId as string,
        });
        accountId = result.account_id;
        contactId = result.contact_id;
        titleFallback = result.account_name;
      }

      const opportunityData: any = {
        title: (formData.title || `Oportunidade - ${titleFallback}`).trim(),
        account_id: accountId,
        contact_id: contactId || undefined,
        pipeline_id: formData.pipeline_id,
        stage_id: firstStage?.id,
        owner_user_id: formData.owner_user_id || currentUserId,
        temperatura: formData.temperatura,
        prob: formData.prob,
      };

      // Only include sales-specific fields when relevant
      if (formData.origem) opportunityData.origem = formData.origem;
      if (formData.close_date_prevista) opportunityData.close_date_prevista = formData.close_date_prevista;

      await onCreateOpportunity(opportunityData);
      
      toast({ title: 'Sucesso', description: 'Oportunidade criada com sucesso!' });
      
      setFormData({
        title: '',
        account_id: '',
        account_name: '',
        contact_id: '',
        pipeline_id: '',
        owner_user_id: currentUserId,
        origem: '',
        close_date_prevista: '',
        temperatura: 'warm',
        prob: 30,
        tags: [],
      });
      
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error creating opportunity:', error);
      toast({ title: 'Erro', description: error?.message || 'Erro ao criar oportunidade', variant: 'destructive' });
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const ownerLabel = isSalesPipeline ? 'Vendedor' : 'Responsável';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-[100dvh] max-w-full md:max-w-2xl md:h-auto md:max-h-[90vh] rounded-none md:rounded-lg overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle>Nova Oportunidade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Título */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="title">
                Título <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Oportunidade - Empresa XPTO"
              />
            </div>

            {/* Conta/Empresa */}
            <div className="space-y-2">
              <Label>
                Empresa <span className="text-destructive">*</span>
              </Label>
              <AccountCombobox
                value={formData.account_id}
                onChange={handleAccountChange}
                disabled={!!defaultAccountId}
              />
            </div>

            {/* Contato */}
            <div className="space-y-2">
              <Label>
                Contato <span className="text-destructive">*</span>
              </Label>
              <ContactCombobox
                value={formData.contact_id}
                onChange={(contactId) => setFormData({ ...formData, contact_id: contactId })}
                accountId={formData.account_id}
                disabled={!formData.account_id}
                placeholder={!formData.account_id ? "Selecione uma empresa primeiro" : "Selecione o contato..."}
              />
            </div>

            {/* Pipeline */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label>
                  Funil <span className="text-destructive">*</span>
                </Label>
                {pipelineAutoSelected && (
                  <Badge variant="secondary" className="text-xs gap-1 font-normal">
                    <Sparkles className="h-3 w-3" />
                    Auto
                  </Badge>
                )}
              </div>
              <Select
                value={formData.pipeline_id}
                onValueChange={(value) => {
                  setFormData({ ...formData, pipeline_id: value });
                  setPipelineAutoSelected(false);
                }}
              >
                <SelectTrigger>
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
            </div>

            {/* Owner */}
            <div className="space-y-2">
              <Label>
                {ownerLabel} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.owner_user_id}
                onValueChange={(value) => setFormData({ ...formData, owner_user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione o ${ownerLabel.toLowerCase()}`} />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Origem - only required for sales */}
            <div className="space-y-2">
              <Label>
                Origem {isSalesPipeline && <span className="text-destructive">*</span>}
              </Label>
              <OriginSelect
                value={formData.origem}
                onChange={(value) => setFormData({ ...formData, origem: value })}
              />
            </div>

            {/* Data de Fechamento - only required for sales */}
            <div className="space-y-2">
              <Label>
                Data Prevista de Fechamento {isSalesPipeline && <span className="text-destructive">*</span>}
              </Label>
              <Input
                type="date"
                value={formData.close_date_prevista}
                onChange={(e) => setFormData({ ...formData, close_date_prevista: e.target.value })}
              />
            </div>

            {/* Temperatura */}
            <div className="space-y-2">
              <Label>Temperatura</Label>
              <Select
                value={formData.temperatura}
                onValueChange={(value: 'cold' | 'warm' | 'hot' | 'burning') => 
                  setFormData({ ...formData, temperatura: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cold">🥶 Frio</SelectItem>
                  <SelectItem value="warm">😐 Morno</SelectItem>
                  <SelectItem value="hot">🔥 Quente</SelectItem>
                  <SelectItem value="burning">💥 Ardente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Probabilidade */}
            <div className="space-y-2">
              <Label>Probabilidade: {formData.prob}%</Label>
              <Slider
                min={0}
                max={100}
                step={5}
                value={[formData.prob]}
                onValueChange={(vals) => setFormData({ ...formData, prob: vals[0] })}
              />
            </div>

            {/* Tags */}
            <div className="md:col-span-2 space-y-2">
              <Label>Tags</Label>
              <TagsMultiSelect
                value={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
              />
            </div>
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Criando...' : 'Criar Oportunidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
