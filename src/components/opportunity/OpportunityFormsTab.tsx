import { useCustomFormsByPipeline } from '@/hooks/useCustomForms';
import { CustomFormRenderer } from '@/components/custom-forms/CustomFormRenderer';
import { Loader2, FileCheck } from 'lucide-react';

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
  const { data: forms = [], isLoading } = useCustomFormsByPipeline(pipelineId);

  if (isLoading) {
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
    <div className="space-y-4">
      {forms.map((form) => (
        <CustomFormRenderer
          key={form.id}
          form={form}
          entityId={opportunityId}
          entityType="opportunity"
          entityData={{
            opportunity,
            account,
            contact,
          }}
        />
      ))}
    </div>
  );
}
