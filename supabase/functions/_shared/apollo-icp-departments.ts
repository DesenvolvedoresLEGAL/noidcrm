// Mapeamento de departamentos por categoria ICP usado pelo Apollo Invisible Mode.
// Ordem é prioridade de busca.
export const ICP_DEPARTMENTS: Record<string, string[]> = {
  AGENCIAS: ["Marketing", "Eventos", "Operações", "Compras"],
  ORGANIZADORES: ["Eventos", "Operações", "Compras"],
  MONTADORAS: ["Operações", "Compras", "Projetos"],
  PATROCINADORES: ["Marketing", "Trade Marketing", "Eventos"],
  EXPOSITORES: ["Marketing", "Eventos", "Trade", "Compras"],
};

export const SENIORITY_RANK: Record<string, number> = {
  c_suite: 100,
  founder: 100,
  owner: 100,
  head: 80,
  director: 75,
  vp: 75,
  manager: 60,
  gerente: 60,
  coordenador: 45,
  coordinator: 45,
  especialista: 30,
  specialist: 30,
  senior: 25,
  analista: 10,
  analyst: 10,
  junior: 5,
  assistente: 0,
  assistant: 0,
  intern: -10,
  estagiario: -10,
};

const IGNORED_TITLE_HINTS = ["estagi", "intern", "assistente", "assistant", "junior", " jr "];

export function isIgnoredTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  const t = title.toLowerCase();
  return IGNORED_TITLE_HINTS.some((h) => t.includes(h));
}

export function titleSeniorityScore(title: string | null | undefined): number {
  if (!title) return 0;
  const t = title.toLowerCase();
  for (const [k, v] of Object.entries(SENIORITY_RANK)) {
    if (t.includes(k)) return Math.max(0, v);
  }
  return 0;
}

export function departmentsForIcp(icpCategory: string | null | undefined): string[] {
  if (!icpCategory) return ICP_DEPARTMENTS.EXPOSITORES;
  const key = icpCategory.toUpperCase().replace(/[ÇÃÕÁÉÍÓÚÂÊÎÔÛ]/g, (c) =>
    ({ Ç: "C", Ã: "A", Õ: "O", Á: "A", É: "E", Í: "I", Ó: "O", Ú: "U", Â: "A", Ê: "E", Î: "I", Ô: "O", Û: "U" }[c] || c)
  );
  return ICP_DEPARTMENTS[key] ?? ICP_DEPARTMENTS.EXPOSITORES;
}

export interface ContactScoreInput {
  email?: string | null;
  email_status?: string | null;
  phone?: string | null;
  phone_source_type?: string | null; // KAI.15.1 phone quality
  seniority?: string | null;
  role_title?: string | null;
  linkedin_url?: string | null;
  icp_match?: boolean;
}

// Contact Score: email valid 30 + phone(person) 20 + seniority 20 + linkedin 15 + icp role match 15
// KAI.15.1: telefone só pontua quando for person_mobile ou person_direct.
export function computeContactScore(c: ContactScoreInput): number {
  let s = 0;
  if (c.email && c.email.includes("@") && c.email_status !== "invalid") s += 30;
  const personPhone =
    !!c.phone &&
    (c.phone_source_type === "person_mobile" || c.phone_source_type === "person_direct");
  if (personPhone) s += 20;
  const senScore = titleSeniorityScore(c.seniority || c.role_title);
  if (senScore >= 60) s += 20;
  else if (senScore >= 30) s += 10;
  if (c.linkedin_url) s += 15;
  if (c.icp_match) s += 15;
  return s;
}

