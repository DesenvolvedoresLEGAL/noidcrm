import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Save, FileText, Package, CreditCard, Eye, Star, Loader2, Settings2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  getTemplateById, 
  createTemplate, 
  updateTemplate,
  ProposalTemplate 
} from '@/services/crm/proposal-templates';
import { TemplateContentTab } from '@/components/templates/TemplateContentTab';
import { TemplateItemsTab } from '@/components/templates/TemplateItemsTab';
import { TemplatePaymentTab } from '@/components/templates/TemplatePaymentTab';
import { TemplateCommercialRulesTab } from '@/components/templates/TemplateCommercialRulesTab';

import { TemplatePreviewTab } from '@/components/templates/TemplatePreviewTab';
import { TemplateConfigSidebar } from '@/components/templates/TemplateConfigSidebar';
import { proposalTemplateCommercialRulesSchema } from '@/lib/proposals/proposalTemplateRules';

export default function ProposalTemplateEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditing = !!id;

  const [templateData, setTemplateData] = useState<Partial<ProposalTemplate>>({
    name: '',
    description: '',
    introduction: '',
    terms: '',
    observations: '',
    default_items: [],
    is_default: false,
    layout_id: undefined,
    currency: 'BRL',
    validity_days: 15,
    control_prefix: '',
    payment_method_default: '',
    installments_default: 1,
    entry_percent_default: 0,
    discount_percent_default: 0,
    entry_days_default: 0,
    installment_interval_days: 30,
    due_day_default: undefined,
    payment_comment: '',
    mrr_payment_method: '',
    mrr_first_payment_days: 30,
    mrr_due_day: undefined,
    mrr_comment: '',
  });

  const [isSaving, setIsSaving] = useState(false);

  // Fetch existing template if editing
  const { data: existingTemplate, isLoading } = useQuery({
    queryKey: ['proposal-template', id],
    queryFn: () => getTemplateById(id!),
    enabled: isEditing,
  });

  useEffect(() => {
    if (existingTemplate) {
      setTemplateData(existingTemplate);
    }
  }, [existingTemplate]);

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
      toast.success('Template criado com sucesso!');
      navigate(`/app/settings/proposal-templates/${data.id}/edit`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar template');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProposalTemplate> }) =>
      updateTemplate(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
      queryClient.invalidateQueries({ queryKey: ['proposal-template', id] });
      toast.success('Template salvo!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao salvar template');
    },
  });

  const handleSave = async () => {
    if (!templateData.name?.trim()) {
      toast.error('Nome do template é obrigatório');
      return;
    }

    setIsSaving(true);
    try {
      if (isEditing) {
        await updateMutation.mutateAsync({ id: id!, data: templateData });
      } else {
        await createMutation.mutateAsync(templateData as any);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const updateField = (field: keyof ProposalTemplate, value: any) => {
    setTemplateData(prev => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/app/settings/proposal-layouts')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <Input
                  value={templateData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nome do Template"
                  className="text-xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0 w-[300px]"
                />
                {templateData.is_default && (
                  <Badge variant="default" className="gap-1">
                    <Star className="h-3 w-3" />
                    Padrão
                  </Badge>
                )}
              </div>
            </div>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Salvar Template
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Main Area */}
          <div className="flex-1 overflow-y-auto p-6">
            <Tabs defaultValue="content" className="space-y-6">
              <TabsList className="grid w-full grid-cols-4 max-w-xl">
                <TabsTrigger value="content" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Conteúdo</span>
                </TabsTrigger>
                <TabsTrigger value="items" className="gap-2">
                  <Package className="h-4 w-4" />
                  <span className="hidden sm:inline">Itens</span>
                </TabsTrigger>
                <TabsTrigger value="payment" className="gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="hidden sm:inline">Pagamento</span>
                </TabsTrigger>
                <TabsTrigger value="preview" className="gap-2">
                  <Eye className="h-4 w-4" />
                  <span className="hidden sm:inline">Preview</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="content">
                <TemplateContentTab
                  introduction={templateData.introduction || ''}
                  terms={templateData.terms || ''}
                  observations={templateData.observations || ''}
                  onIntroductionChange={(value) => updateField('introduction', value)}
                  onTermsChange={(value) => updateField('terms', value)}
                  onObservationsChange={(value) => updateField('observations', value)}
                />
              </TabsContent>

              <TabsContent value="items">
                <TemplateItemsTab
                  items={templateData.default_items || []}
                  onChange={(items) => updateField('default_items', items)}
                />
              </TabsContent>

              <TabsContent value="payment">
                <TemplatePaymentTab
                  data={{
                    payment_method_default: templateData.payment_method_default,
                    installments_default: templateData.installments_default,
                    entry_percent_default: templateData.entry_percent_default,
                    discount_percent_default: templateData.discount_percent_default,
                    entry_days_default: templateData.entry_days_default,
                    installment_interval_days: templateData.installment_interval_days,
                    due_day_default: templateData.due_day_default,
                    payment_comment: templateData.payment_comment,
                    mrr_payment_method: templateData.mrr_payment_method,
                    mrr_first_payment_days: templateData.mrr_first_payment_days,
                    mrr_due_day: templateData.mrr_due_day,
                    mrr_comment: templateData.mrr_comment,
                  }}
                  onChange={(field, value) => updateField(field as keyof ProposalTemplate, value)}
                />
              </TabsContent>

              <TabsContent value="preview">
                <TemplatePreviewTab templateData={templateData} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <TemplateConfigSidebar
            layoutId={templateData.layout_id}
            currency={templateData.currency || 'BRL'}
            validityDays={templateData.validity_days || 15}
            controlPrefix={templateData.control_prefix || ''}
            isDefault={templateData.is_default || false}
            description={templateData.description || ''}
            onLayoutChange={(value) => updateField('layout_id', value)}
            onCurrencyChange={(value) => updateField('currency', value)}
            onValidityChange={(value) => updateField('validity_days', value)}
            onPrefixChange={(value) => updateField('control_prefix', value)}
            onDefaultChange={(value) => updateField('is_default', value)}
            onDescriptionChange={(value) => updateField('description', value)}
          />
        </div>
      </div>
    </Layout>
  );
}
