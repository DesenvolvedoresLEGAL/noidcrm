// Sprint NRHS 1.5 — Normaliza metadata/breakdown de NRHS para evitar crash
// (`Cannot read properties of undefined (reading 'integrity')`) quando o
// payload persistido vier em formato legado, parcial ou ausente.

type Pillar = { score: number; issues: string[]; passed: string[] };

const EMPTY_PILLAR: Pillar = { score: 0, issues: [], passed: [] };

function asPillar(raw: any): Pillar {
  if (!raw || typeof raw !== 'object') return EMPTY_PILLAR;
  return {
    score: Number(raw.score ?? raw.value ?? 0) || 0,
    issues: Array.isArray(raw.issues) ? raw.issues : [],
    passed: Array.isArray(raw.passed) ? raw.passed : [],
  };
}

export function normalizeNRHSMetadata(opp: any) {
  const m = opp?.nrhs_metadata ?? opp?.nrhs_breakdown ?? {};
  const p = (m && typeof m === 'object' && (m.pillars ?? m)) || {};
  const pick = (k: string, fallback?: string) =>
    asPillar(p?.[k] ?? (fallback ? p?.[fallback] : undefined));

  return {
    pillars: {
      integrity: pick('integrity', 'data_integrity'),
      cadence: pick('cadence'),
      stakeholders: pick('stakeholders'),
      winloss: pick('winloss', 'win_loss'),
      adherence: pick('adherence', 'process_adherence'),
      evidence: pick('evidence'),
    },
    blockers: Array.isArray(opp?.nrhs_blockers) ? opp.nrhs_blockers : [],
    gaps: Array.isArray(opp?.nrhs_gaps) ? opp.nrhs_gaps : [],
    recommendations: Array.isArray(opp?.nrhs_recommendations) ? opp.nrhs_recommendations : [],
    required_actions: Array.isArray(m?.required_actions) ? m.required_actions : [],
  };
}
