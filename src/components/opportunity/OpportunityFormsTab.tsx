import { useCustomFormsByPipeline } from '@/hooks/useCustomForms';
import { CustomFormRenderer } from '@/components/custom-forms/CustomFormRenderer';
import { useOpportunityPublicForms, useOpportunityPublicFormMutations } from '@/hooks/useOpportunityPublicForms';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Loader2, FileCheck, Link2, Copy, ExternalLink, Globe, Building2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useOpportunityQualificationScore } from '@/hooks/useOpportunityQualificationScore';
import { QualificationScoreCard } from '@/components/opportunity/qualification/QualificationScoreCard';

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

  const isQualificationPipeline =
    opportunity?.pipeline?.pipeline_type === 'qualification';
  const qualScore = useOpportunityQualificationScore({
    opportunityId,
    pipelineId,
    account,
    contact,
  });

  const getPublicFormData = (formId: string) => {
    return publicForms.find(pf => pf.form_id === formId);
  };

  const handleTogglePublic = async (formId: string, currentEnabled: boolean) => {
    await togglePublicForm.mutateAsync({
      opportunityId,
      formId,
      isEnabled: !currentEnabled,
    });
  };

  const getPublicUrl = (token: string) => {
    return `${window.location.origin}/f/${token}`;
  };

  const handleCopyLink = (token: string) => {
    navigator.clipboard.writeText(getPublicUrl(token));
    toast.success('Link copiado!');
  };

  const handleOpenLink = (token: string) => {
    window.open(getPublicUrl(token), '_blank');
  };

  if (isLoading || loadingPublicForms) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (forms.length === 0) {
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
      {isQualificationPipeline && qualScore.hasForm && (
        <QualificationScoreCard score={qualScore} />
      )}
      {forms.map((form) => {
        const isAccountForm = form.entity_type === 'account';
        const entityId = isAccountForm ? account?.id : opportunityId;
        const entityType = isAccountForm ? 'account' : 'opportunity';
        
        // Não renderizar formulário de empresa se não houver conta vinculada
        if (isAccountForm && !account?.id) return null;
        
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
                
                {/* Public Form Toggle */}
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

              {/* Public Link Actions */}
              {isPublicEnabled && publicToken && (
                <div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-md">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-sm text-muted-foreground truncate flex-1">
                    {getPublicUrl(publicToken)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopyLink(publicToken)}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleOpenLink(publicToken)}
                    className="shrink-0"
                  >
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
                entityData={{
                  opportunity,
                  account,
                  contact,
                }}
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}