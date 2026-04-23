// Deterministic CNAE → Segmento mapping.
// Output values match canonical segments from `segment-normalizer.ts`,
// so the inferred value is already in the same form the rest of the app uses.
//
// Strategy: extract the 2-digit CNAE division (first two digits of the
// numeric part) and apply special-case sub-rules for groups (3 digits)
// or classes (4 digits) where the division alone is too coarse.

function extractDigits(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\D/g, '');
}

export function cnaeToSegmento(codigo: string | null | undefined): string | null {
  const digits = extractDigits(codigo);
  if (digits.length < 2) return null;

  const division = parseInt(digits.slice(0, 2), 10);
  const group = digits.length >= 3 ? parseInt(digits.slice(0, 3), 10) : null;
  const klass = digits.length >= 4 ? parseInt(digits.slice(0, 4), 10) : null;

  if (Number.isNaN(division)) return null;

  // ── Special cases (more specific than division) ──────────────
  // 73.1x = Publicidade → Marketing
  // 73.2x = Pesquisa de mercado → Marketing
  if (group === 731 || group === 732) return 'Marketing';
  // 82.30 = Serviços de organização de feiras / eventos
  if (klass === 8230) return 'Eventos';
  // 56.20 = Catering / buffet (eventos), demais 56 = Alimentação → Serviços
  if (klass === 5620) return 'Eventos';

  // ── Division-based mapping ───────────────────────────────────
  if (division >= 1 && division <= 3) return 'Agronegócio';
  if (division >= 5 && division <= 9) return 'Indústria';
  if (division >= 10 && division <= 33) return 'Indústria';
  if (division >= 35 && division <= 39) return 'Indústria';
  if (division >= 41 && division <= 43) return 'Construção';
  if (division === 45 || division === 46) return 'Comércio';
  if (division === 47) return 'Varejo';
  if (division >= 49 && division <= 53) return 'Serviços'; // logística → serviços canônicos
  if (division === 55) return 'Serviços'; // hotelaria
  if (division === 56) return 'Serviços'; // alimentação fora do lar
  if (division >= 58 && division <= 63) return 'Tecnologia';
  if (division >= 64 && division <= 66) return 'Financeiro';
  if (division === 68) return 'Serviços'; // imobiliário → serviços
  if (division >= 69 && division <= 75) return 'Serviços';
  if (division >= 77 && division <= 82) return 'Serviços';
  if (division === 85) return 'Educação';
  if (division >= 86 && division <= 88) return 'Saúde';
  if (division >= 90 && division <= 93) return 'Eventos';
  if (division >= 94 && division <= 96) return 'Serviços';

  return 'Outro';
}
