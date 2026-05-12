import { AlertTriangle, CalendarClock, Clock, TrendingUp } from 'lucide-react';
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
  variant?: 'public' | 'preview';
}

const CLAUSE =
  'Pagamentos realizados após o vencimento da condição comercial serão considerados conforme o valor vigente na data efetiva do pagamento. Diferenças poderão gerar cobrança complementar.';

export function PublicProposalDynamicPricingBanner({ snapshot, variant = 'public' }: Props) {
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
