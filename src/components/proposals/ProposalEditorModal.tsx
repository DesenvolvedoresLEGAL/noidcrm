import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RichTextEditor } from './RichTextEditor';
import { ProposalItemsManager } from './ProposalItemsManager';
import { ProposalPaymentTerms } from './ProposalPaymentTerms';
import { ProposalDynamicPricingPanel } from './ProposalDynamicPricingPanel';

import {
  Save,
  FileDown,
  Send,
  Copy,
  BookTemplate,
  Loader2,
  Link as LinkIcon,
  FileText,
  Lightbulb,
  Sparkles
} from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { invalidateProposalCaches } from '@/hooks/proposals/useProposalOrchestrator';
import {
  createProposal,
  updateProposal,
  generateProposalPDF,
  generatePublicToken,
  updateProposalTotals,
  syncOpportunityValue,
} from '@/services/crm/proposals';
import { buildProposalPublicUrl } from '@/lib/proposalUrl';
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
import { autoFillProposal, suggestProposalItems } from '@/services/crm/proposal-autofill';
import { getOpportunity } from '@/services/crm/opportunities';
import { toast } from 'sonner';
import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm } from '@/services/crm/proposal-payment-terms';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { listLayouts, ProposalLayout } from '@/services/crm/proposal-layouts';
import { listTemplates, ProposalTemplate } from '@/services/crm/proposal-templates';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProposalPreview } from './ProposalPreview';
import { AIProposalCopilot } from './AIProposalCopilot';
import { proposalKeys } from '@/lib/query-keys';

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
  currency: z.enum(['BRL', 'USD', 'EUR']).optional(),
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
  const [itemSuggestions, setItemSuggestions] = useState<any[]>([]);
  const [suggestionMessage, setSuggestionMessage] = useState('');
  const [proposalNumber, setProposalNumber] = useState<string>('');
  const [proposalVersion, setProposalVersion] = useState<number>(1);
  const [appliedTemplate, setAppliedTemplate] = useState<ProposalTemplate | null>(null);
  
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  // Load available layouts
  const { data: layouts = [] } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
    enabled: open,
    // SPRINT PERF 0.4 — layouts/templates raramente mudam; mutations invalidam as keys.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Load available templates
  const { data: templates = [] } = useQuery<ProposalTemplate[]>({
    queryKey: ['proposal-templates'],
    queryFn: listTemplates,
    enabled: open,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Handle template selection
  const handleTemplateChange = (templateId: string) => {
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Calculate expiration based on template validity_days
      const validityDays = template.default_validity_days ?? template.validity_days ?? 30;
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + validityDays);
      
      // Apply all template configurations
      setValue('layout_id', template.layout_id || '');
      setValue('currency', (template.currency as 'BRL' | 'USD' | 'EUR') || 'BRL');
      if (template.validity_strategy === 'fixed_days_from_creation' || !template.validity_strategy) {
        setValue('expires_at', expiresAt.toISOString().split('T')[0]);
      }
      setValue('introduction', template.introduction || '');
      setValue('terms', template.terms || '');
      setValue('notes', template.notes || '');

      setAppliedTemplate(template);
      toast.success(`Template "${template.name}" aplicado!`);
    }
  };

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
  });

  // Auto-fill when creating from opportunity (Sprint 3)
  useEffect(() => {
    if (open && !proposalId && opportunityId) {
      autoFillProposal(opportunityId).then((data) => {
        reset({
          title: data.title,
          client_name: data.client_name,
          client_email: data.client_email,
          introduction: data.introduction,
          terms: data.terms,
          notes: data.notes,
          expires_at: data.expires_at,
          layout_id: data.layout_id,
          value: data.value,
          currency: data.currency || (organization as any)?.default_currency || 'BRL',
        });
        toast.success('✨ Proposta preenchida automaticamente!');
      }).catch(console.error);

      // Fetch suggestions
      getOpportunity(opportunityId).then(async (opp: any) => {
        if (opp?.account_id) {
          const suggestions = await suggestProposalItems(opp.account_id, opportunityId);
          setItemSuggestions(suggestions.suggestions || []);
          setSuggestionMessage(suggestions.message || '');
        }
      }).catch(console.error);
    }
  }, [open, proposalId, opportunityId, reset]);

  // Load proposal data
  const { data: proposalData, isLoading: isProposalLoading } = useQuery({
    queryKey: proposalKeys.detail(proposalId),
    queryFn: async () => {
      if (!proposalId) return null;
      const proposal = await fetch(`/api/proposals/${proposalId}`).then(res => res.json());
      return proposal;
    },
    enabled: open && !!proposalId,
  });

  // Handle proposal data loading
  useEffect(() => {
    if (proposalData) {
      reset({
        title: proposalData.title,
        client_name: proposalData.client_name,
        client_email: proposalData.client_email,
        value: proposalData.value,
        expires_at: proposalData.expires_at,
        introduction: proposalData.introduction,
        terms: proposalData.terms,
        notes: proposalData.notes,
        layout_id: proposalData.layout_id,
        currency: proposalData.currency || 'BRL',
      });
      setPublicToken(proposalData.public_token);
      setProposalNumber(proposalData.proposal_number || '');
      setProposalVersion(proposalData.proposal_version || 1);
      if (proposalData.template_name && templates.length) {
        const t = templates.find((x) => x.name === proposalData.template_name);
        if (t) setAppliedTemplate(t);
      }
    }
  }, [proposalData, reset, templates]);

  // Load proposal items
  useEffect(() => {
    if (proposalId) {
      listProposalItems(proposalId).then(setItems);
    } else {
      setItems([]);
    }
  }, [proposalId]);

  // Load payment terms
  useEffect(() => {
    if (proposalId) {
      getPaymentTerms(proposalId).then(setPaymentTerms);
    } else {
      setPaymentTerms([]);
    }
  }, [proposalId]);

  const onSubmit = async (data: ProposalFormData) => {
    // Template requer validade da proposta?
    if (appliedTemplate?.requires_valid_until && !data.expires_at) {
      toast.error(
        'Este template exige validade da proposta para calcular a condição comercial.',
      );
      return;
    }

    // Check session validity before saving
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      console.error('[ProposalEditorModal] Session expired:', sessionError);
      toast.error('Sua sessão expirou. Por favor, faça login novamente.');
      return;
    }
    
    setIsSaving(true);
    try {
      let savedId = proposalId;
      if (proposalId) {
        await updateProposal(proposalId, data);
        savedId = proposalId;
        toast.success('Proposta atualizada!');
      } else {
        if (!organization?.id) {
          toast.error('Organização não encontrada.');
          return;
        }
        const newProposal = await createProposal({ ...data, organization_id: organization.id, opportunity_id: opportunityId });
        if (newProposal?.id) {
          savedId = newProposal.id;
          window.history.replaceState(null, '', `/proposals/${newProposal.id}/edit`);
          toast.success('Proposta criada!');
        } else {
          toast.error('Erro ao criar proposta.');
          return;
        }
      }
      
      // ALWAYS recalculate totals and sync opportunity after save
      if (savedId) {
        await updateProposalTotals(savedId);
        await syncOpportunityValue(savedId);
        console.log('[ProposalEditorModal] Totals recalculated and opportunity synced');
      }
      
      if (savedId) {
        invalidateProposalCaches(queryClient, savedId, opportunityId);
      } else {
        queryClient.invalidateQueries({ queryKey: proposalKeys.lists() });
      }
      onSuccess?.();
    } catch (error) {
      console.error('[ProposalEditorModal] Error saving proposal:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Erro ao salvar proposta';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = String((error as any).message);
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta antes de gerar o PDF.');
      return;
    }
    setGeneratingPDF(true);
    try {
      const pdfBuffer = await generateProposalPDF(proposalId);
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposta-${proposalId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('PDF gerado com sucesso!');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Erro ao gerar PDF.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleGeneratePublicLink = async () => {
    if (!proposalId) {
      toast.error('Salve a proposta antes de gerar o link público.');
      return;
    }
    try {
      const token = await generatePublicToken(proposalId);
      setPublicToken(token);
      toast.success('Link público gerado!');
    } catch (error) {
      console.error('Error generating public link:', error);
      toast.error('Erro ao gerar link público.');
    }
  };

  const handleCopyPublicLink = () => {
    if (!publicToken) {
      toast.error('Link público não gerado.');
      return;
    }
    const publicLink = buildProposalPublicUrl(publicToken);
    navigator.clipboard.writeText(publicLink);
    toast.success('Link público copiado!');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full h-[100dvh] max-w-full md:max-w-7xl md:h-auto md:max-h-[90vh] rounded-none md:rounded-lg overflow-y-auto p-3 md:p-6">
        {/* Sprint 3: AI Suggestions Banner */}
        {itemSuggestions.length > 0 && activeTab === 'items' && (
          <Alert className="bg-blue-50 border-blue-200 mb-4">
            <Lightbulb className="h-4 w-4 text-blue-600" />
            <AlertDescription>
              <div className="font-medium text-blue-900 mb-2">{suggestionMessage}</div>
              {itemSuggestions.map((s, i) => (
                <div key={i} className="text-sm text-blue-700">
                  • {s.product_name} (usado {s.frequency}x)
                </div>
              ))}
            </AlertDescription>
          </Alert>
        )}
        {/* Rest of modal content */}
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{proposalId ? 'Editar Proposta' : 'Nova Proposta'}</DialogTitle>
            {proposalNumber && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="font-mono font-medium">{proposalNumber}</span>
                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                  v{proposalVersion}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full md:w-auto overflow-x-auto flex justify-start scrollbar-none">
            <TabsTrigger value="content" className="text-xs md:text-sm">Conteúdo</TabsTrigger>
            <TabsTrigger value="items" className="text-xs md:text-sm">Itens</TabsTrigger>
            <TabsTrigger value="payment-terms" className="text-xs md:text-sm">Pagamento</TabsTrigger>
            <TabsTrigger value="ai-copilot" className="text-xs md:text-sm">
              <Sparkles className="h-3 w-3 mr-1" />
              <span className="hidden sm:inline">AI </span>Copilot
            </TabsTrigger>
            <TabsTrigger value="preview" className="text-xs md:text-sm">Preview</TabsTrigger>
          </TabsList>
          <form onSubmit={handleSubmit(onSubmit)}>
            <TabsContent value="content" className="mt-4">
              <div className="grid gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Título</Label>
                    <Input id="title" defaultValue="" {...register('title')} />
                    {errors.title && (
                      <p className="text-red-500 text-sm">{errors.title.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="client_name">Nome do Cliente</Label>
                    <Input id="client_name" defaultValue="" {...register('client_name')} />
                    {errors.client_name && (
                      <p className="text-red-500 text-sm">{errors.client_name.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="client_email">Email do Cliente</Label>
                    <Input id="client_email" defaultValue="" {...register('client_email')} />
                    {errors.client_email && (
                      <p className="text-red-500 text-sm">{errors.client_email.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="value">Valor</Label>
                    <div className="flex gap-2">
                      <Select {...register('currency')} defaultValue="BRL">
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="BRL">R$ BRL</SelectItem>
                          <SelectItem value="USD">$ USD</SelectItem>
                          <SelectItem value="EUR">€ EUR</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        id="value"
                        type="number"
                        step="0.01"
                        defaultValue={0}
                        className="flex-1"
                        {...register('value', { valueAsNumber: true })}
                      />
                    </div>
                    {errors.value && (
                      <p className="text-red-500 text-sm">{errors.value.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="expires_at">Data de Expiração</Label>
                    <Input type="date" id="expires_at" defaultValue="" {...register('expires_at')} />
                    {errors.expires_at && (
                      <p className="text-red-500 text-sm">{errors.expires_at.message}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="template">Template</Label>
                    <Select onValueChange={handleTemplateChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id!}>
                            {template.name} {template.is_default && '(Padrão)'}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">
                      Ao selecionar, preenche layout, moeda, validade e textos
                    </p>
                  </div>
                  <div>
                    <Label htmlFor="layout_id">Layout Visual</Label>
                    <Select 
                      value={watch('layout_id') || ''} 
                      onValueChange={(value) => setValue('layout_id', value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Selecione um layout" />
                      </SelectTrigger>
                      <SelectContent>
                        {layouts.map((layout) => (
                          <SelectItem key={layout.id} value={layout.id}>
                            {layout.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="introduction">Introdução</Label>
                  <RichTextEditor
                    value={watch('introduction') || ''}
                    onChange={(value) => setValue('introduction', value)}
                    placeholder="Digite a introdução da proposta..."
                  />
                  {errors.introduction && (
                    <p className="text-red-500 text-sm">{errors.introduction.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="terms">Termos e Condições</Label>
                  <RichTextEditor
                    value={watch('terms') || ''}
                    onChange={(value) => setValue('terms', value)}
                    placeholder="Digite os termos e condições..."
                  />
                  {errors.terms && (
                    <p className="text-red-500 text-sm">{errors.terms.message}</p>
                  )}
                </div>
                <div>
                  <Label htmlFor="notes">Notas</Label>
                  <RichTextEditor
                    value={watch('notes') || ''}
                    onChange={(value) => setValue('notes', value)}
                    placeholder="Digite as notas adicionais..."
                  />
                  {errors.notes && (
                    <p className="text-red-500 text-sm">{errors.notes.message}</p>
                  )}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="items" className="mt-4">
              <ProposalItemsManager items={items} onChange={setItems} />
            </TabsContent>
            <TabsContent value="payment-terms" className="mt-4 space-y-4">
              <ProposalPaymentTerms 
                proposalId={proposalId || ''} 
                totalAmount={watch('value') || 0}
                terms={paymentTerms} 
                onChange={setPaymentTerms} 
              />
              {proposalId && (
                <>
                  <ProposalDynamicPricingPanel
                    proposalId={proposalId}
                    proposalTotal={watch('value') || 0}
                    eventStartDate={(watch as any)('event_start_date') ?? null}
                    validUntil={watch('expires_at') ?? null}
                    dynamicPricingApplicability={appliedTemplate?.dynamic_pricing_applicability ?? null}
                    dynamicPricingMode={appliedTemplate?.dynamic_pricing_mode ?? null}
                    revenueType={appliedTemplate?.revenue_type ?? null}
                  />
                </>
              )}
            </TabsContent>
            <TabsContent value="ai-copilot" className="mt-4">
              <AIProposalCopilot
                proposalId={proposalId}
                proposalData={watch()}
                opportunityData={opportunityId ? { id: opportunityId } : undefined}
                accountData={null}
                onIntroductionGenerated={(intro) => setValue('introduction', intro)}
                onPriceSuggestion={(price) => setValue('value', price)}
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-4">
              <ProposalPreview 
                proposalId={proposalId} 
                opportunityId={opportunityId}
                content={{
                  introduction: watch('introduction'),
                  terms: watch('terms'),
                  notes: watch('notes'),
                }}
              />
            </TabsContent>
            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end gap-2">
              {proposalId && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button variant="outline" onClick={handleGeneratePublicLink} disabled={generatingPDF} className="w-full sm:w-auto">
                    {generatingPDF ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="mr-2 h-4 w-4" />
                    )}
                    <span className="sm:inline">Link Público</span>
                  </Button>
                  {publicToken && (
                    <Button variant="outline" onClick={handleCopyPublicLink} className="w-full sm:w-auto">
                      <Copy className="mr-2 h-4 w-4" />
                      Copiar
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleGeneratePDF} disabled={generatingPDF} className="w-full sm:w-auto">
                    {generatingPDF ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="mr-2 h-4 w-4" />
                    )}
                    <span className="sm:inline">PDF</span>
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-initial">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="flex-1 sm:flex-initial">
                  {isSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  <span>Salvar</span>
                </Button>
              </div>
            </div>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
