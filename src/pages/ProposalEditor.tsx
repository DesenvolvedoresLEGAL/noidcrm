import { useState, useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lightbulb, Loader2 } from 'lucide-react';
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
} from '@/services/crm/proposal-items';
import {
  getPaymentTerms,
} from '@/services/crm/proposal-payment-terms';
import { autoFillProposal, suggestProposalItems } from '@/services/crm/proposal-autofill';
import { getOpportunity } from '@/services/crm/opportunities';
import { ProposalItem } from '@/services/crm/proposal-items';
import { PaymentTerm } from '@/services/crm/proposal-payment-terms';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { listLayouts } from '@/services/crm/proposal-layouts';

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

  const isNewProposal = !proposalId || proposalId === 'new';

  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm<ProposalFormData>({
    resolver: zodResolver(proposalSchema),
    defaultValues: {
      currency: 'BRL',
    }
  });

  // Load available layouts
  const { data: layouts = [] } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
  });

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

  // Auto-fill when creating from opportunity
  useEffect(() => {
    if (isNewProposal && opportunityId) {
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

  // Load proposal data when editing
  useEffect(() => {
    if (proposalData) {
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
    if (currentProposalId && !isNewProposal) {
      listProposalItems(currentProposalId).then(setItems);
    } else {
      setItems([]);
    }
  }, [currentProposalId, isNewProposal]);

  // Load payment terms
  useEffect(() => {
    if (currentProposalId && !isNewProposal) {
      getPaymentTerms(currentProposalId).then(setPaymentTerms);
    } else {
      setPaymentTerms([]);
    }
  }, [currentProposalId, isNewProposal]);

  // Load context data (account, contact, owner)
  useEffect(() => {
    if (opportunityData) {
      const opp = opportunityData as any;
      setContextData({
        account: opp.account || opp.accounts,
        contact: opp.contact || opp.contacts,
        owner: opp.owner || opp.profiles,
      });
    }
  }, [opportunityData]);

  const onSubmit = async (data: ProposalFormData) => {
    setIsSaving(true);
    try {
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
          setCurrentProposalId(newProposal.id);
          setProposalNumber(newProposal.proposal_number || '');
          setProposalVersion(newProposal.proposal_version || 1);
          navigate(`/app/proposals/${newProposal.id}/edit`, { replace: true });
          toast.success('Proposta criada!');
        }
      }
      queryClient.invalidateQueries({ queryKey: ['proposals'] });
    } catch (error) {
      console.error('Error saving proposal:', error);
      toast.error('Erro ao salvar proposta.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!currentProposalId) {
      toast.error('Salve a proposta antes de gerar o PDF.');
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
    if (!currentProposalId) {
      toast.error('Salve a proposta antes de gerar o link público.');
      return;
    }
    try {
      const token = await generatePublicToken(currentProposalId);
      setPublicToken(token);
      toast.success('Link público gerado!');
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
            <TabsList className="mb-4">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="items">Itens</TabsTrigger>
              <TabsTrigger value="payment-terms">Pagamento</TabsTrigger>
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
                />
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
