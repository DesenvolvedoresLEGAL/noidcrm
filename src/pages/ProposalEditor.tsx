import { useState, useEffect, useRef } from 'react';
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
import { ProposalVisualizarTab } from '@/components/proposals/ProposalVisualizarTab';
import { ProposalParticipantsManager } from '@/components/proposals/ProposalParticipantsManager';
import { ProposalInventoryPanel } from '@/components/proposals/ProposalInventoryPanel';
import { ProposalDynamicPricingPanel } from '@/components/proposals/ProposalDynamicPricingPanel';
import { DynamicPricingMismatchAlert } from '@/components/proposals/DynamicPricingMismatchAlert';

// Analytics moved to OpportunityAnalyticsTab
import { AIInlineButton } from '@/components/proposals/AIInlineButton';
import { ViewingNowIndicator } from '@/components/proposals/ViewingNowIndicator';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Lightbulb, Loader2, CalendarIcon, AlertTriangle, Building2, User, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { formatDateBR, parseDateOnly } from '@/lib/dateUtils';
import { toast } from 'sonner';
import { 
  createProposal, 
  updateProposal,
  getProposal,
  getProposalWithDetails,
  generatePublicToken,
  updateProposalTotals,
  syncOpportunityValue,
} from '@/services/crm/proposals';
import { buildProposalPublicUrl } from '@/lib/proposalUrl';
import { generateIntroduction } from '@/services/crm/proposal-ai';
import { downloadProposalPDF } from '@/lib/proposalPdfGenerator';
import { buildProposalPDFData } from '@/lib/proposalPdfBuilder';
import { calculateInstallments } from '@/services/crm/proposal-payment-terms';
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
import { useProposalRealtime } from '@/hooks/useProposalRealtime';
import { listLayouts } from '@/services/crm/proposal-layouts';
import { listTemplates, applyTemplate } from '@/services/crm/proposal-templates';
import { orchestrateProposalFinancials } from '@/services/proposals/proposalOrchestrator';
import { invalidateProposalCaches } from '@/hooks/proposals/useProposalOrchestrator';
import { useFormPersistence } from '@/hooks/useFormPersistence';
import { useDebounce } from '@/hooks/useDebounce';
import { supabase } from '@/integrations/supabase/client';
import { proposalKeys, opportunityKeys } from '@/lib/query-keys';

const proposalSchema = z.object({
  title: z.string().optional(),
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
  const preselectedTemplateId = searchParams.get('template_id') || undefined;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { organization } = useCurrentOrganization();

  // Real-time viewing notifications
  const { activeViewers, isViewingNow } = useProposalRealtime(proposalId);

  const [activeTab, setActiveTab] = useState('content');
  const [items, setItems] = useState<ProposalItem[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<PaymentTerm[]>([]);
  const [paymentTermsError, setPaymentTermsError] = useState<string | null>(null);
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
    ownerName?: string;
    ownerAvatar?: string;
  }>({});
  const [previewProposalNumber, setPreviewProposalNumber] = useState<string>('');
  
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

  // Derive applied template by template_name on the proposal or by linked layout
  const watchedLayoutIdForTemplate = watch('layout_id');
  const watchedTemplateName = (watch as any)('template_name') as string | undefined;
  const appliedTemplate: any = (() => {
    if (!templates.length) return null;
    if (watchedTemplateName) {
      const byName = templates.find((t: any) => t.name === watchedTemplateName);
      if (byName) return byName;
    }
    if (watchedLayoutIdForTemplate) {
      return templates.find((t: any) => t.layout_id === watchedLayoutIdForTemplate) || null;
    }
    return null;
  })();

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

  // Apply preselected template (from "Criar Proposta" template picker)
  const appliedPreselectedRef = useRef(false);
  useEffect(() => {
    if (!isNewProposal || !preselectedTemplateId || templates.length === 0) return;
    if (appliedPreselectedRef.current) return;
    const template: any = templates.find((t: any) => t.id === preselectedTemplateId);
    if (!template) return;
    appliedPreselectedRef.current = true;

    if (template.layout_id) setValue('layout_id', template.layout_id);
    if (template.currency) setValue('currency', template.currency as 'BRL' | 'USD' | 'EUR');
    if (template.name) (setValue as any)('template_name', template.name);
    const days = template.default_validity_days ?? template.validity_days;
    if (days) {
      const d = new Date();
      d.setDate(d.getDate() + Number(days));
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      setValue('expires_at', `${y}-${m}-${dd}`);
    }
    if (template.introduction) setValue('introduction', template.introduction);
    if (template.terms) setValue('terms', template.terms);
    if (template.notes || template.observations) {
      setValue('notes', template.notes || template.observations);
    }
    toast.success(`📄 Template "${template.name}" aplicado!`);
  }, [preselectedTemplateId, templates, isNewProposal, setValue]);

  // Load proposal data if editing
  const { data: proposalData, isLoading: isProposalLoading } = useQuery({
    queryKey: proposalKeys.detail(proposalId),
    queryFn: () => getProposal(proposalId!),
    enabled: !isNewProposal && !!proposalId,
  });

  // Load opportunity data
  const { data: opportunityData } = useQuery({
    queryKey: opportunityKeys.detail(opportunityId || proposalData?.opportunity_id),
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

  // Restore draft from localStorage ONLY for new proposals
  useEffect(() => {
    // Only restore draft for NEW proposals (not editing existing ones)
    if (isNewProposal && hasDraft()) {
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
    // For existing proposals, clear any old drafts
    if (!isNewProposal) {
      clearDraft();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNewProposal]);

  // Auto-fill when creating from opportunity (only if no draft restored)
  useEffect(() => {
    if (isNewProposal && opportunityId && !hasRestoredFromStorageRef.current) {
      autoFillProposal(opportunityId).then((data) => {
        reset({
          title: data.title,
          introduction: data.introduction,
          terms: data.terms,
          notes: data.notes,
          expires_at: data.expires_at,
          layout_id: data.layout_id,
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

  // Fetch preview of next proposal number for new proposals
  useEffect(() => {
    if (isNewProposal && organization?.id) {
      supabase.rpc('preview_next_proposal_number', { p_org_id: organization.id })
        .then(({ data }) => {
          if (data) setPreviewProposalNumber(data);
        });
    }
  }, [isNewProposal, organization?.id]);

  // Load proposal data when editing - ALWAYS load from DB for existing proposals
  // Wait for layouts to be loaded to ensure Select component can match the value
  useEffect(() => {
    if (proposalData && !isNewProposal && layouts.length > 0) {
      const proposal = proposalData as any;
      console.log('[ProposalEditor] Loading proposal from DB:', proposal);
      console.log('[ProposalEditor] Available layouts:', layouts.length);
      console.log('[ProposalEditor] Proposal layout_id:', proposal.layout_id);
      
      // Use setTimeout to ensure form reset happens after render cycle
      const formData = {
        title: proposal.title || '',
        expires_at: proposal.expires_at ? proposal.expires_at.split('T')[0] : '',
        introduction: proposal.introduction || '',
        terms: proposal.terms || '',
        notes: proposal.notes || '',
        layout_id: proposal.layout_id || '',
        currency: proposal.currency || 'BRL',
      };
      
      reset(formData);
      
      // Also explicitly set layout_id after reset to ensure it sticks
      if (proposal.layout_id) {
        setValue('layout_id', proposal.layout_id);
      }
      
      setPublicToken(proposal.public_token || null);
      setProposalNumber(proposal.proposal_number || '');
      setProposalVersion(proposal.proposal_version || 1);
      setStatus(proposal.status || 'draft');
      setCurrentProposalId(proposal.id);
    }
  }, [proposalData, isNewProposal, reset, layouts.length, setValue]);

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

  // Lazy orchestration: when an existing proposal is eligible (Evento automático)
  // but has no current snapshot/tiers, run orchestrator once to materialize it.
  // Also: if proposal has template_name but no commercial rules persisted,
  // re-apply the template first to backfill rules.
  const lazyOrchestratedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!proposalData || isNewProposal || templates.length === 0) return;
    const p: any = proposalData;
    if (lazyOrchestratedRef.current === p.id) return;

    const hasRules =
      p.revenue_type ||
      (p.dynamic_pricing_applicability && p.dynamic_pricing_applicability !== 'none');

    const tplByName = p.template_name
      ? (templates as any[]).find((t) => t.name === p.template_name)
      : null;

    const tplApplicability = tplByName?.dynamic_pricing_applicability;
    const tplRevenue = tplByName?.revenue_type;
    const tplIsAutoEvent =
      tplApplicability === 'automatic' &&
      ['one_time_event', 'one_time_non_event'].includes(tplRevenue ?? '');

    const isAutoEvent =
      (p.dynamic_pricing_applicability === 'automatic' &&
        p.dynamic_pricing_mode === 'automatic_by_valid_until' &&
        ['one_time_event', 'one_time_non_event'].includes(p.revenue_type ?? '')) ||
      tplIsAutoEvent;

    const missingSnapshot =
      !p.dynamic_pricing_current_amount || Number(p.dynamic_pricing_current_amount) <= 0;

    if (isAutoEvent && p.expires_at && missingSnapshot) {
      lazyOrchestratedRef.current = p.id;
      (async () => {
        try {
          if (!hasRules && tplByName?.id) {
            await applyTemplate(p.id, tplByName.id);
          }
          await orchestrateProposalFinancials(p.id, 'editor_open_lazy');
          invalidateProposalCaches(queryClient, p.id, opportunityId || (p as any).opportunity_id);
          getPaymentTerms(p.id).then(setPaymentTerms);
        } catch (e) {
          console.warn('[ProposalEditor] lazy orchestrate failed:', e);
        }
      })();
    }
  }, [proposalData, isNewProposal, templates, queryClient]);

  // Load context data (account, contact, owner)
  useEffect(() => {
    const loadContextData = async () => {
      if (!opportunityData) return;
      
      const opp = opportunityData as any;
      let ownerName = opp.owner?.full_name;
      let ownerAvatar = opp.owner?.avatar_url;
      
      // If owner is not loaded but owner_user_id exists, fetch it
      if (!ownerName && opp.owner_user_id) {
        const { data: ownerProfile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('user_id', opp.owner_user_id)
          .maybeSingle();
        
        if (ownerProfile) {
          ownerName = ownerProfile.full_name;
          ownerAvatar = ownerProfile.avatar_url;
        }
      }
      
      setContextData({
        account: opp.account || opp.accounts,
        contact: opp.contact || opp.contacts,
        ownerName,
        ownerAvatar,
      });
    };
    
    loadContextData();
  }, [opportunityData]);

  // Auto-save to localStorage ONLY for new proposals
  useEffect(() => {
    // Skip for existing proposals - they save to database
    if (!isNewProposal) return;
    
    // Skip initial load
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      return;
    }

    // Save draft only for new proposals
    const draft: DraftData = {
      form: debouncedFormValues,
      items,
      paymentTerms,
    };
    saveDraft(draft);
    setLastSaved(new Date());
  }, [debouncedFormValues, items, paymentTerms, saveDraft, isNewProposal]);

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
    console.log('[ProposalEditor] onSubmit called with data:', data);
    console.log('[ProposalEditor] currentProposalId:', currentProposalId);
    console.log('[ProposalEditor] isNewProposal:', isNewProposal);
    console.log('[ProposalEditor] opportunityId from URL:', opportunityId);
    
    // CRITICAL: Check session validity before saving
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData?.session) {
      console.error('[ProposalEditor] Session expired or invalid:', sessionError);
      toast.error('Sua sessão expirou. Por favor, faça login novamente.');
      return;
    }
    
    // CRITICAL: Validate opportunity_id before creating new proposal
    if (isNewProposal && !opportunityId) {
      toast.error('Erro: Oportunidade não identificada. Volte à oportunidade e crie a proposta novamente.');
      console.error('[ProposalEditor] BLOCKED: Attempted to create proposal without opportunity_id');
      return;
    }

    // Sprint TEMPLATE 1.0: template pode exigir validade
    if (appliedTemplate?.requires_valid_until && !data.expires_at) {
      toast.error('Este template exige validade da proposta para calcular a condição comercial.');
      return;
    }

    // CRITICAL: Bloquear salvar sem condições de pagamento, exceto rascunho.
    // Evita propostas enviadas ao cliente sem o quadro de Pagamento Avulso/MRR.
    const effectiveStatus = (data as any)?.status || status;
    if (effectiveStatus !== 'draft' && (!paymentTerms || paymentTerms.length === 0)) {
      const msg = 'Defina pelo menos uma condição de pagamento (Avulso ou Recorrente) antes de salvar fora de rascunho.';
      setPaymentTermsError(msg);
      toast.error(msg);
      console.warn('[ProposalEditor] BLOCKED: save without paymentTerms on status', effectiveStatus);
      setActiveTab('payment-terms');
      return;
    }
    setPaymentTermsError(null);

    setIsSaving(true);
    try {
      let savedProposalId = currentProposalId;
      
      if (currentProposalId && !isNewProposal) {
        console.log('[ProposalEditor] Updating existing proposal with data:', JSON.stringify(data, null, 2));
        console.log('[ProposalEditor] layout_id being saved:', data.layout_id);
        const updated = await updateProposal(currentProposalId, data) as any;
        console.log('[ProposalEditor] Update result:', updated);
        // Update local state with returned data
        if (updated) {
          setProposalNumber(updated.proposal_number || proposalNumber);
          setProposalVersion(updated.proposal_version || proposalVersion);
          setStatus(updated.status || status);
          // Ensure layout_id is preserved in form
          if (updated.layout_id) {
            setValue('layout_id', updated.layout_id);
          }
        }
        toast.success('Proposta atualizada!');
      } else {
        // Double-check opportunity_id before creation
        if (!opportunityId) {
          throw new Error('opportunity_id é obrigatório para criar proposta');
        }
        
        console.log('[ProposalEditor] Creating new proposal for opportunity:', opportunityId);
        const newProposal = await createProposal({ 
          ...data, 
          opportunity_id: opportunityId,
          status: 'draft'
        }) as any;
        console.log('[ProposalEditor] Create result:', newProposal);
        if (newProposal?.id) {
          savedProposalId = newProposal.id;
          
          // CRITICAL: Save items and payment terms BEFORE navigating
          // Navigation causes component remount which loses unsaved state
          // ORDER: items → payment terms → totals → sync (discount must be saved before recalc)
          console.log('[ProposalEditor] Saving items and payment terms for new proposal BEFORE navigate...');
          if (items.length > 0) {
            await saveItemsToDb(savedProposalId);
            console.log('[ProposalEditor] Items saved for new proposal');
          }
          if (paymentTerms.length > 0) {
            await savePaymentTermsToDb(savedProposalId);
            console.log('[ProposalEditor] Payment terms saved for new proposal');
          }

          // CRITICAL: Apply template to persist commercial rules (revenue_type,
          // dynamic_pricing_applicability/mode, validity_strategy, payment_mode, template_name)
          if (preselectedTemplateId) {
            try {
              await applyTemplate(savedProposalId, preselectedTemplateId);
              console.log('[ProposalEditor] Template commercial rules applied');
            } catch (e) {
              console.warn('[ProposalEditor] applyTemplate failed (non-blocking):', e);
            }
          }

          // ALWAYS recalculate totals — even without items, payment term discount may have changed
          await updateProposalTotals(savedProposalId);
          await syncOpportunityValue(savedProposalId);
          console.log('[ProposalEditor] Totals recalculated and synced (with discount applied)');

          // Orchestrate: ensure dynamic pricing tiers, snapshot, payment defaults
          try {
            await orchestrateProposalFinancials(savedProposalId, 'create_with_template');
          } catch (e) {
            console.warn('[ProposalEditor] orchestrate failed (non-blocking):', e);
          }

          // Clear draft and invalidate queries
          clearDraft();
          setLastSaved(null);
          hasRestoredFromStorageRef.current = false;
          invalidateProposalCaches(queryClient, savedProposalId, opportunityId || proposalData?.opportunity_id);

          // Update state and navigate AFTER saving everything
          setCurrentProposalId(newProposal.id);
          setProposalNumber(newProposal.proposal_number || '');
          setProposalVersion(newProposal.proposal_version || 1);
          
          navigate(`/app/proposals/${newProposal.id}/edit`, { replace: true });
          toast.success('Proposta criada com sucesso!');
          
          setIsSaving(false);
          return; // Early return - everything is already saved
        }
      }

      // Save items and payment terms to database (only for existing proposals now)
      // ORDER: items → payment terms → totals → sync (discount must be saved before recalc)
      if (savedProposalId && !isNewProposal) {
        console.log('[ProposalEditor] Saving items and payment terms for existing proposal...');
        if (items.length > 0) {
          await saveItemsToDb(savedProposalId);
        }
        if (paymentTerms.length > 0) {
          await savePaymentTermsToDb(savedProposalId);
        }
        // ALWAYS recalculate totals — even without items, payment term discount may have changed
        await updateProposalTotals(savedProposalId);
        await syncOpportunityValue(savedProposalId);
        console.log('[ProposalEditor] Synced proposal totals and opportunity value (with discount applied)');

        // Orchestrate after save: regen tiers, snapshot, payment defaults
        try {
          await orchestrateProposalFinancials(savedProposalId, 'editor_save');
        } catch (e) {
          console.warn('[ProposalEditor] orchestrate failed (non-blocking):', e);
        }
      }

      // Clear draft after successful save (only matters for new proposals)
      clearDraft();
      setLastSaved(null);
      hasRestoredFromStorageRef.current = false;
      if (savedProposalId) {
        invalidateProposalCaches(queryClient, savedProposalId, opportunityId || proposalData?.opportunity_id);
      }
      console.log('[ProposalEditor] Save completed successfully');
    } catch (error) {
      console.error('[ProposalEditor] Error saving proposal:', error);
      
      // Extract meaningful error message
      let errorMessage = 'Erro desconhecido ao salvar proposta';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        if ('message' in error) {
          errorMessage = String((error as any).message);
        } else if ('error' in error) {
          errorMessage = String((error as any).error);
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Form error handler
  const onFormError = (errors: any) => {
    console.error('[ProposalEditor] Form validation errors:', errors);
    toast.error('Erro de validação no formulário');
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
      // Fetch proposal with all relationships (organization, account, contact, seller)
      const proposalWithRelations = await getProposalWithDetails(currentProposalId);
      
      if (!proposalWithRelations) {
        throw new Error('Proposta não encontrada');
      }

      // Use centralized helper to build PDF data
      const { pdfData, pdfItems, installments, recurringPayment } = buildProposalPDFData(
        proposalWithRelations,
        items,
        paymentTerms
      );

      // Generate and download PDF client-side with recurring payment data
      await downloadProposalPDF(pdfData as any, pdfItems, installments, recurringPayment);
      
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
      const publicLink = buildProposalPublicUrl(token);
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
    const publicLink = buildProposalPublicUrl(publicToken);
    navigator.clipboard.writeText(publicLink);
    toast.success('Link público copiado!');
  };

  const handleBack = () => {
    // Always navigate to the related opportunity
    const oppId = opportunityId || proposalData?.opportunity_id;
    if (oppId) {
      navigate(`/app/opportunities/${oppId}`);
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

  // Show error if trying to create proposal without opportunity context
  if (isNewProposal && !opportunityId) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <Alert variant="destructive" className="max-w-md">
            <AlertTriangle className="h-5 w-5" />
            <AlertDescription className="ml-2">
              <strong>Erro: Contexto de oportunidade não encontrado.</strong>
              <br />
              Propostas devem ser criadas a partir de uma oportunidade.
              <br />
              <Button 
                variant="outline" 
                className="mt-4" 
                onClick={() => navigate('/app/opportunities')}
              >
                Voltar para Oportunidades
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      </Layout>
    );
  }

  // Calculate totals by billing type
  const oneTimeItems = items.filter(item => (item.billing_type || 'one_time') !== 'recurring');
  const recurringItems = items.filter(item => item.billing_type === 'recurring');
  
  const oneTimeTotal = oneTimeItems.reduce((sum, item) => sum + item.total, 0);
  const recurringTotal = recurringItems.reduce((sum, item) => sum + item.total, 0);
  
  // Get payment discount from one_time payment term
  const oneTimeTerm = paymentTerms.find(t => t.payment_type === 'one_time');
  const paymentDiscountPercent = oneTimeTerm?.discount_percent || 0;
  
  // Apply payment discount to one-time total
  const oneTimeWithDiscount = oneTimeTotal * (1 - paymentDiscountPercent / 100);
  
  // Calculate contract total for recurring (assume 12 months)
  const contractMonths = 12;
  const recurringContractTotal = recurringTotal * contractMonths;
  
  // Grand total with discount applied
  const itemsTotal = oneTimeWithDiscount + recurringContractTotal;

  // Get account/contact names for context banner
  const accountName = contextData.account?.nome_fantasia || contextData.account?.razao_social || 'Empresa não identificada';
  const contactName = contextData.contact?.nome || 'Contato não identificado';
  const opportunityTitle = (opportunityData as any)?.title || 'Oportunidade';

  return (
    <Layout>
      <div className="flex flex-col h-full">
        {/* Context Banner - Always visible for new proposals */}
        {isNewProposal && opportunityId && (
          <div className="bg-primary/5 border-b border-primary/20 px-4 py-2">
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Nova proposta para:</span>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-primary" />
                  <span className="font-medium">{accountName}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-medium">{contactName}</span>
                </div>
              </div>
              <Badge variant="outline" className="ml-auto">
                Oportunidade: {opportunityTitle}
              </Badge>
            </div>
          </div>
        )}
        
        {/* Header with Viewing Now Indicator */}
        <div className="relative">
          <ProposalEditorHeader
            proposalNumber={proposalNumber || previewProposalNumber}
            version={proposalVersion}
            status={status}
            isNew={isNewProposal}
            onBack={handleBack}
            onSave={handleSubmit(onSubmit, onFormError)}
            onGeneratePDF={handleGeneratePDF}
            isSaving={isSaving}
            isGeneratingPDF={generatingPDF}
            proposalId={currentProposalId}
            publicToken={publicToken}
            lastSaved={lastSaved}
          />
          {/* Real-time viewing indicator */}
          {isViewingNow && !isNewProposal && (
            <div className="absolute top-4 right-[420px]">
              <ViewingNowIndicator viewers={activeViewers} />
            </div>
          )}
        </div>


        {/* Context Cards */}
        <ProposalContextCards
          account={contextData.account}
          contact={contextData.contact}
          proposalData={{
            currency: watch('currency'),
            expires_at: watch('expires_at'),
            proposalNumber: proposalNumber || previewProposalNumber,
            ownerName: contextData.ownerName,
            ownerAvatar: contextData.ownerAvatar,
            isNew: isNewProposal,
            version: proposalVersion,
            status: status,
          }}
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
          {currentProposalId && (
            <div className="mb-4">
              <DynamicPricingMismatchAlert proposalId={currentProposalId} />
            </div>
          )}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 flex-wrap">
              <TabsTrigger value="content">Conteúdo</TabsTrigger>
              <TabsTrigger value="items">
                Itens {items.length > 0 && <Badge variant="secondary" className="ml-1">{items.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="payment-terms">Pagamento</TabsTrigger>
              <TabsTrigger value="team">Equipe</TabsTrigger>
              <TabsTrigger value="preview">Visualizar</TabsTrigger>
            </TabsList>

            <form id="proposal-form" onSubmit={handleSubmit(onSubmit)}>
              <TabsContent value="content" className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Template</Label>
                    <Select 
                      value={templates.find((t: any) => t.layout_id === watch('layout_id'))?.id || ''} 
                      onValueChange={(templateId) => {
                        const template = templates.find((t: any) => t.id === templateId);
                        if (template) {
                          // Apply all template configurations
                          if (template.layout_id) setValue('layout_id', template.layout_id);
                          if (template.currency) setValue('currency', template.currency as 'BRL' | 'USD' | 'EUR');
                          if (template.validity_days) {
                            const expiresAt = new Date();
                            expiresAt.setDate(expiresAt.getDate() + template.validity_days);
                            const year = expiresAt.getFullYear();
                            const month = String(expiresAt.getMonth() + 1).padStart(2, '0');
                            const day = String(expiresAt.getDate()).padStart(2, '0');
                            setValue('expires_at', `${year}-${month}-${day}`);
                          }
                          if (template.introduction) setValue('introduction', template.introduction);
                          if (template.terms) setValue('terms', template.terms);
                          if (template.notes || template.observations) {
                            setValue('notes', template.notes || template.observations);
                          }
                          toast.success(`📄 Template "${template.name}" aplicado!`);
                        }
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione um template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template: any) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Validade</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !watch('expires_at') && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {watch('expires_at') ? formatDateBR(watch('expires_at')) : "Selecione a data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={watch('expires_at') ? parseDateOnly(watch('expires_at')) : undefined}
                          onSelect={(date) => {
                            if (date) {
                              // Format as YYYY-MM-DD to avoid timezone issues
                              const year = date.getFullYear();
                              const month = String(date.getMonth() + 1).padStart(2, '0');
                              const day = String(date.getDate()).padStart(2, '0');
                              setValue('expires_at', `${year}-${month}-${day}`);
                            } else {
                              setValue('expires_at', '');
                            }
                          }}
                          initialFocus
                          locale={ptBR}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-2">
                    <Label>Moeda</Label>
                    <Select 
                      value={watch('currency') || 'BRL'} 
                      onValueChange={(v) => setValue('currency', v as 'BRL' | 'USD' | 'EUR')}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Moeda" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BRL">R$ BRL</SelectItem>
                        <SelectItem value="USD">$ USD</SelectItem>
                        <SelectItem value="EUR">€ EUR</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Introdução</Label>
                    <AIInlineButton
                      onClick={async () => {
                        if (!contextData.account) {
                          toast.error('Dados da conta não disponíveis. Salve a proposta primeiro.');
                          return;
                        }
                        
                        try {
                          const introduction = await generateIntroduction({
                            accountName: contextData.account.nome_fantasia || contextData.account.razao_social || '',
                            segment: contextData.account.segmento,
                            product: items[0]?.name,
                            value: itemsTotal,
                            clientName: contextData.contact?.nome,
                            city: contextData.account.cidade,
                            state: contextData.account.uf,
                            cnae: contextData.account.cnae,
                            contactRole: contextData.contact?.cargo,
                          });
                          setValue('introduction', introduction);
                          toast.success('Introdução gerada com sucesso!');
                        } catch (error) {
                          console.error('Error generating introduction:', error);
                          toast.error('Erro ao gerar introdução com IA');
                        }
                      }}
                      label="Gerar c/ IA"
                    />
                  </div>
                  <RichTextEditor
                    value={watch('introduction') || ''}
                    onChange={(value) => setValue('introduction', value)}
                    placeholder="Digite a introdução da proposta..."
                    defaultShowPreview={true}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Termos e Condições</Label>
                    <AIInlineButton
                      onClick={async () => {
                        const defaultTerms = `<h3>Termos e Condições</h3>
<ol>
  <li><strong>Validade:</strong> Esta proposta é válida por 30 dias a partir da data de emissão.</li>
  <li><strong>Pagamento:</strong> Conforme condições descritas na seção de pagamento desta proposta.</li>
  <li><strong>Prazo de Entrega:</strong> A ser definido após aprovação formal da proposta.</li>
  <li><strong>Garantia:</strong> Conforme legislação vigente e políticas da empresa.</li>
  <li><strong>Cancelamento:</strong> O cancelamento pode ser solicitado com antecedência mínima de 30 dias por escrito.</li>
  <li><strong>Confidencialidade:</strong> Esta proposta é confidencial e destina-se exclusivamente ao destinatário.</li>
</ol>`;
                        setValue('terms', defaultTerms);
                        toast.success('Termos padrão aplicados!');
                      }}
                      label="Sugerir"
                    />
                  </div>
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
                    defaultShowPreview={true}
                  />
                </div>
              </TabsContent>

              <TabsContent value="items" className="space-y-4">
                <ProposalItemsManager 
                  items={items} 
                  onChange={setItems} 
                  paymentDiscountPercent={paymentDiscountPercent}
                />
                <ProposalInventoryPanel proposalId={currentProposalId} />
              </TabsContent>

              <TabsContent value="payment-terms" className="space-y-4">
                {paymentTermsError && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>{paymentTermsError}</AlertDescription>
                  </Alert>
                )}
                {currentProposalId && (() => {
                  const p: any = proposalData ?? {};
                  // Use proposal DB fields as primary source of truth, fall back to template
                  const applicability =
                    p.dynamic_pricing_applicability ?? appliedTemplate?.dynamic_pricing_applicability ?? null;
                  const mode =
                    p.dynamic_pricing_mode ?? appliedTemplate?.dynamic_pricing_mode ?? null;
                  const revenue =
                    p.revenue_type ?? appliedTemplate?.revenue_type ?? null;
                  return (
                    <>
                      <ProposalPaymentTerms
                        proposalId={currentProposalId}
                        totalAmount={itemsTotal}
                        terms={paymentTerms}
                        onChange={(terms) => { setPaymentTerms(terms); if (terms.length > 0) setPaymentTermsError(null); }}
                        items={items}
                        currency={watch('currency')}
                      />
                      <ProposalDynamicPricingPanel
                        proposalId={currentProposalId}
                        proposalTotal={itemsTotal}
                        eventStartDate={(watch as any)('event_start_date') ?? null}
                        validUntil={watch('expires_at') ?? null}
                        dynamicPricingApplicability={applicability}
                        dynamicPricingMode={mode}
                        revenueType={revenue}
                      />
                    </>
                  );
                })()}
              </TabsContent>

              <TabsContent value="team">
                <ProposalParticipantsManager 
                  proposalId={currentProposalId || ''} 
                  disabled={isNewProposal}
                />
              </TabsContent>


              <TabsContent value="preview">
                <ProposalVisualizarTab 
                  proposalId={currentProposalId} 
                  opportunityId={opportunityId || proposalData?.opportunity_id}
                  content={{
                    introduction: watch('introduction'),
                    terms: watch('terms'),
                    notes: watch('notes'),
                  }}
                  items={items}
                  paymentTerms={paymentTerms}
                  totalValue={itemsTotal}
                  currency={watch('currency')}
                  proposalNumber={proposalNumber}
                  version={proposalVersion}
                  contextData={contextData}
                  opportunityData={opportunityData}
                  activeViewers={activeViewers}
                  paymentDiscountPercent={paymentDiscountPercent}
                />
              </TabsContent>
            </form>
          </Tabs>
        </div>
      </div>
    </Layout>
  );
}
