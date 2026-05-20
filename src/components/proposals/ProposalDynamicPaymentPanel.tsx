import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  AlertCircle,
  CheckCircle2,
  CreditCard,
  History,
  Loader2,
  RefreshCw,
  Wallet,
} from 'lucide-react';
import {
  EVENT_LABEL,
  STATUS_LABEL,
  formatBRL,
  formatDateTime,
  statusVariant,
} from '@/lib/proposals/proposalPayments';
import {
  useCreateComplementaryIntent,
  useCreatePaymentIntent,
  useGeneratePixCharge,
  useLatestPaymentIntent,
  useProposalPaymentEvents,
  useSyncErpStatus,
} from '@/hooks/proposals/useProposalPayments';
import { useProposalDynamicPricingSnapshot } from '@/hooks/proposals/useProposalDynamicPricing';
import { ManualPaymentValidationDialog } from './ManualPaymentValidationDialog';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  proposalId: string;
}

const DIVERGENCE_TOOLTIP =
  'Existem valores divergentes nesta proposta. Recalcule antes de continuar.';

export function ProposalDynamicPaymentPanel({ proposalId }: Props) {
  const { data: snapshot } = useProposalDynamicPricingSnapshot(proposalId);
  const { data: latest, isLoading } = useLatestPaymentIntent(proposalId);
  const { data: events = [] } = useProposalPaymentEvents(proposalId);

  // PRICE CORE 2.0C — observe divergence so all critical buttons can lock.
  const { data: divergenceFlag } = useQuery({
    queryKey: ['proposal-pricing-divergence', proposalId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('proposals')
        .select('pricing_has_divergence')
        .eq('id', proposalId)
        .maybeSingle();
      return !!data?.pricing_has_divergence;
    },
    enabled: !!proposalId,
    staleTime: 10_000,
  });
  const hasDivergence = !!divergenceFlag;

  const createIntent = useCreatePaymentIntent(proposalId);
  const genPix = useGeneratePixCharge(proposalId);
  const complementary = useCreateComplementaryIntent(proposalId);
  const sync = useSyncErpStatus(proposalId);

  const [showValidate, setShowValidate] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const dynamicEnabled = snapshot?.enabled && snapshot?.status !== 'disabled';
  const blocked =
    snapshot?.status === 'requires_requote' || snapshot?.status === 'expired';
  const currentAmount = snapshot?.current_amount ?? null;

  if (!dynamicEnabled) return null;


  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wallet className="h-4 w-4" /> Cobrança dinâmica
          </CardTitle>
          {latest && (
            <Badge variant={statusVariant(latest.status)}>
              {STATUS_LABEL[latest.status] ?? latest.status}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {blocked && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              Esta condição comercial expirou. Pagamento bloqueado — solicite nova cotação.
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <Metric label="Valor vigente" value={formatBRL(currentAmount)} highlight />
            <Metric label="Valor esperado" value={formatBRL(latest?.expected_amount)} />
            <Metric label="Valor pago" value={formatBRL(latest?.paid_amount)} />
            <Metric
              label="Diferença"
              value={formatBRL(latest?.difference_amount)}
              danger={(latest?.difference_amount ?? 0) > 0}
            />
          </div>

          {latest && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <div>Última cobrança: {formatDateTime(latest.created_at)}</div>
              {latest.expires_at && <div>Validade: {formatDateTime(latest.expires_at)}</div>}
              {latest.paid_at && <div>Pago em: {formatDateTime(latest.paid_at)}</div>}
              {latest.pix_copy_paste && (
                <div className="font-mono break-all">Pix: {latest.pix_copy_paste}</div>
              )}
            </div>
          )}

          <Separator />

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={blocked || createIntent.isPending || hasDivergence}
              title={hasDivergence ? DIVERGENCE_TOOLTIP : undefined}
              onClick={() => createIntent.mutate('crm_manual')}
            >
              {createIntent.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <CreditCard className="h-4 w-4 mr-1" />
              )}
              Gerar Pix vigente
            </Button>

            {latest && latest.status === 'pending' && (
              <Button
                size="sm"
                variant="outline"
                disabled={genPix.isPending || hasDivergence}
                title={hasDivergence ? DIVERGENCE_TOOLTIP : undefined}
                onClick={() => genPix.mutate(latest.id)}
              >
                Gerar Pix QR
              </Button>
            )}

            {latest && (
              <Button size="sm" variant="outline" onClick={() => setShowValidate(true)}>
                Validar pagamento manual
              </Button>
            )}

            {latest && (latest.difference_amount ?? 0) > 0 && (
              <Button
                size="sm"
                variant="destructive"
                disabled={complementary.isPending || hasDivergence}
                title={hasDivergence ? DIVERGENCE_TOOLTIP : undefined}
                onClick={() => complementary.mutate(latest.id)}
              >
                Gerar cobrança complementar
              </Button>
            )}

            {latest && (
              <Button
                size="sm"
                variant="ghost"
                disabled={sync.isPending || hasDivergence}
                title={hasDivergence ? DIVERGENCE_TOOLTIP : undefined}
                onClick={() => sync.mutate(latest.id)}
              >
                <RefreshCw className="h-4 w-4 mr-1" /> Sincronizar ERP
              </Button>
            )}

            <Button size="sm" variant="ghost" onClick={() => setShowHistory((v) => !v)}>
              <History className="h-4 w-4 mr-1" /> Histórico
            </Button>
          </div>


          {showHistory && (
            <div className="rounded-md border divide-y text-xs max-h-64 overflow-auto">
              {events.length === 0 ? (
                <div className="p-3 text-muted-foreground">Sem eventos.</div>
              ) : (
                events.map((e) => (
                  <div key={e.id} className="p-2 flex items-start gap-2">
                    <CheckCircle2 className="h-3 w-3 mt-0.5 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">
                        {EVENT_LABEL[e.event_type] ?? e.event_type}
                      </div>
                      <div className="text-muted-foreground">{e.message}</div>
                      <div className="text-muted-foreground">
                        {formatDateTime(e.created_at)}
                        {e.paid_amount != null && ` · pago ${formatBRL(e.paid_amount)}`}
                        {e.difference_amount != null && (e.difference_amount ?? 0) > 0 &&
                          ` · diferença ${formatBRL(e.difference_amount)}`}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {isLoading && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando…
            </div>
          )}
        </CardContent>
      </Card>

      {latest && (
        <ManualPaymentValidationDialog
          open={showValidate}
          onOpenChange={setShowValidate}
          proposalId={proposalId}
          paymentIntentId={latest.id}
          expectedAmount={latest.expected_amount ?? currentAmount ?? 0}
        />
      )}
    </>
  );
}

function Metric({
  label,
  value,
  highlight,
  danger,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          'font-semibold ' +
          (danger ? 'text-destructive' : highlight ? 'text-primary' : '')
        }
      >
        {value}
      </div>
    </div>
  );
}
