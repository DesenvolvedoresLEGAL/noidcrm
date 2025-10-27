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

interface CreateOpportunityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pipelines: Pipeline[];
  onCreateOpportunity: (data: any) => Promise<void>;
}

export function CreateOpportunityModal({
  open,
  onOpenChange,
  pipelines,
  onCreateOpportunity,
}: CreateOpportunityModalProps) {
  const { toast } = useToast();
  const { products } = useOrganizationProducts();
  const [loading, setLoading] = useState(false);
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
      const selectedPipeline = pipelines.find(p => p.id === formData.pipeline_id);
      const firstStage = selectedPipeline?.stages[0];

      await onCreateOpportunity({
        account_name: formData.account_name,
        contact_name: formData.contact_name,
        pipeline_id: formData.pipeline_id,
        stage_id: firstStage?.id || 'stage-discovery',
        produto: formData.produto,
        valor_previsto: parseFloat(formData.valor_previsto) || 0,
        prob: parseFloat(formData.prob) || 0.3,
        close_date_prevista: formData.close_date_prevista || undefined,
        meta: {
          mrr: parseFloat(formData.mrr) || 0,
        },
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
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao criar oportunidade',
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
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {products.length === 0 ? (
                    <SelectItem value="" disabled>Nenhum produto cadastrado</SelectItem>
                  ) : (
                    products.map(product => (
                      <SelectItem key={product.id} value={product.name}>
                        {product.name}
                      </SelectItem>
                    ))
                  )}
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
