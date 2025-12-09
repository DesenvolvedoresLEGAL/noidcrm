import { useState, useEffect } from 'react';
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
import { Loader2 } from 'lucide-react';

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
  const [currentUserId, setCurrentUserId] = useState<string>('');
  
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

  // Get current user
  useEffect(() => {
    const getCurrentUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        setFormData(prev => ({ ...prev, owner_user_id: user.id }));
      }
    };
    getCurrentUser();
  }, []);

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

  const handleAccountChange = (accountId: string, accountName: string) => {
    setFormData(prev => ({ 
      ...prev, 
      account_id: accountId, 
      account_name: accountName,
      title: prev.title || `Oportunidade - ${accountName}`,
      contact_id: '' // Reset contact when account changes
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      toast({
        title: 'Campo obrigatório',
        description: 'Preencha o título da oportunidade',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.account_id) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione ou crie uma empresa',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.contact_id) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione ou crie um contato',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.pipeline_id) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um funil',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.owner_user_id) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione um vendedor',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.origem) {
      toast({
        title: 'Campo obrigatório',
        description: 'Selecione uma origem',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.close_date_prevista) {
      toast({
        title: 'Campo obrigatório',
        description: 'Preencha a data prevista de fechamento',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const selectedPipeline = pipelines.find(p => p.id === formData.pipeline_id);
      const firstStage = selectedPipeline?.stages[0];

      const opportunityData = {
        title: formData.title || `Oportunidade - ${formData.account_name}`,
        account_id: formData.account_id,
        contact_id: formData.contact_id || undefined,
        pipeline_id: formData.pipeline_id,
        stage_id: firstStage?.id,
        owner_user_id: formData.owner_user_id || currentUserId,
        origem: formData.origem || undefined,
        temperatura: formData.temperatura,
        prob: formData.prob,
        close_date_prevista: formData.close_date_prevista || undefined,
      };

      await onCreateOpportunity(opportunityData);

      // Note: Tags are saved after opportunity creation in parent component
      // We pass tags in the response for the parent to handle
      
      toast({
        title: 'Sucesso',
        description: 'Oportunidade criada com sucesso!',
      });
      
      // Reset form
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
      toast({
        title: 'Erro',
        description: error?.message || 'Erro ao criar oportunidade',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Oportunidade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Título */}
            <div className="col-span-2 space-y-2">
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
              <Label>
                Funil <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.pipeline_id}
                onValueChange={(value) => setFormData({ ...formData, pipeline_id: value })}
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

            {/* Vendedor/Owner */}
            <div className="space-y-2">
              <Label>
                Vendedor <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.owner_user_id}
                onValueChange={(value) => setFormData({ ...formData, owner_user_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o vendedor" />
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

            {/* Origem */}
            <div className="space-y-2">
              <Label>
                Origem <span className="text-destructive">*</span>
              </Label>
              <OriginSelect
                value={formData.origem}
                onChange={(value) => setFormData({ ...formData, origem: value })}
              />
            </div>

            {/* Data de Fechamento */}
            <div className="space-y-2">
              <Label>
                Data Prevista de Fechamento <span className="text-destructive">*</span>
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
            <div className="col-span-2 space-y-2">
              <Label>Tags</Label>
              <TagsMultiSelect
                value={formData.tags}
                onChange={(tags) => setFormData({ ...formData, tags })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Criando...' : 'Criar Oportunidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
