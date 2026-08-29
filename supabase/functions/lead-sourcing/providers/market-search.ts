// Market Search — consolidação multi-fonte (Places + Firecrawl + Perplexity).
// Responsável por normalizar candidatos, filtrar lixo (agregadores, portais,
// redes sociais) e deduplicar por domínio / nome / telefone.

import { isBlockedDomain, normalizeHostname } from "../../_shared/domain-blocklist.ts";

export type MarketSourceKind = "google_places" | "firecrawl" | "perplexity";

export interface MarketCandidate {
  company_name: string;
  website: string | null;
  domain: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  category: string | null;
  description: string | null;
  sources: MarketSourceKind[];
  source_urls: string[];
  confidence: number;
}

const JUNK_NAME_PATTERNS = [
  /^as \d+/i,
  /\b(melhores|top|lista|ranking|guia|blog|not[ií]cias?|artigo|curso|vagas?|emprego)\b/i,
  /^(google|facebook|instagram|linkedin|youtube|wikipedia)\b/i,
];

const AGGREGATOR_HINTS = [
  "guiamais", "telelistas", "apontador", "solutudo", "encontra", "listou",
  "trivago", "tripadvisor", "reclameaqui", "glassdoor", "indeed", "catho",
  "mercadolivre", "olx", "amazon", "shopee", "elo7", "yelp", "foursquare",
  "wikipedia", "blogspot", "medium", "substack", "gov.br", "sebrae",
];

export function normalizeName(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\b(ltda|s\.?a\.?|eireli|epp|me|mei)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhone(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "").replace(/^55/, "");
  if (digits.length < 10 || digits.length > 11) return null;
  return digits;
}

export function toDomain(url: string | null): string | null {
  if (!url) return null;
  const host = normalizeHostname(url.startsWith("http") ? url : `https://${url}`);
  if (!host) return null;
  if (isBlockedDomain(host)) return null;
  if (AGGREGATOR_HINTS.some((h) => host.includes(h))) return null;
  return host;
}

export function isJunkCompany(name: string): boolean {
  const clean = name.trim();
  if (clean.length < 3 || clean.length > 120) return true;
  if (/^\d+$/.test(clean)) return true;
  return JUNK_NAME_PATTERNS.some((re) => re.test(clean));
}

/** Um candidato só entra se tiver domínio próprio OU telefone válido. */
export function hasMinimumIdentity(c: MarketCandidate): boolean {
  return !!c.domain || !!normalizePhone(c.phone);
}

function mergeInto(target: MarketCandidate, incoming: MarketCandidate) {
  target.website = target.website || incoming.website;
  target.domain = target.domain || incoming.domain;
  target.phone = target.phone || incoming.phone;
  target.email = target.email || incoming.email;
  target.address = target.address || incoming.address;
  target.city = target.city || incoming.city;
  target.state = target.state || incoming.state;
  target.category = target.category || incoming.category;
  target.description = target.description || incoming.description;
  for (const s of incoming.sources) if (!target.sources.includes(s)) target.sources.push(s);
  for (const u of incoming.source_urls) if (u && !target.source_urls.includes(u)) target.source_urls.push(u);
  target.confidence = Math.min(95, Math.max(target.confidence, incoming.confidence));
}

/**
 * Consolida candidatos das três fontes: dedup por domínio, nome normalizado
 * e telefone. Empresas citadas por 2+ fontes ganham voto de confiança.
 */
export function consolidateCandidates(raw: MarketCandidate[]): MarketCandidate[] {
  const byKey = new Map<string, MarketCandidate>();
  const domainIndex = new Map<string, string>();
  const phoneIndex = new Map<string, string>();
  const nameIndex = new Map<string, string>();

  for (const item of raw) {
    const name = item.company_name?.trim();
    if (!name || isJunkCompany(name)) continue;

    const domain = item.domain || toDomain(item.website);
    const phone = normalizePhone(item.phone);
    const nname = normalizeName(name);
    if (!nname) continue;

    const candidate: MarketCandidate = { ...item, company_name: name, domain, sources: [...item.sources], source_urls: [...item.source_urls] };

    const existingKey =
      (domain && domainIndex.get(domain)) ||
      (phone && phoneIndex.get(phone)) ||
      nameIndex.get(nname);

    if (existingKey && byKey.has(existingKey)) {
      mergeInto(byKey.get(existingKey)!, candidate);
      const merged = byKey.get(existingKey)!;
      if (merged.domain) domainIndex.set(merged.domain, existingKey);
      const mPhone = normalizePhone(merged.phone);
      if (mPhone) phoneIndex.set(mPhone, existingKey);
      nameIndex.set(nname, existingKey);
      continue;
    }

    const key = domain || phone || nname;
    byKey.set(key, candidate);
    if (domain) domainIndex.set(domain, key);
    if (phone) phoneIndex.set(phone, key);
    nameIndex.set(nname, key);
  }

  // Voto de confiança: mais fontes = mais confiança
  const list = Array.from(byKey.values()).map((c) => {
    const bonus = (c.sources.length - 1) * 12 + (c.domain ? 8 : 0) + (normalizePhone(c.phone) ? 6 : 0);
    return { ...c, confidence: Math.min(95, c.confidence + bonus) };
  });

  list.sort((a, b) => b.confidence - a.confidence || b.sources.length - a.sources.length);
  return list;
}

/** Parser das respostas da Perplexity ("Nome | site | cidade/UF | telefone"). */
export function parsePerplexityCompanies(content: string, citations: string[]): MarketCandidate[] {
  const out: MarketCandidate[] = [];
  for (const line of content.split("\n")) {
    const clean = line.replace(/^\s*[-*\d.)\]]+\s*/, "").trim();
    if (!clean || !clean.includes("|")) continue;
    const parts = clean.split("|").map((p) => p.trim());
    const name = parts[0]?.replace(/\*\*/g, "").trim();
    if (!name || isJunkCompany(name)) continue;
    const site = parts[1] && /\./.test(parts[1]) ? parts[1] : null;
    const geo = parts[2] || "";
    const phone = parts[3] || null;
    const [city, state] = geo.split("/").map((s) => s.trim());
    out.push({
      company_name: name,
      website: site ? (site.startsWith("http") ? site : `https://${site}`) : null,
      domain: toDomain(site),
      phone: phone && /\d/.test(phone) ? phone : null,
      email: null,
      address: null,
      city: city || null,
      state: state || null,
      category: null,
      description: null,
      sources: ["perplexity"],
      source_urls: citations.slice(0, 3),
      confidence: 45,
    });
  }
  return out;
}
