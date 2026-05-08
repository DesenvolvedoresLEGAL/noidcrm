import {
  formatBRL,
  formatDateTime,
  tierStatusFromDates,
  TIER_STATUS_LABEL,
  type DynamicPricingSnapshot,
  type TierStatus,
} from '@/lib/proposals/dynamicPricing';
import type { DynamicPricingTier } from '@/services/proposals/proposalDynamicPricing';

interface Props {
  snapshot?: DynamicPricingSnapshot | null;
  tiers?: DynamicPricingTier[] | null;
}

const CLAUSE =
  'O pagamento da proposta deve ser realizado exclusivamente pelo valor vigente no momento da emissão da cobrança. Pagamentos realizados manualmente com valor inferior ao vigente serão considerados parciais e poderão gerar cobrança complementar.';

const ANTECEDENCE_CLAUSE =
  'A condição comercial é calculada automaticamente pela antecedência entre a data de pagamento e o primeiro dia do evento. O valor vigente no momento da emissão da cobrança prevalece sobre valores anteriores já expirados.';

/**
 * Renderização HTML para inclusão no preview/PDF da proposta.
 */
export function PdfDynamicPricingSection({ snapshot, tiers }: Props) {
  if (!snapshot || snapshot.status === 'disabled') return null;
  if (!tiers || tiers.length === 0) return null;

  const isAuto = (snapshot as any).pricing_mode === 'event_antecedence';
  const eventDate = (snapshot as any).event_start_date as string | null;

  return (
    <section className="my-6 break-inside-avoid">
      <h3 className="text-base font-bold mb-2">
        {isAuto ? 'Condição Comercial por Antecedência' : 'Condição Comercial Dinâmica'}
      </h3>

      <table className="w-full text-sm border border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="border p-2 text-left">
              {isAuto ? 'Antecedência do pagamento' : 'Período de pagamento'}
            </th>
            <th className="border p-2 text-left">{isAuto ? 'Ajuste' : 'Condição'}</th>
            <th className="border p-2 text-right">Valor</th>
            {isAuto && <th className="border p-2 text-left">Status</th>}
          </tr>
        </thead>
        <tbody>
          {tiers
            .slice()
            .sort((a, b) => (a.tier_order ?? 0) - (b.tier_order ?? 0))
            .map((t) => {
              const status: TierStatus = tierStatusFromDates(
                t.starts_at,
                t.ends_at,
                eventDate,
              );
              const adj =
                t.adjustment_type === 'percent_adjustment'
                  ? `${Number(t.adjustment_value) >= 0 ? '+' : ''}${t.adjustment_value}%`
                  : t.adjustment_type === 'fixed_adjustment'
                  ? `${Number(t.adjustment_value) >= 0 ? '+' : ''}${formatBRL(t.adjustment_value)}`
                  : '—';
              return (
                <tr key={t.id}>
                  <td className="border p-2">
                    {isAuto
                      ? t.label
                      : `${t.starts_at ? formatDateTime(t.starts_at) : '—'} até ${
                          t.ends_at ? formatDateTime(t.ends_at) : '—'
                        }`}
                  </td>
                  <td className="border p-2">{isAuto ? adj : t.label}</td>
                  <td className="border p-2 text-right font-medium">
                    {formatBRL(Number(t.final_amount))}
                  </td>
                  {isAuto && (
                    <td className="border p-2">{TIER_STATUS_LABEL[status]}</td>
                  )}
                </tr>
              );
            })}
          {snapshot.status === 'requires_requote' && (
            <tr>
              <td
                className="border p-2 italic"
                colSpan={isAuto ? 4 : 3}
              >
                {isAuto
                  ? 'Após o início do evento: sujeito a nova cotação ou bloqueio de pagamento'
                  : `Após ${formatDateTime(snapshot.last_end)}: sujeito a nova cotação`}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-muted-foreground mt-2">
        {isAuto ? ANTECEDENCE_CLAUSE : CLAUSE}
      </p>
    </section>
  );
}
