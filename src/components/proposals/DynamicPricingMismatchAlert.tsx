import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  useApplyProposalDynamicPrice,
  useProposalDynamicPricingSnapshot,
} from '@/hooks/proposals/useProposalDynamicPricing';
import { ensureProposalDynamicPricingCurrent } from '@/services/proposals/ensureProposalDynamicPricingCurrent';
import { invalidateProposalCaches } from '@/hooks/proposals/useProposalOrchestrator';

interface Props {
  proposalId: string;
  /**
   * Optional explicit displayed value to compare against the dynamic vigent value.
   * If omitted, falls back to proposal.payment_expected_amount / total_amount.
   */
  displayedAmount?: number | null;
  className?: string;
}

const formatBRL = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  });

export function DynamicPricingMismatchAlert({
  proposalId,
  displayedAmount,
  className,
}: Props) {
  const { data: snapshot } = useProposalDynamicPricingSnapshot(proposalId);
  const queryClient = useQueryClient();

  const { data: proposalRow } = useQuery({
    queryKey: ['proposal-mismatch-row', proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('proposals')
        .select('total_amount, payment_expected_amount, dynamic_pricing_current_amount')
        .eq('id', proposalId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!proposalId,
    staleTime: 15_000,
  });

  const apply = useApplyProposalDynamicPrice(proposalId);

  const { mismatch, displayed, vigent } = useMemo(() => {
    const enabled = (snapshot as any)?.enabled;
    const status = (snapshot as any)?.status;
    const vigent =
      enabled && status !== 'disabled' && (snapshot as any)?.current_amount != null
        ? Number((snapshot as any).current_amount)
        : null;

    if (vigent == null || !proposalRow) {
      return { mismatch: false, displayed: null as number | null, vigent };
    }

    const candidate =
      typeof displayedAmount === 'number'
        ? displayedAmount
        : Number(
            (proposalRow as any).payment_expected_amount ??
              (proposalRow as any).total_amount ??
              0,
          );

    const diff = Math.abs(candidate - vigent);
    return { mismatch: diff > 0.01, displayed: candidate, vigent };
  }, [snapshot, proposalRow, displayedAmount]);

  // AUTO-REFRESH: ao detectar divergência, dispara a RPC idempotente uma
  // única vez. O botão manual continua existindo como fallback caso falhe.
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [autoFailed, setAutoFailed] = useState(false);
  const triedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!mismatch || vigent == null || displayed == null) return;
    const key = `${proposalId}:${vigent}:${displayed}`;
    if (triedRef.current === key) return;
    triedRef.current = key;
    setAutoSyncing(true);
    setAutoFailed(false);
    ensureProposalDynamicPricingCurrent(proposalId)
      .then((res) => {
        if (res?.refreshed) {
          invalidateProposalCaches(queryClient, proposalId);
          queryClient.invalidateQueries({ queryKey: ['proposal-mismatch-row', proposalId] });
          queryClient.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-snapshot', proposalId] });
          queryClient.invalidateQueries({ queryKey: ['proposal', proposalId] });
        } else {
          // Sem refresh: provavelmente o snapshot já está correto e a divergência
          // está num cache; forçamos uma reavaliação invalidando as queries.
          queryClient.invalidateQueries({ queryKey: ['proposal-mismatch-row', proposalId] });
          queryClient.invalidateQueries({ queryKey: ['proposal-dynamic-pricing-snapshot', proposalId] });
        }
      })
      .catch(() => setAutoFailed(true))
      .finally(() => setAutoSyncing(false));
  }, [mismatch, vigent, displayed, proposalId, queryClient]);

  if (!mismatch || vigent == null || displayed == null) return null;

  // Enquanto o auto-sync está rodando ou ainda não falhou, mostramos só o loading
  // discreto — sem o botão manual.
  if (autoSyncing) {
    return (
      <Alert
        className={
          'border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700 ' +
          (className ?? '')
        }
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        <AlertTitle className="text-sm font-semibold">
          Atualizando condição comercial vigente…
        </AlertTitle>
        <AlertDescription className="text-sm">
          Sincronizando o valor da proposta com a tabela dinâmica atual.
        </AlertDescription>
      </Alert>
    );
  }

  // Auto-sync rodou e não resolveu (ou falhou): mantém alerta + botão manual.
  return (
    <Alert
      variant="destructive"
      className={
        'border-amber-400/60 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-700 ' +
        (className ?? '')
      }
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="text-sm font-semibold">
        Valor exibido divergente da tabela dinâmica
      </AlertTitle>
      <AlertDescription className="space-y-2 text-sm">
        <div>
          O valor atual da proposta ({formatBRL(displayed)}) está diferente do
          valor vigente da tabela dinâmica ({formatBRL(vigent)}).
          {autoFailed && (
            <span className="block text-xs mt-1 opacity-80">
              A sincronização automática falhou. Use o botão abaixo para tentar novamente.
            </span>
          )}
        </div>
        <div className="pt-1">
          <Button
            size="sm"
            variant="outline"
            disabled={apply.isPending}
            onClick={() => apply.mutate()}
            className="gap-2"
          >
            {apply.isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Recalcular e sincronizar agora
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
