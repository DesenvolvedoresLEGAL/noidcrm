/**
 * P0 Revenue SSoT — period resolver.
 * Único ponto de resolução de período para superfícies de receita realizada.
 * Sem rolling 30d; "Este mês" = dia 1 → hoje em America/Sao_Paulo.
 * O campo de data autoritativo é `won_at` (commercial_won_revenue_view).
 */
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';

export type RevenuePeriodPreset = 'thisMonth' | 'lastMonth' | 'thisYear' | 'custom';

export interface RevenuePeriod {
  start: string; // ISO date-time, UTC
  end: string;   // ISO date-time, UTC
  preset: RevenuePeriodPreset;
  label: string; // human label in pt-BR
}

const SP_TZ_OFFSET_MIN = -180; // America/Sao_Paulo (sem DST hoje)

function spNow(): Date {
  // Aproxima "agora em SP" sem dependência runtime de Intl/TZ.
  const now = new Date();
  return new Date(now.getTime() + (now.getTimezoneOffset() - SP_TZ_OFFSET_MIN) * 60_000);
}

export function resolveRevenuePeriod(
  preset: RevenuePeriodPreset,
  custom?: { start: Date | string; end: Date | string },
): RevenuePeriod {
  const now = spNow();
  if (preset === 'custom' && custom) {
    const s = typeof custom.start === 'string' ? new Date(custom.start) : custom.start;
    const e = typeof custom.end === 'string' ? new Date(custom.end) : custom.end;
    return {
      start: s.toISOString(),
      end: e.toISOString(),
      preset: 'custom',
      label: `${format(s, 'dd/MM/yyyy')} – ${format(e, 'dd/MM/yyyy')}`,
    };
  }
  if (preset === 'lastMonth') {
    const ref = subMonths(now, 1);
    return {
      start: startOfMonth(ref).toISOString(),
      end: endOfMonth(ref).toISOString(),
      preset,
      label: format(ref, "MMMM 'de' yyyy"),
    };
  }
  if (preset === 'thisYear') {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString(), preset, label: `${now.getFullYear()}` };
  }
  // thisMonth — 1 → hoje
  return {
    start: startOfMonth(now).toISOString(),
    end: now.toISOString(),
    preset: 'thisMonth',
    label: format(now, "MMMM 'de' yyyy"),
  };
}
