import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, Copy, Loader2, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { createPaymentIntent } from '@/services/proposals/proposalPaymentsService';
import { createPixChargeFromPaymentIntent } from '@/services/proposals/erpBillingBridgeService';
import { formatBRL, formatDateTime } from '@/lib/proposals/proposalPayments';
import type { DynamicPricingSnapshot } from '@/lib/proposals/dynamicPricing';

interface Props {
  proposalId: string;
  snapshot?: DynamicPricingSnapshot | null;
}

const CLAUSE =
  'O pagamento da proposta deve ser realizado exclusivamente pelo valor vigente no momento da emissão da cobrança. Pagamentos realizados manualmente com valor inferior ao vigente serão considerados parciais e poderão gerar cobrança complementar.';

export function PublicProposalPaymentBlock({ proposalId, snapshot }: Props) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [intent, setIntent] = useState<{
    id: string;
    expected_amount: number;
    pix_qr_code?: string | null;
    pix_copy_paste?: string | null;
    expires_at?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enabled = snapshot?.enabled && snapshot?.status !== 'disabled';
  const blocked =
    snapshot?.status === 'requires_requote' || snapshot?.status === 'expired';

  if (!enabled) return null;

  async function handlePay() {
    setLoading(true);
    setError(null);
    try {
      const res = await createPaymentIntent(proposalId, 'proposal_link');
      if (!res?.ok || !res.payment_intent_id) {
        setError(res?.message ?? 'Não foi possível gerar a cobrança.');
        return;
      }
      const pix = await createPixChargeFromPaymentIntent(res.payment_intent_id);
      setIntent({
        id: res.payment_intent_id,
        expected_amount: Number(res.expected_amount ?? 0),
        pix_qr_code: pix.pix_qr_code,
        pix_copy_paste: pix.pix_copy_paste,
        expires_at: snapshot?.current_ends_at ?? null,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao gerar cobrança');
    } finally {
      setLoading(false);
    }
  }

  function copyPix() {
    if (!intent?.pix_copy_paste) return;
    navigator.clipboard.writeText(intent.pix_copy_paste);
    toast({ title: 'Pix copiado' });
  }

  if (blocked) {
    return (
      <Card className="my-4 border-destructive">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <div className="font-semibold">Esta condição comercial expirou.</div>
            <div className="text-sm text-muted-foreground">
              O pagamento está bloqueado. Solicite uma nova cotação.
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="my-4">
      <CardContent className="p-5 space-y-4">
        {!intent ? (
          <>
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Valor vigente
              </div>
              <div className="text-2xl font-bold">{formatBRL(snapshot?.current_amount)}</div>
              {snapshot?.current_ends_at && (
                <div className="text-xs text-muted-foreground">
                  Válido até {formatDateTime(snapshot.current_ends_at)}
                </div>
              )}
            </div>

            <Button onClick={handlePay} disabled={loading} size="lg">
              {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Pagar valor vigente
            </Button>

            <p className="text-xs text-muted-foreground">
              O Pix será gerado com o valor vigente da condição comercial no momento da
              emissão da cobrança.
            </p>

            {error && <div className="text-sm text-destructive">{error}</div>}
          </>
        ) : (
          <>
            <div className="flex items-center gap-2 font-semibold text-primary">
              <QrCode className="h-4 w-4" /> Cobrança Pix gerada
            </div>
            <div className="text-2xl font-bold">{formatBRL(intent.expected_amount)}</div>
            {intent.expires_at && (
              <div className="text-xs text-muted-foreground">
                Validade: {formatDateTime(intent.expires_at)}
              </div>
            )}

            {intent.pix_copy_paste ? (
              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">Pix copia e cola:</div>
                <div className="rounded-md border p-2 font-mono text-xs break-all">
                  {intent.pix_copy_paste}
                </div>
                <Button variant="outline" size="sm" onClick={copyPix}>
                  <Copy className="h-3 w-3 mr-1" /> Copiar
                </Button>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                Cobrança gerada. Aguardando integração financeira.
              </div>
            )}
          </>
        )}

        <p className="text-xs text-muted-foreground border-t pt-3">{CLAUSE}</p>
      </CardContent>
    </Card>
  );
}
