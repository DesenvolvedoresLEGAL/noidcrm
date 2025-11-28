import { useState } from 'react';
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
import { Pipeline } from '@/services/crm/types';
import { useToast } from '@/hooks/use-toast';
import { useOrganizationProducts } from '@/hooks/useOrganizationProducts';
import { supabase } from '@/integrations/supabase/client';

interface CreateOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  onCreateOpportunity: (data: any) => Promise<void>;
  defaultAccountId?: string;
}

export function CreateOpportunityModal({
  open,
  onOpenChange,
  pipelines,
  onCreateOpportunity,
  defaultAccountId,
}: CreateOpportunityModalProps) {
  const { toast } = useToast();
  const { products } = useOrganizationProducts();
  const [loading, setLoading] = useState(false);
  const [accountName, setAccountName] = useState('');
  const [formData, setFormData] = useState({
    account_name: '',
    contact_name: '',
    pipeline_id: '',
    produto: '',
    valor_previsto: '',
    mrr: '',
    prob: '0.3',
    close_date_prevista: '',
  });

  // Load account name if defaultAccountId is provided
  useState(() => {
    if (defaultAccountId) {
      supabase
        .from('accounts')
        .select('razao_social, nome_fantasia')
        .eq('id', defaultAccountId)
        .single()
        .then(({ data }) => {
          if (data) {
            const name = data.nome_fantasia || data.razao_social;
            setAccountName(name);
            setFormData(prev => ({ ...prev, account_name: name }));
          }
        });
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.account_name || !formData.pipeline_id) {
      toast({
        title: 'Erro',
        description: 'Preencha os campos obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      // Get organization_id first
      const { data: orgId, error: orgError } = await supabase.rpc('get_user_organization_id');
      
      if (orgError || !orgId) {
        throw new Error('Usuário não pertence a uma organização');
      }

      // Create or find account
      let accountId: string | undefined;
      if (formData.account_name.trim()) {
        const { data: existingAccount } = await supabase
          .from('accounts')
          .select('id')
          .eq('organization_id', orgId)
          .ilike('razao_social', formData.account_name.trim())
          .maybeSingle();

        if (existingAccount) {
          accountId = existingAccount.id;
        } else {
          const { data: newAccount, error: accountError } = await supabase
            .from('accounts')
            .insert({
              razao_social: formData.account_name.trim(),
              organization_id: orgId,
            })
            .select('id')
            .single();

          if (accountError) {
            console.error('Error creating account:', accountError);
          } else {
            accountId = newAccount.id;
          }
        }
      }

      // Create or find contact
      let contactId: string | undefined;
      if (formData.contact_name.trim() && accountId) {
        const { data: existingContact } = await supabase
          .from('contacts')
          .select('id')
          .eq('organization_id', orgId)
          .eq('account_id', accountId)
          .ilike('nome', formData.contact_name.trim())
          .maybeSingle();

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          const { data: newContact, error: contactError } = await supabase
            .from('contacts')
            .insert({
              nome: formData.contact_name.trim(),
              account_id: accountId,
              organization_id: orgId,
            })
            .select('id')
            .single();

          if (contactError) {
            console.error('Error creating contact:', contactError);
          } else {
            contactId = newContact.id;
          }
        }
      }

      const selectedPipeline = pipelines.find(p => p.id === formData.pipeline_id);
      const firstStage = selectedPipeline?.stages[0];

      // Convert probability from 0-1 to 0-100 if needed
      const probValue = parseFloat(formData.prob) || 0.3;
      const probPercent = probValue <= 1 ? probValue * 100 : probValue;

      await onCreateOpportunity({
        title: `Oportunidade - ${formData.account_name}`,
        account_id: defaultAccountId || accountId,
        contact_id: contactId,
        pipeline_id: formData.pipeline_id,
        stage_id: firstStage?.id,
        produto: formData.produto || undefined,
        valor_previsto: parseFloat(formData.valor_previsto) || 0,
        prob: probPercent,
        close_date_prevista: formData.close_date_prevista || undefined,
      });

      toast({
        title: 'Sucesso',
        description: 'Oportunidade criada com sucesso!',
      });
      
      // Reset form
      setFormData({
        account_name: '',
        contact_name: '',
        pipeline_id: '',
        produto: '',
        valor_previsto: '',
        mrr: '',
        prob: '0.3',
        close_date_prevista: '',
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Oportunidade</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="account_name">
                Nome da Empresa <span className="text-destructive">*</span>
              </Label>
              <Input
                id="account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                placeholder="Ex: Empresa XPTO"
                disabled={!!defaultAccountId}
                className={defaultAccountId ? 'bg-muted' : ''}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_name">Nome do Contato</Label>
              <Input
                id="contact_name"
                value={formData.contact_name}
                onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                placeholder="Ex: João Silva"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pipeline">
                Pipeline <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.pipeline_id}
                onValueChange={(value) => setFormData({ ...formData, pipeline_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o pipeline" />
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

            <div className="space-y-2">
              <Label htmlFor="produto">Produto</Label>
              <Select
                value={formData.produto}
                onValueChange={(value) =>
                  setFormData({ ...formData, produto: value })
                }
                disabled={products.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={products.length === 0 ? "Nenhum produto cadastrado" : "Selecione o produto"} />
                </SelectTrigger>
                <SelectContent>
                  {products.map(product => (
                    <SelectItem key={product.id} value={product.name}>
                      {product.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="valor_previsto">Valor P&S (R$)</Label>
              <Input
                id="valor_previsto"
                type="number"
                step="0.01"
                value={formData.valor_previsto}
                onChange={(e) => setFormData({ ...formData, valor_previsto: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="mrr">MRR (R$)</Label>
              <Input
                id="mrr"
                type="number"
                step="0.01"
                value={formData.mrr}
                onChange={(e) => setFormData({ ...formData, mrr: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="prob">Probabilidade</Label>
              <Select
                value={formData.prob}
                onValueChange={(value) => setFormData({ ...formData, prob: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0.1">10%</SelectItem>
                  <SelectItem value="0.3">30%</SelectItem>
                  <SelectItem value="0.5">50%</SelectItem>
                  <SelectItem value="0.7">70%</SelectItem>
                  <SelectItem value="0.9">90%</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="close_date">Data Prevista de Fechamento</Label>
              <Input
                id="close_date"
                type="date"
                value={formData.close_date_prevista}
                onChange={(e) =>
                  setFormData({ ...formData, close_date_prevista: e.target.value })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Oportunidade'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
