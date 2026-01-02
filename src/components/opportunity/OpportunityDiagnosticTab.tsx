import { useOpportunityDiagnostic } from "@/hooks/useOpportunityDiagnostic";
import { OpportunityDiagnosticCard } from "./OpportunityDiagnosticCard";
import { ClipboardCheck } from "lucide-react";

interface OpportunityDiagnosticTabProps {
  opportunityId: string;
}

export function OpportunityDiagnosticTab({ opportunityId }: OpportunityDiagnosticTabProps) {
  const { data: diagnostic, isLoading, error } = useOpportunityDiagnostic(opportunityId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Erro ao carregar diagnóstico
      </div>
    );
  }

  if (!diagnostic) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <ClipboardCheck className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-muted-foreground">
          Nenhum diagnóstico realizado para esta oportunidade.
        </p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          O diagnóstico é preenchido pelo lead no momento da captura.
        </p>
      </div>
    );
  }

  return <OpportunityDiagnosticCard diagnostic={diagnostic} />;
}
