import { AlertTriangle, CalendarClock, CheckCircle2, Clock, Lock, TrendingUp } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  formatBRL,
  formatDateTime,
  REFERENCE_TYPE_DESCRIPTION,
  REFERENCE_TYPE_LABEL,
  type DynamicPricingSnapshot,
} from '@/lib/proposals/dynamicPricing';

interface Props {
  snapshot?: DynamicPricingSnapshot | null;
  variant?: 'public' | 'preview' | 'frozen';
  /** Snapshot congelado em `proposals.approval_snapshot` quando variant='frozen'. */
  approvalSnapshot?: any | null;
  /** Data de aceite formatada (ISO) — usada apenas em variant='frozen'. */
  acceptedAt?: string | null;
  /**
   * PRICE CORE 2.0 — % de desconto manual aplicado à proposta. Quando > 0, os
   * valores vigente / próxima virada / anterior mostrados neste banner são
   * exibidos JÁ com o desconto aplicado, para não conflitar com o valor
   * exibido no header e no "Resumo Financeiro".
   */
  manualDiscountPercent?: number;
}

const CLAUSE =
  'Pagamentos realizados após o vencimento da condição comercial serão considerados conforme o valor vigente na data efetiva do pagamento. Diferenças poderão gerar cobrança complementar.';

const FROZEN_CLAUSE =
  'Estes valores foram congelados no momento da aprovação. Qualquer ajuste depende de renegociação formal e nova aprovação.';

function FrozenView({ approvalSnapshot, acceptedAt }: { approvalSnapshot: any; acceptedAt: string | null }) {
  if (!approvalSnapshot) return null;

  const base = Number(approvalSnapshot.base_amount ?? 0);
  const finalAmount = Number(
    approvalSnapshot.approval_amount ?? approvalSnapshot.effective_amount ?? 0,
  );
  const dyn = approvalSnapshot.dynamic_adjustment ?? {};
  const adjustmentAmount = Number(dyn.amount ?? 0);
  const adjustmentPercent = Number(dyn.percent ?? 0);
  const tierLabel: string | null = dyn.tier_label ?? null;
  const referenceDate: string | null = approvalSnapshot.reference_date ?? null;
  const acceptedLabel = acceptedAt ? formatDateTime(acceptedAt) : null;

  return (
    <Card className="my-4 border-emerald-500/40 bg-emerald-50/30 dark:bg-emerald-950/10">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          <Lock className="h-4 w-4" />
          Condição comercial aprovada
          {acceptedLabel && (
            <span className="font-normal normal-case text-xs text-muted-foreground">
              em {acceptedLabel}
            </span>
          )}
        </div>

        {referenceDate && (
          <div className="rounded-md border border-emerald-500/30 bg-white/60 dark:bg-emerald-950/20 p-3 text-xs flex items-start gap-2">
            <CalendarClock className="h-4 w-4 mt-0.5 text-emerald-600 shrink-0" />
            <div>
              <div className="font-medium text-emerald-700 dark:text-emerald-400">
                Data de referência usada na aprovação
              </div>
              <div className="text-muted-foreground">
                {formatDateTime(referenceDate)}
                {tierLabel ? ` — faixa: ${tierLabel}` : ''}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">Valor base</div>
            <div className="text-lg font-semibold">{formatBRL(base)}</div>
          </div>

          {adjustmentAmount !== 0 && (
            <div>
              <div className="text-xs text-muted-foreground">
                Ajuste aplicado{adjustmentPercent ? ` (${adjustmentPercent > 0 ? '+' : ''}${adjustmentPercent}%)` : ''}
              </div>
              <div className={`text-lg font-semibold ${adjustmentAmount > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                {adjustmentAmount > 0 ? '+ ' : ''}{formatBRL(adjustmentAmount)}
              </div>
              {tierLabel && (
                <div className="text-xs text-muted-foreground">{tierLabel}</div>
              )}
            </div>
          )}

          <div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
              Valor aprovado (congelado)
            </div>
            <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400">
              {formatBRL(finalAmount)}
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">{FROZEN_CLAUSE}</p>
      </CardContent>
    </Card>
  );
}

export function PublicProposalDynamicPricingBanner({
  snapshot,
  variant = 'public',
  approvalSnapshot = null,
  acceptedAt = null,
}: Props) {
  // FREEZE-ON-APPROVAL: após o aceite, renderizamos o snapshot congelado,
  // nunca o snapshot vivo (que pode ter mudado de tier).
  if (variant === 'frozen') {
    return <FrozenView approvalSnapshot={approvalSnapshot} acceptedAt={acceptedAt} />;
  }

  if (!snapshot || snapshot.status === 'disabled') return null;

  if (snapshot.status === 'requires_requote' || snapshot.status === 'expired') {
    return (
      <Alert variant="destructive" className="my-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Condição comercial expirada</AlertTitle>
        <AlertDescription>
          Esta condição comercial expirou. Nova cotação necessária.
        </AlertDescription>
      </Alert>
    );
  }

  if (!snapshot.current_amount) return null;

  return (
    <Card className="my-4 border-primary/40">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-primary">
          <TrendingUp className="h-4 w-4" />
          Condição comercial vigente
        </div>

        {snapshot.reference_type && snapshot.reference_type !== 'current_date' && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-xs flex items-start gap-2">
            <CalendarClock className="h-4 w-4 mt-0.5 text-primary shrink-0" />
            <div>
              <div className="font-medium text-primary">
                {REFERENCE_TYPE_LABEL[snapshot.reference_type] ?? 'Data de referência personalizada'}
              </div>
              <div className="text-muted-foreground">
                {REFERENCE_TYPE_DESCRIPTION[snapshot.reference_type] ?? ''}
                {snapshot.reference_date ? ` — referência: ${formatDateTime(snapshot.reference_date)}` : ''}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-xs text-muted-foreground">
              {(() => {
                const isAuto = (snapshot as any).pricing_mode === 'event_antecedence';
                const base = (snapshot as any).base_amount;
                const adjusted =
                  isAuto && base != null && Number(snapshot.current_amount) !== Number(base);
                return adjusted
                  ? 'Valor vigente hoje, já com ajuste por antecedência'
                  : 'Valor vigente hoje';
              })()}
            </div>
            <div className="text-2xl font-bold">{formatBRL(snapshot.current_amount)}</div>
            {snapshot.current_ends_at && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                <Clock className="h-3 w-3" />
                Válido até {formatDateTime(snapshot.current_ends_at)}
              </div>
            )}
          </div>

          {snapshot.next_amount != null && snapshot.next_starts_at && (
            <div>
              <div className="text-xs text-muted-foreground">Próxima atualização</div>
              <div className="text-lg font-semibold">{formatBRL(snapshot.next_amount)}</div>
              <div className="text-xs text-muted-foreground">
                em {formatDateTime(snapshot.next_starts_at)}
              </div>
            </div>
          )}

          {snapshot.previous_amount != null && (
            <div className="opacity-70">
              <div className="text-xs text-muted-foreground">Valor anterior expirado</div>
              <div className="text-sm font-medium line-through">
                {formatBRL(snapshot.previous_amount)}
              </div>
              <div className="text-xs text-muted-foreground">
                {snapshot.previous_label} —{' '}
                {snapshot.current_starts_at
                  ? `até ${formatDateTime(snapshot.current_starts_at)}`
                  : ''}
              </div>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">{CLAUSE}</p>
      </CardContent>
    </Card>
  );
}
