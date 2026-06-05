// Editorial post-processing for Release Notes drafts.
// Garante qualidade de publicação: traduz jargão técnico, remove itens vazios/contraditórios,
// consolida, ordena por impacto, e ajusta título/descrição quando há commits reais.

export type ChangeType = "feature" | "fix" | "improvement" | "security";
export type Change = { type: ChangeType; description: string };

// Substituições de termos internos por linguagem de produto.
// Aplicadas case-insensitive preservando capitalização inicial.
const TERM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bTD\b/g, "Tabela dinâmica"],
  [/\bclients?\s+públicos?\b/gi, "acesso público"],
  [/\bclient\s+public\b/gi, "acesso público"],
  [/\bpolíticas?\s+anônimas?\b/gi, "controles de acesso público"],
  [/\banonymous\s+polic(y|ies)\b/gi, "controles de acesso público"],
  [/\bRLS\b/g, "controles de acesso"],
  [/\bpayloads?\b/gi, "dados enviados"],
  [/\bstack\s+traces?\b/gi, "detalhes técnicos do erro"],
  [/\btokens?\b/gi, "credenciais"],
  [/\bendpoints?\b/gi, "rotas da API"],
  [/\bedge\s+functions?\b/gi, "funções de servidor"],
  [/\bschema\b/gi, "estrutura de dados"],
  [/\bquer(y|ies)\b/gi, "consultas"],
  [/\bcron(jobs?)?\b/gi, "agendamentos automáticos"],
];

const LOW_QUALITY_PATTERNS: RegExp[] = [
  /^nenhuma?\s+execu[cç][aã]o/i,
  /sem\s+novidades?/i,
  /n[aã]o\s+h[aá]\s+mudan[cç]as?/i,
  /n[aã]o\s+foram?\s+registrad[ao]s?\s+(execu|atualiza)/i,
  /^changes?\.?$/i,
  /^update\.?$/i,
  /^wip\.?$/i,
  /^chore\b/i,
  /^merge(\s+branch)?\b/i,
  /^lovable[-\s]?dev\b/i,
  /^fix\s+typo$/i,
];

function isLowQuality(desc: string): boolean {
  const t = (desc || "").trim();
  if (t.length < 20) return true;
  for (const re of LOW_QUALITY_PATTERNS) if (re.test(t)) return true;
  // texto útil: descontando pontuação/espaços
  const useful = t.replace(/[^\p{L}\p{N}]+/gu, "");
  return useful.length < 15;
}

function applyTermReplacements(s: string): string {
  let out = s;
  for (const [re, rep] of TERM_REPLACEMENTS) out = out.replace(re, rep);
  // Capitaliza primeira letra
  out = out.trim();
  if (out.length) out = out[0].toUpperCase() + out.slice(1);
  return out;
}

function dedupeAndConsolidate(changes: Change[]): Change[] {
  const seen = new Map<string, Change>();
  for (const c of changes) {
    const key = c.description
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    if (!seen.has(key)) seen.set(key, c);
  }
  return Array.from(seen.values());
}

// Ordem por impacto: novidade, melhoria, automação (improvement),
// performance/segurança, correção.
const TYPE_ORDER: Record<ChangeType, number> = {
  feature: 0,
  improvement: 1,
  security: 2,
  fix: 3,
};

export type EditorialContext = {
  version: string;
  periodDays: number;
  githubCommits: number;
  githubPRs: number;
  systemEvents: number;
};

export type EditorialResult = {
  title: string;
  description: string;
  is_major: boolean;
  changes: Change[];
  notes: string[]; // motivos das mudanças (para log/debug)
};

export function applyEditorialPolicy(
  draft: { title: string; description: string; is_major: boolean; changes: Change[] },
  ctx: EditorialContext,
): EditorialResult {
  const notes: string[] = [];
  const hasRealCommits = ctx.githubCommits > 0 || ctx.githubPRs > 0;

  // 1. Filtra/normaliza itens
  let changes = (draft.changes || [])
    .map((c) => ({ type: c.type, description: applyTermReplacements(c.description || "") }))
    .filter((c) => {
      if (isLowQuality(c.description)) {
        notes.push(`removido_baixa_qualidade: ${c.description.slice(0, 60)}`);
        return false;
      }
      // Se há commits reais, nunca aceitar item que negue novidades.
      if (hasRealCommits && /(nenhuma|sem novidades|n[aã]o h[aá] mudan)/i.test(c.description)) {
        notes.push(`removido_contraditorio: ${c.description.slice(0, 60)}`);
        return false;
      }
      return true;
    });

  // 2. Dedup/consolidação
  changes = dedupeAndConsolidate(changes);

  // 3. Ordenar por impacto
  changes.sort((a, b) => TYPE_ORDER[a.type] - TYPE_ORDER[b.type]);

  // 4. Limitar a 12 itens
  if (changes.length > 12) {
    notes.push(`truncado_de_${changes.length}_para_12`);
    changes = changes.slice(0, 12);
  }

  // 5. Título: se houver commits reais, não permitir título técnico/IA.
  let title = (draft.title || "").trim();
  const titleTechnical =
    !title ||
    /execu[cç][aã]o(es)?\s+de\s+IA|ai\s+runs?|resumo\s+t[eé]cnico|sem\s+novidades?/i.test(title);
  if (hasRealCommits && titleTechnical) {
    title = `Release semanal NOID CRM, v${ctx.version}`;
    notes.push("titulo_substituido_padrao");
  }
  if (!title) title = `Release semanal NOID CRM, v${ctx.version}`;

  // 6. Descrição: se contradizer changes, regenerar resumo curto.
  let description = applyTermReplacements((draft.description || "").trim());
  const descContradicts =
    hasRealCommits &&
    /(nenhuma\s+execu|sem\s+novidades?|n[aã]o\s+(houve|h[aá])\s+(mudan|atualiza|execu))/i.test(description);
  if (!description || descContradicts || description.length < 30) {
    const featureCount = changes.filter((c) => c.type === "feature").length;
    const fixCount = changes.filter((c) => c.type === "fix").length;
    const improvementCount = changes.filter((c) => c.type === "improvement").length;
    const securityCount = changes.filter((c) => c.type === "security").length;
    const parts: string[] = [];
    if (featureCount) parts.push(`${featureCount} novidade${featureCount > 1 ? "s" : ""}`);
    if (improvementCount) parts.push(`${improvementCount} melhoria${improvementCount > 1 ? "s" : ""}`);
    if (securityCount) parts.push(`${securityCount} reforço${securityCount > 1 ? "s" : ""} de segurança`);
    if (fixCount) parts.push(`${fixCount} correç${fixCount > 1 ? "ões" : "ão"}`);
    const summary = parts.length ? parts.join(", ") : `${changes.length} atualizações`;
    description = `Evolução semanal do NOID CRM: ${summary} entregues nos últimos ${ctx.periodDays} dias. Revise antes de publicar.`;
    notes.push("descricao_regenerada");
  }

  return {
    title,
    description,
    is_major: !!draft.is_major,
    changes,
    notes,
  };
}
