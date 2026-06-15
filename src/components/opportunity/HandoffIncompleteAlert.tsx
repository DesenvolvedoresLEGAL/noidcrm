import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ExternalLink, RotateCcw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useUserRole } from '@/hooks/useUserRole';

interface HandoffIncompleteAlertProps {
  sourceOpportunityId?: string | null;
  onRevertToPreSales?: () => void;
}

/**
 * P0.6: Visible alert when a VENDAS opportunity arrived without the mandatory
 * qualification checklist (handoff_status = 'qualification_missing').
 */
export function HandoffIncompleteAlert({
  sourceOpportunityId,
  onRevertToPreSales,
}: HandoffIncompleteAlertProps) {
  const { isAdmin } = useUserRole();
  const canRevert = isAdmin;

  return (
    <Alert variant="destructive" className="border-destructive/60">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Oportunidade recebida de Pré-vendas sem checklist obrigatório.</AlertTitle>
      <AlertDescription className="space-y-3">
        <p className="text-sm">
          Esta oportunidade foi criada antes do bloqueio de qualificação ou chegou sem escopo completo.
          Revise antes de avançar com proposta.
        </p>
        <div className="flex flex-wrap gap-2">
          {sourceOpportunityId && (
            <Button asChild variant="outline" size="sm">
              <Link to={`/app/opportunities/${sourceOpportunityId}`}>
                <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                Ver oportunidade original
              </Link>
            </Button>
          )}
          {canRevert && onRevertToPreSales && (
            <Button variant="outline" size="sm" onClick={onRevertToPreSales}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
              Retornar para Pré-vendas
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}
