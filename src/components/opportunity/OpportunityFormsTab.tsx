import { useCustomFormsByPipeline } from '@/hooks/useCustomForms';
import { CustomFormRenderer } from '@/components/custom-forms/CustomFormRenderer';
import { useOpportunityPublicForms, useOpportunityPublicFormMutations } from '@/hooks/useOpportunityPublicForms';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Loader2, FileCheck, Link2, Copy, ExternalLink, Globe, Building2, Lock, GitBranch } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useOpportunityQualificationScore } from '@/hooks/useOpportunityQualificationScore';
import { QualificationScoreCard } from '@/components/opportunity/qualification/QualificationScoreCard';
import { QualificationSummaryCard } from '@/components/opportunity/qualification/QualificationSummaryCard';
import { useHandoffFormValues } from '@/hooks/useHandoffFormValues';
import { HandoffIncompleteAlert } from '@/components/opportunity/HandoffIncompleteAlert';

interface OpportunityFormsTabProps {
  opportunityId: string;
  pipelineId: string | undefined;
  opportunity?: any;
  account?: any;
  contact?: any;
}

export function OpportunityFormsTab({
  opportunityId,
  pipelineId,
  opportunity,
  account,
  contact,
}: OpportunityFormsTabProps) {
  const { organization } = useCurrentUser();
  const { data: forms = [], isLoading } = useCustomFormsByPipeline(pipelineId);
  const { data: publicForms = [], isLoading: loadingPublicForms } = useOpportunityPublicForms(opportunityId);
  const { togglePublicForm, isToggling } = useOpportunityPublicFormMutations();
  const { data: handoffBundles = [], isLoading: loadingHandoff } = useHandoffFormValues(
    opportunityId,
    opportunity?.source_opportunity_id ?? null,
  );

  const pipelineType = opportunity?.pipeline?.pipeline_type;
  const isQualificationPipeline = pipelineType === 'qualification';
  const isSalesPipeline = pipelineType === 'sales';

  const qualScore = useOpportunityQualificationScore({
    opportunityId,
    pipelineId,
    account,
    contact,
  });

  const handoffStatus: string | null = opportunity?.handoff_status ?? null;
  const sourceOpportunityId: string | null = opportunity?.source_opportunity_id ?? null;

  const isHandoffOpp =
    !!sourceOpportunityId ||
    handoffStatus === 'approved' ||
    handoffStatus === 'qualification_missing' ||
    handoffBundles.length > 0;

  const showSummary = isSalesPipeline && isHandoffOpp;
  const showMissingAlert = isSalesPipeline && handoffStatus === 'qualification_missing';

  const getPublicFormData = (formId: string) => publicForms.find(pf => pf.form_id === formId);

  const handleTogglePublic = async (formId: string, currentEnabled: boolean) => {
    await togglePublicForm.mutateAsync({
      opportunityId,
      formId,
      isEnabled: !currentEnabled,
    });
  };

  const getPublicUrl = (token: string) => `${window.location.origin}/f/${token}`;
  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(getPublicUrl(token));
    toast.success('Link copiado!');
  };
  const handleOpenLink = (token: string) => window.open(getPublicUrl(token), '_blank');

  if (isLoading || loadingPublicForms || loadingHandoff) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const ownFormsEmpty = forms.length === 0;
  const hasNothing = ownFormsEmpty && handoffBundles.length === 0 && !showSummary && !showMissingAlert;

  if (hasNothing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h3 className="font-medium text-lg">Nenhum formulário disponível</h3>
        <p className="text-muted-foreground max-w-md">
          Não há formulários personalizados configurados para este funil.
          Administradores podem criar formulários em Configurações → Formulários Personalizados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showMissingAlert && (
        <HandoffIncompleteAlert sourceOpportunityId={sourceOpportunityId} />
      )}

      {showSummary && (
        <QualificationSummaryCard
          opportunity={opportunity}
          handoffBundles={handoffBundles}
          qualScore={qualScore}
        />
      )}

      {isQualificationPipeline && qualScore.hasForm && (
        <QualificationScoreCard score={qualScore} />
      )}

      {/* P0.4: Read-only checklist cloned from PRÉ VENDAS.
          Hidden when QualificationSummaryCard is shown — the summary already
          consolidates every relevant field, so the raw form would be redundant. */}
      {!showSummary && handoffBundles.map((bundle) => (
        <Card key={bundle.valuesRow.id} className="border-primary/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-primary" />
                Checklist de Qualificação recebido do Pré-vendas
              </CardTitle>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="secondary">Recebido do Pré-vendas</Badge>
                <Badge variant="outline" className="gap-1">
                  <Lock className="h-3 w-3" />
                  Somente leitura
                </Badge>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Para complementar informações em Vendas, utilize outro formulário abaixo. As respostas originais do SDR não podem ser editadas.
            </p>
          </CardHeader>
          <CardContent>
            <CustomFormRenderer
              form={bundle.form}
              entityId={opportunityId}
              entityType="opportunity"
              entityData={{ opportunity, account, contact }}
              readOnly
            />
          </CardContent>
        </Card>
      ))}

      {forms.map((form) => {
        const isAccountForm = form.entity_type === 'account';
        const entityId = isAccountForm ? account?.id : opportunityId;
        const entityType = isAccountForm ? 'account' : 'opportunity';

        if (isAccountForm && !account?.id) return null;

        // Hide the VENDAS-pipeline form if it is the same form already shown as a read-only handoff clone.
        const alreadyShownAsHandoff = handoffBundles.some(
          (b) => b.form.id === form.id,
        );
        if (alreadyShownAsHandoff) return null;

        const publicFormData = getPublicFormData(form.id);
        const isPublicEnabled = publicFormData?.is_enabled || false;
        const publicToken = publicFormData?.public_token;

        return (
          <Card key={form.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base font-medium">{form.name}</CardTitle>
                  {isAccountForm && (
                    <Badge variant="outline" className="text-xs">
                      <Building2 className="h-3 w-3 mr-1" />
                      Empresa
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Link Público</span>
                    <Switch
                      checked={isPublicEnabled}
                      onCheckedChange={() => handleTogglePublic(form.id, isPublicEnabled)}
                      disabled={isToggling}
                    />
                  </div>
                </div>
              </div>

              {isPublicEnabled && publicToken && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-md">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {getPublicUrl(publicToken)}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => handleCopyLink(publicToken)} className="shrink-0">
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleOpenLink(publicToken)} className="shrink-0">
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardHeader>

            <CardContent>
              <CustomFormRenderer
                form={form}
                entityId={entityId}
                entityType={entityType}
                entityData={{ opportunity, account, contact }}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
