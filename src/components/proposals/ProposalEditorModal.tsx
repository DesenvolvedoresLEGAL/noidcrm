import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RichTextEditor } from './RichTextEditor';
import { ProposalItemsManager } from './ProposalItemsManager';
import { ProposalPaymentTerms } from './ProposalPaymentTerms';
import { 
  Save, 
  FileDown, 
  Send, 
  Copy, 
  BookTemplate,
  Loader2,
  Link as LinkIcon,
  FileText
} from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { 
  createProposal, 
  updateProposal,
  generateProposalPDF,
  generatePublicToken,
  updateProposalTotals
} from '@/services/crm/proposals';
import { 
  listProposalItems,
  createProposalItem,
  updateProposalItem,
  deleteProposalItem
} from '@/services/crm/proposal-items';
import {
  getPaymentTerms,
  createPaymentTerm,
  updatePaymentTerm,
  deletePaymentTerm
} from '@/services/crm/proposal-payment-terms';
import { toast } from 'sonner';
import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm } from '@/services/crm/proposal-payment-terms';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { listLayouts, ProposalLayout } from '@/services/crm/proposal-layouts';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const proposalSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
  client_name: z.string().optional(),
  client_email: z.string().email('Email inválido').optional().or(z.literal('')),
  value: z.number().optional(),
  expires_at: z.string().optional(),
  introduction: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  layout_id: z.string().optional(),
});

type ProposalFormData = z.infer<typeof proposalSchema>;

interface ProposalEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposalId?: string;
  opportunityId?: string;
  onSuccess?: () => void;
}

export function ProposalEditorModal({
  open,
  onOpenChange,
  proposalId,
  opportunityId,
  onSuccess,
}: ProposalEditorModalProps) {
  const [activeTab, setActiveTab] = useState('content');
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  // Load available layouts
  const { data: layouts = [] } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
    enabled: open,
  });

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
  });

  // Load proposal data if editing
  const { data: existingProposal, isLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: async () => {
      if (!proposalId) return null;
      
      const { supabase } = await import('@/integrations/supabase/client');
      const { data } = await supabase
        .from('proposals')
        .select('*')
        .eq('id', proposalId)
        .single();
      
      return data;
    },
    enabled: !!proposalId && open,
  });

  // Load items
  const { data: existingItems } = useQuery({
    queryKey: ['proposal-items', proposalId],
    queryFn: () => listProposalItems(proposalId!),
    enabled: !!proposalId && open,
  });

  // Load payment terms
  const { data: existingTerms } = useQuery({
    queryKey: ['payment-terms', proposalId],
    queryFn: () => getPaymentTerms(proposalId!),
    enabled: !!proposalId && open,
  });

  // Load data when modal opens
  useEffect(() => {
    if (open && existingProposal) {
      reset({
        title: existingProposal.title || '',
        client_name: existingProposal.client_name || '',
        client_email: existingProposal.client_email || '',
        value: existingProposal.value || 0,
        expires_at: existingProposal.expires_at || '',
        introduction: existingProposal.introduction || '',
        terms: existingProposal.terms || '',
        notes: existingProposal.notes || '',
        layout_id: existingProposal.layout_id || '',
      });
      setPublicToken(existingProposal.public_token);
    }
  }, [existingProposal, reset, open]);

  useEffect(() => {
    if (existingItems) setItems(existingItems);
  }, [existingItems]);

  useEffect(() => {
    if (existingTerms) setPaymentTerms(existingTerms);
  }, [existingTerms]);

  const saveMutation = useMutation({
    mutationFn: async (data: ProposalFormData) => {
      setIsSaving(true);
      
      if (proposalId) {
        // Update existing proposal
        await updateProposal(proposalId, data);
        
        // Update items
        const existingItemIds = new Set(existingItems?.map(i => i.id) || []);
        const currentItemIds = new Set(items.map(i => i.id));
        
        // Delete removed items
        for (const id of existingItemIds) {
          if (!currentItemIds.has(id) && id) {
            await deleteProposalItem(id);
          }
        }
        
        // Create or update items
        for (const item of items) {
          if (item.id?.startsWith('temp-')) {
            await createProposalItem({
              ...item,
              proposal_id: proposalId,
            });
          } else if (item.id) {
            await updateProposalItem(item.id, item);
          }
        }
        
        // Update payment terms
        const existingTermIds = new Set(existingTerms?.map(t => t.id) || []);
        const currentTermIds = new Set(paymentTerms.map(t => t.id));
        
        // Delete removed terms
        for (const id of existingTermIds) {
          if (!currentTermIds.has(id) && id) {
            await deletePaymentTerm(id);
          }
        }
        
        // Create or update terms
        for (const term of paymentTerms) {
          if (!term.id) {
            await createPaymentTerm({
              ...term,
              proposal_id: proposalId,
            });
          } else {
            await updatePaymentTerm(term.id, term);
          }
        }
        
        // Update totals
        await updateProposalTotals(proposalId);
        
        return proposalId;
      } else {
        // Create new proposal
        if (!opportunityId || !organization?.id) {
          throw new Error('OpportunityId e OrganizationId são obrigatórios');
        }
        
        const newProposal = await createProposal({
          ...data,
          opportunity_id: opportunityId,
        });
        
        // Create items
        for (const item of items) {
          await createProposalItem({
            ...item,
            proposal_id: newProposal.id,
          });
        }
        
        // Create payment terms
        for (const term of paymentTerms) {
          await createPaymentTerm({
            ...term,
            proposal_id: newProposal.id,
          });
        }
        
        // Update totals
        await updateProposalTotals(newProposal.id);
        
        return newProposal.id;
      }
    },
    onSuccess: () => {
      setIsSaving(false);
      toast.success(proposalId ? 'Proposta atualizada!' : 'Proposta criada!');
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
      queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
      onSuccess?.();
    },
    onError: (error: Error) => {
      setIsSaving(false);
      toast.error(error.message || 'Erro ao salvar proposta');
    },
  });

  const handleGeneratePDF = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta primeiro');
      return;
    }
    
    setGeneratingPDF(true);
    try {
      const pdfUrl = await generateProposalPDF(proposalId);
      toast.success('PDF gerado com sucesso!');
      window.open(pdfUrl, '_blank');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar PDF');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGeneratePublicLink = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta primeiro');
      return;
    }
    
    try {
      const token = await generatePublicToken(proposalId);
      setPublicToken(token);
      const publicUrl = `${window.location.origin}/public/proposal/${token}`;
      navigator.clipboard.writeText(publicUrl);
      toast.success('Link público copiado!');
    } catch (error: any) {
      toast.error(error.message || 'Erro ao gerar link');
    }
  };

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  const onSubmit = (data: ProposalFormData) => {
    saveMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {proposalId ? 'Editar Proposta' : 'Nova Proposta'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="items">Itens ({items.length})</TabsTrigger>
              <TabsTrigger value="payment">Pagamento</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            {/* Content Tab */}
            <TabsContent value="content" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título da Proposta *</Label>
                  <Input {...register('title')} placeholder="Ex: Proposta Comercial - Cliente XYZ" />
                  {errors.title && (
                    <p className="text-sm text-destructive">{errors.title.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Data de Validade</Label>
                  <Input type="date" {...register('expires_at')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Introdução</Label>
                <RichTextEditor
                  value={watch('introduction') || ''}
                  onChange={(value) => setValue('introduction', value)}
                  placeholder="Apresente sua proposta de forma atrativa..."
                />
              </div>

              <div className="space-y-2">
                <Label>Termos e Condições</Label>
                <RichTextEditor
                  value={watch('terms') || ''}
                  onChange={(value) => setValue('terms', value)}
                  placeholder="Descreva os termos e condições..."
                />
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <RichTextEditor
                  value={watch('notes') || ''}
                  onChange={(value) => setValue('notes', value)}
                  placeholder="Observações adicionais..."
                  minHeight="120px"
                />
              </div>
            </TabsContent>

            {/* Items Tab */}
            <TabsContent value="items">
              <ProposalItemsManager
                items={items}
                onChange={setItems}
              />
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment">
              <ProposalPaymentTerms
                proposalId={proposalId || ''}
                totalAmount={totalAmount}
                terms={paymentTerms}
                onChange={setPaymentTerms}
              />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Cliente</Label>
                  <Input {...register('client_name')} placeholder="Nome do cliente" />
                </div>
                <div className="space-y-2">
                  <Label>Email do Cliente</Label>
                  <Input {...register('client_email')} type="email" placeholder="cliente@empresa.com" />
                  {errors.client_email && (
                    <p className="text-sm text-destructive">{errors.client_email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Modelo de Layout (Opcional)</Label>
                <Select
                  value={watch('layout_id') || ''}
                  onValueChange={(value) => setValue('layout_id', value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo de layout">
                      {watch('layout_id') ? (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {layouts.find(l => l.id === watch('layout_id'))?.name}
                        </div>
                      ) : (
                        'Nenhum modelo selecionado'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum modelo</SelectItem>
                    {layouts.map((layout) => (
                      <SelectItem key={layout.id} value={layout.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          {layout.name}
                          {layout.is_default && (
                            <span className="text-xs text-muted-foreground">(Padrão)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  O modelo de layout adiciona páginas visuais (PDFs) à sua proposta
                </p>
              </div>

              {proposalId && publicToken && (
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  <Label>Link Público</Label>
                  <div className="flex gap-2">
                    <Input
                      value={`${window.location.origin}/public/proposal/${publicToken}`}
                      readOnly
                      className="font-mono text-sm"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/public/proposal/${publicToken}`);
                        toast.success('Link copiado!');
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Total Display */}
          <div className="flex justify-end">
            <div className="w-80 p-4 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-bold">Total da Proposta:</span>
                <span className="text-2xl font-bold text-primary">
                  R$ {totalAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t">
            <Button
              type="submit"
              disabled={isSaving}
              className="flex-1"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
            
            {proposalId && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePDF}
                  disabled={generatingPDF}
                >
                  {generatingPDF ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileDown className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePublicLink}
                >
                  <LinkIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
