import {
  formatBRL,
  formatDateTime,
  type DynamicPricingSnapshot,
} from '@/lib/proposals/dynamicPricing';
import type { DynamicPricingTier } from '@/services/proposals/proposalDynamicPricing';

interface Props {
  snapshot?: DynamicPricingSnapshot | null;
  tiers?: DynamicPricingTier[] | null;
}

const CLAUSE =
  'O pagamento da proposta deve ser realizado exclusivamente pelo valor vigente no momento da emissão da cobrança. Pagamentos realizados manualmente com valor inferior ao vigente serão considerados parciais e poderão gerar cobrança complementar.';

/**
 * Renderização HTML para inclusão no preview/PDF da proposta.
 */
export function PdfDynamicPricingSection({ snapshot, tiers }: Props) {
  if (!snapshot || snapshot.status === 'disabled') return null;
  if (!tiers || tiers.length === 0) return null;

  return (
    <section className="my-6 break-inside-avoid">
      <h3 className="text-base font-bold mb-2">Condição Comercial Dinâmica</h3>

      <table className="w-full text-sm border border-collapse">
        <thead>
          <tr className="bg-muted">
            <th className="border p-2 text-left">Período de pagamento</th>
            <th className="border p-2 text-left">Condição</th>
            <th className="border p-2 text-right">Valor válido</th>
          </tr>
        </thead>
        <tbody>
          {tiers
            .slice()
            .sort((a, b) => (a.tier_order ?? 0) - (b.tier_order ?? 0))
            .map((t) => (
              <tr key={t.id}>
                <td className="border p-2">
                  {t.starts_at ? formatDateTime(t.starts_at) : '—'}
                  {' até '}
                  {t.ends_at ? formatDateTime(t.ends_at) : '—'}
                </td>
                <td className="border p-2">{t.label}</td>
                <td className="border p-2 text-right font-medium">
                  {formatBRL(Number(t.final_amount))}
                </td>
              </tr>
            ))}
          {snapshot.status === 'requires_requote' && (
            <tr>
              <td className="border p-2 italic" colSpan={3}>
                Após {formatDateTime(snapshot.last_end)}: sujeito a nova cotação
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <p className="text-xs text-muted-foreground mt-2">{CLAUSE}</p>
    </section>
  );
}
