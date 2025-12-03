import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RichTextEditor } from '@/components/proposals/RichTextEditor';
import { ProposalItemsManager } from '@/components/proposals/ProposalItemsManager';
import { ProposalPaymentTerms } from '@/components/proposals/ProposalPaymentTerms';
import { ProposalEditorHeader } from '@/components/proposals/ProposalEditorHeader';
import { ProposalContextCards } from '@/components/proposals/ProposalContextCards';
import { ProposalActionsBar } from '@/components/proposals/ProposalActionsBar';
import { AIProposalCopilot } from '@/components/proposals/AIProposalCopilot';
import { ProposalPreview } from '@/components/proposals/ProposalPreview';
import { ProposalParticipantsManager } from '@/components/proposals/ProposalParticipantsManager';
import { ProposalAnalyticsPanel } from '@/components/proposals/ProposalAnalyticsPanel';
import { ProposalAlertsCard } from '@/components/proposals/ProposalAlertsCard';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { 
  createProposal, 
  updateProposal,
  getProposal,
  generateProposalPDF,
  generatePublicToken,
} from '@/services/crm/proposals';
import { 
  listProposalItems,
  createProposalItem,
  deleteProposalItem,
} from '@/services/crm/proposal-items';
import {
  getPaymentTerms,
  createPaymentTerm,
  deletePaymentTerm,
} from '@/services/crm/proposal-payment-terms';
import { autoFillProposal, suggestProposalItems } from '@/services/crm/proposal-autofill';
import { getOpportunity } from '@/services/crm/opportunities';
import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm } from '@/services/crm/proposal-payment-terms';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { listLayouts } from '@/services/crm/proposal-layouts';
import { listTemplates } from '@/services/crm/proposal-templates';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useDebounce } from '@/hooks/useDebounce';

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

interface DraftData {
  form: ProposalFormData;
  items: ProposalItem[];
  paymentTerms: PaymentTerm[];
}

export default function ProposalEditor() {
  const { id: proposalId } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const opportunityId = searchParams.get('opportunity_id') || undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

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
  const [status, setStatus] = useState<string>('draft');
  const [currentProposalId, setCurrentProposalId] = useState<string | undefined>(proposalId);
  const [contextData, setContextData] = useState<{
    account?: any;
    contact?: any;
    owner?: any;
  }>({});
  
  // Form persistence state
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const isInitialLoadRef = useRef(true);
  const hasRestoredFromStorageRef = useRef(false);

  const isNewProposal = !proposalId || proposalId === 'new';
  
  // Persistence key based on proposal or opportunity
  const persistenceKey = proposalId && proposalId !== 'new' 
    ? proposalId 
    : opportunityId 
      ? `new-${opportunityId}` 
      : 'new';

  const { loadDraft, saveDraft, clearDraft, hasDraft, getLastSavedTime } = useFormPersistence<DraftData>({
    key: persistenceKey,
  });

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      currency: 'BRL',
    }
  });

  // Watch all form values for auto-save
  const formValues = watch();
  const debouncedFormValues = useDebounce(formValues, 500);

  // Load available layouts
  const { data: layouts = [] } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
  });

  // Load available templates (content templates linked to layouts)
  const { data: templates = [] } = useQuery({
    queryKey: ['proposal-templates'],
    queryFn: listTemplates,
  });

  // Watch layout_id to auto-fill from template when layout changes
  const watchedLayoutId = watch('layout_id');
  
  // Auto-fill from template when layout is selected (only for new proposals)
  useEffect(() => {
    // Wait for templates to load and layout to be selected
    if (!watchedLayoutId || !isNewProposal || templates.length === 0) return;
    
    // Find template linked to this layout
    const linkedTemplate = templates.find((t: any) => t.layout_id === watchedLayoutId);
    
    if (linkedTemplate) {
      // Only fill if fields are empty (don't overwrite user content)
      const currentIntro = watch('introduction');
      const currentTerms = watch('terms');
      const currentNotes = watch('notes');
      
      let applied = false;
      
      if (!currentIntro && linkedTemplate.introduction) {
        setValue('introduction', linkedTemplate.introduction);
        applied = true;
      }
      if (!currentTerms && linkedTemplate.terms) {
        setValue('terms', linkedTemplate.terms);
        applied = true;
      }
      if (!currentNotes && (linkedTemplate.notes || linkedTemplate.observations)) {
        setValue('notes', linkedTemplate.notes || linkedTemplate.observations);
        applied = true;
      }
      
      if (applied) {
        toast.success(`📄 Conteúdo do template "${linkedTemplate.name}" aplicado!`);
      }
    }
  }, [watchedLayoutId, templates, isNewProposal, setValue, watch]);

  // Load proposal data if editing
  const { data: proposalData, isLoading: isProposalLoading } = useQuery({
    queryKey: ['proposal', proposalId],
    queryFn: () => getProposal(proposalId!),
    enabled: !isNewProposal && !!proposalId,
  });

  // Load opportunity data
  const { data: opportunityData } = useQuery({
    queryKey: ['opportunity', opportunityId || proposalData?.opportunity_id],
    queryFn: () => getOpportunity(opportunityId || proposalData?.opportunity_id!),
    enabled: !!(opportunityId || proposalData?.opportunity_id),
  });

  // Validate pipeline type - proposals only allowed in sales pipelines
  useEffect(() => {
    if (opportunityData) {
      const pipelineType = (opportunityData as any)?.pipeline?.pipeline_type;
      if (pipelineType && pipelineType !== 'sales') {
        toast.error('Propostas só podem ser criadas em funis de vendas. Qualifique esta oportunidade primeiro.');
        navigate(-1);
      }
    }
  }, [opportunityData, navigate]);

  // Restore draft from localStorage on mount
  useEffect(() => {
    if (hasDraft()) {
      const draft = loadDraft();
      if (draft) {
        reset(draft.form);
        setItems(draft.items || []);
        setPaymentTerms(draft.paymentTerms || []);
        hasRestoredFromStorageRef.current = true;
        setLastSaved(getLastSavedTime());
        toast.info('📝 Rascunho restaurado automaticamente');
      }
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill when creating from opportunity (only if no draft restored)
  useEffect(() => {
    if (isNewProposal && opportunityId && !hasRestoredFromStorageRef.current) {
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
  }, [isNewProposal, opportunityId, reset, organization]);

  // Load proposal data when editing (only if no draft restored)
  useEffect(() => {
    if (proposalData && !hasRestoredFromStorageRef.current) {
      const proposal = proposalData as any;
      reset({
        title: proposal.title,
        client_name: proposal.client_name,
        client_email: proposal.client_email,
        value: proposal.value,
        expires_at: proposal.expires_at,
        introduction: proposal.introduction,
        terms: proposal.terms,
        notes: proposal.notes,
        layout_id: proposal.layout_id,
        currency: proposal.currency || 'BRL',
      });
      setPublicToken(proposal.public_token);
      setProposalNumber(proposal.proposal_number || '');
      setProposalVersion(proposal.proposal_version || 1);
      setStatus(proposal.status || 'draft');
      setCurrentProposalId(proposal.id);
    }
  }, [proposalData, reset]);

  // Load proposal items
  useEffect(() => {
    if (currentProposalId && !isNewProposal && !hasRestoredFromStorageRef.current) {
      listProposalItems(currentProposalId).then(setItems);
    }
  }, [currentProposalId, isNewProposal]);

  // Load payment terms
  useEffect(() => {
    if (currentProposalId && !isNewProposal && !hasRestoredFromStorageRef.current) {
      getPaymentTerms(currentProposalId).then(setPaymentTerms);
    }
  }, [currentProposalId, isNewProposal]);

  // Load context data (account, contact, owner)
  useEffect(() => {
    if (opportunityData) {
      const opp = opportunityData as any;
      
      // Map owner data correctly from the profiles join
      const ownerData = opp.owner ? {
        id: opp.owner.user_id,
        full_name: opp.owner.full_name,
        avatar_url: opp.owner.avatar_url,
        email: null, // Will be fetched separately if needed
      } : null;
      
      setContextData({
        account: opp.account || opp.accounts,
        contact: opp.contact || opp.contacts,
        owner: ownerData,
      });
    }
  }, [opportunityData]);

  // Auto-update value when items change
  useEffect(() => {
    if (items.length > 0) {
      const total = items.reduce((sum, item) => sum + item.total, 0);
      const currentValue = watch('value');
      // Only update if significantly different (avoid infinite loops)
      if (!currentValue || Math.abs(total - currentValue) > 0.01) {
        setValue('value', total);
      }
    }
  }, [items, setValue, watch]);

  // Auto-save to localStorage when form values change
  useEffect(() => {
    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Save draft
    const draft: DraftData = {
      form: debouncedFormValues,
      items,
      paymentTerms,
    };
    saveDraft(draft);
    setLastSaved(new Date());
  }, [debouncedFormValues, items, paymentTerms, saveDraft]);

  // Save items to database
  const saveItemsToDb = async (proposalId: string) => {
    // First, delete existing items
    const existingItems = await listProposalItems(proposalId);
    for (const item of existingItems) {
      if (item.id) {
        await deleteProposalItem(item.id);
      }
    }
    
    // Then create new items
    for (const item of items) {
      await createProposalItem({
        ...item,
        proposal_id: proposalId,
      });
    }
  };

  // Save payment terms to database
  const savePaymentTermsToDb = async (proposalId: string) => {
    // First, delete existing terms
    const existingTerms = await getPaymentTerms(proposalId);
    for (const term of existingTerms) {
      if (term.id) {
        await deletePaymentTerm(term.id);
      }
    }
    
    // Then create new terms
    for (const term of paymentTerms) {
      await createPaymentTerm({
        ...term,
        proposal_id: proposalId,
      });
    }
  };

  const onSubmit = async (data: ProposalFormData) => {
    setIsSaving(true);
    try {
      let savedProposalId = currentProposalId;
      
      if (currentProposalId && !isNewProposal) {
        await updateProposal(currentProposalId, data);
        toast.success('Proposta atualizada!');
      } else {
        const newProposal = await createProposal({ 
          ...data, 
          opportunity_id: opportunityId,
          status: 'draft'
        }) as any;
        if (newProposal?.id) {
          savedProposalId = newProposal.id;
          setCurrentProposalId(newProposal.id);
          setProposalNumber(newProposal.proposal_number || '');
          setProposalVersion(newProposal.proposal_version || 1);
          navigate(`/app/proposals/${newProposal.id}/edit`, { replace: true });
          toast.success('Proposta criada!');
        }
      }

      // Save items and payment terms to database
      if (savedProposalId) {
        if (items.length > 0) {
          await saveItemsToDb(savedProposalId);
        }
        if (paymentTerms.length > 0) {
          await savePaymentTermsToDb(savedProposalId);
        }
      }

      // Clear draft after successful save
      clearDraft();
      setLastSaved(null);
      hasRestoredFromStorageRef.current = false;
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    } catch (error) {
      console.error('Error saving proposal:', error);
      toast.error('Erro ao salvar proposta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    // If no proposal saved yet, save first
    if (!currentProposalId) {
      toast.info('Salvando proposta antes de gerar PDF...');
      await handleSubmit(onSubmit)();
      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!currentProposalId) {
      toast.error('Erro ao salvar proposta. Tente novamente.');
      return;
    }
    
    setGeneratingPDF(true);
    try {
      const pdfBuffer = await generateProposalPDF(currentProposalId);
      const pdfBlob = new Blob([pdfBuffer], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `proposta-${proposalNumber || currentProposalId}.pdf`;
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
    // If no proposal saved yet, save first
    if (!currentProposalId) {
      toast.info('Salvando proposta antes de gerar link...');
      await handleSubmit(onSubmit)();
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    if (!currentProposalId) {
      toast.error('Erro ao salvar proposta. Tente novamente.');
      return;
    }
    
    try {
      const token = await generatePublicToken(currentProposalId);
      setPublicToken(token);
      setStatus('sent'); // Update local status since generatePublicToken now sets it to 'sent'
      const publicLink = `${window.location.origin}/public/proposal/${token}`;
      navigator.clipboard.writeText(publicLink);
      toast.success('Link público gerado e copiado! Proposta marcada como enviada.');
    } catch (error) {
      console.error('Error generating public link:', error);
      toast.error('Erro ao gerar link público.');
    }
  };

  const handleCopyPublicLink = () => {
    if (!publicToken) {
      handleGeneratePublicLink();
      return;
    }
    const publicLink = `${window.location.origin}/public/proposal/${publicToken}`;
    navigator.clipboard.writeText(publicLink);
    toast.success('Link público copiado!');
  };

  const handleBack = () => {
    if (opportunityId) {
      navigate(`/app/opportunities/${opportunityId}`);
    } else {
      navigate('/app/proposals');
    }
  };

  if (isProposalLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  const itemsTotal = items.reduce((sum, item) => sum + item.total, 0);

  return (
    <Layout>
      <div className="flex flex-col h-full pb-20">
        {/* Header */}
        <ProposalEditorHeader
          proposalNumber={proposalNumber}
          version={proposalVersion}
          status={status}
          isNew={isNewProposal}
          onBack={handleBack}
          lastSaved={lastSaved}
        />

        {/* Context Cards */}
        <ProposalContextCards
          account={contextData.account}
          contact={contextData.contact}
          owner={contextData.owner}
        />

        {/* AI Suggestions Banner */}
        {itemSuggestions.length > 0 && activeTab === 'items' && (
          <Alert className="bg-blue-50 border-blue-200 mx-6 mb-4">
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

        {/* Main Content */}
        <div className="flex-1 px-6 overflow-y-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="items">
                Itens {items.length > 0 && <Badge variant="secondary" className="ml-1">{items.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="payment-terms">Pagamento</TabsTrigger>
              <TabsTrigger value="team">Equipe</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="ai-copilot">AI Copilot</TabsTrigger>
              <TabsTrigger value="preview">Visualizar</TabsTrigger>
            </TabsList>

            <form id="proposal-form" onSubmit={handleSubmit(onSubmit)}>
              <TabsContent value="content" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="title">Título *</Label>
                    <Input id="title" {...register('title')} placeholder="Título da proposta" />
                    {errors.title && <p className="text-destructive text-sm">{errors.title.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_name">Nome do Cliente</Label>
                    <Input id="client_name" {...register('client_name')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="client_email">Email do Cliente</Label>
                    <Input id="client_email" type="email" {...register('client_email')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Valor</Label>
                    <div className="flex gap-2">
                      <Select 
                        value={watch('currency') || 'BRL'} 
                        onValueChange={(v) => setValue('currency', v as 'BRL' | 'USD' | 'EUR')}
                      >
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
                        type="number"
                        step="0.01"
                        className="flex-1"
                        {...register('value', { valueAsNumber: true })}
                      />
                    </div>
                    {itemsTotal > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Total dos itens: R$ {itemsTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_at">Data de Expiração</Label>
                    <Input type="date" id="expires_at" {...register('expires_at')} />
                  </div>
                  <div className="space-y-2">
                    <Label>Layout</Label>
                    <Select 
                      value={watch('layout_id') || ''} 
                      onValueChange={(v) => setValue('layout_id', v)}
                    >
                      <SelectTrigger>
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

                <div className="space-y-2">
                  <Label>Introdução</Label>
                  <RichTextEditor
                    value={watch('introduction') || ''}
                    onChange={(value) => setValue('introduction', value)}
                    placeholder="Digite a introdução da proposta..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Termos e Condições</Label>
                  <RichTextEditor
                    value={watch('terms') || ''}
                    onChange={(value) => setValue('terms', value)}
                    placeholder="Digite os termos e condições..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notas</Label>
                  <RichTextEditor
                    value={watch('notes') || ''}
                    onChange={(value) => setValue('notes', value)}
                    placeholder="Digite as notas adicionais..."
                  />
                </div>
              </TabsContent>

              <TabsContent value="items">
                <ProposalItemsManager items={items} onChange={setItems} />
              </TabsContent>

              <TabsContent value="payment-terms">
                <ProposalPaymentTerms 
                  proposalId={currentProposalId || ''} 
                  totalAmount={watch('value') || 0}
                  terms={paymentTerms} 
                  onChange={setPaymentTerms}
                  items={items}
                />
              </TabsContent>

              <TabsContent value="team">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <ProposalParticipantsManager 
                    proposalId={currentProposalId || ''} 
                    disabled={isNewProposal}
                  />
                  <ProposalAlertsCard proposalId={currentProposalId || ''} />
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                <ProposalAnalyticsPanel proposalId={currentProposalId || ''} />
              </TabsContent>

              <TabsContent value="ai-copilot">
                <AIProposalCopilot
                  proposalId={currentProposalId}
                  proposalData={watch()}
                  opportunityData={opportunityId ? { id: opportunityId } : undefined}
                  accountData={contextData.account}
                  onIntroductionGenerated={(intro) => setValue('introduction', intro)}
                  onPriceSuggestion={(price) => setValue('value', price)}
                />
              </TabsContent>

              <TabsContent value="preview">
                <ProposalPreview 
                  proposalId={currentProposalId} 
                  opportunityId={opportunityId || proposalData?.opportunity_id}
                  content={{
                    introduction: watch('introduction'),
                    terms: watch('terms'),
                    notes: watch('notes'),
                  }}
                  items={items}
                  paymentTerms={paymentTerms}
                  totalValue={watch('value')}
                  currency={watch('currency')}
                />
              </TabsContent>
            </form>
          </Tabs>
        </div>

        {/* Fixed Actions Bar */}
        <ProposalActionsBar
          onBack={handleBack}
          onSave={handleSubmit(onSubmit)}
          onGeneratePDF={handleGeneratePDF}
          onGenerateLink={handleCopyPublicLink}
          isSaving={isSaving}
          isGeneratingPDF={generatingPDF}
          hasPublicToken={!!publicToken}
          proposalId={currentProposalId}
        />
      </div>
    </Layout>
  );
}
