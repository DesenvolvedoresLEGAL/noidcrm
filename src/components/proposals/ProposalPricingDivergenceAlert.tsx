// PRICE CORE 2.0 — Phase 2.0C
// Visual alert + manual recalculation action. Does NOT block actions itself —
// blocking happens server-side via `ensure_proposal_pricing_ready`.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { getProposalPricingSummary } from '@/lib/proposals/pricingLedger';
import { recalculateProposalLedger } from '@/services/proposals/proposalPricingGuard';
import { proposalKeys } from '@/lib/query-keys';

interface Props {
  proposal: any;
  className?: string;
}

export function ProposalPricingDivergenceAlert({ proposal, className }: Props) {
  const summary = getProposalPricingSummary(proposal);
  const queryClient = useQueryClient();
  const [recalcing, setRecalcing] = useState(false);

  if (!summary) return null;
  const hasWarnings = summary.warnings && summary.warnings.length > 0;
  if (!summary.hasDivergence && !hasWarnings) return null;

  const handleRecalc = async () => {
    if (!proposal?.id) return;
    setRecalcing(true);
    try {
      const res = await recalculateProposalLedger(proposal.id);
      await queryClient.invalidateQueries({ queryKey: proposalKeys.detail(proposal.id) });
      await queryClient.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-preview', proposal.id] });
      if (res.ok) toast.success('Valores recalculados.');
      else toast.error(res.message || 'Ainda existem divergências. Revise itens e condições.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao recalcular valores.');
    } finally {
      setRecalcing(false);
    }
  };

  return (
    <Alert variant="destructive" className={className}>
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Atenção: valores divergentes nesta proposta</AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <p>
          Recalcule antes de enviar ao cliente, aprovar ou faturar. Ações
          críticas (aprovação, cobrança, ERP) ficam bloqueadas no servidor até
          os valores convergirem.
        </p>
        {hasWarnings && (
          <ul className="list-disc pl-5 text-xs opacity-90">
            {summary.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        )}
        <div>
          <Button size="sm" variant="outline" disabled={recalcing} onClick={handleRecalc}>
            {recalcing
              ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Recalcular valores
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
