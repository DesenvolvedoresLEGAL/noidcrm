// PRICE CORE 2.0 — Phase 2.0B
// Visual-only alert. Does NOT block any action in this phase.
// Blocking happens in Phase 2.0C.

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import { getProposalPricingSummary } from '@/lib/proposals/pricingLedger';

interface Props {
  proposal: any;
  className?: string;
}

export function ProposalPricingDivergenceAlert({ proposal, className }: Props) {
  const summary = getProposalPricingSummary(proposal);
  if (!summary) return null;

  const hasWarnings = summary.warnings && summary.warnings.length > 0;
  if (!summary.hasDivergence && !hasWarnings) return null;

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Atenção: valores divergentes nesta proposta</AlertTitle>
      <AlertDescription className="space-y-1 text-sm">
        <p>
          Recalcule antes de enviar ao cliente, aprovar ou faturar para evitar
          divergência entre header, link público, PDF, cronograma, ERP e
          aprovação.
        </p>
        {hasWarnings && (
          <ul className="list-disc pl-5 text-xs opacity-90">
            {summary.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
}
