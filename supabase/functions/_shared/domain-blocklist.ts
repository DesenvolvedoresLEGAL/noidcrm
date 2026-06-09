// Shared blocklist of aggregator / directory / social-network domains that must
// NEVER be persisted as a prospect's `normalized_domain`. Using one of these as
// a company domain causes the Apollo enrichment to return contacts from the
// aggregator itself (e.g. JusBrasil employees) instead of the real company.
//
// Keep this list conservative: only domains that are NEVER the canonical site
// of a real B2B prospect we'd sell to.

export const BLOCKED_DOMAINS: readonly string[] = [
  // Social networks
  "linkedin.com", "facebook.com", "instagram.com", "twitter.com", "x.com",
  "youtube.com", "tiktok.com", "pinterest.com", "threads.net",
  // Job boards / reviews
  "glassdoor.com", "reclameaqui.com.br", "indeed.com",
  "vagas.com.br", "catho.com.br", "infojobs.com.br", "gupy.io",
  "trustpilot.com", "yelp.com",
  // Search / maps / wiki
  "google.com", "bing.com", "g.co", "maps.google.com",
  "wikipedia.org", "medium.com",
  // BR legal / CNPJ / company directories (root cause of Luisa/JusBrasil bug)
  "jusbrasil.com.br", "econodata.com.br", "econoinfo.com.br",
  "cnpj.biz", "cnpj.info", "cnpjs.rocks", "cnpjbiz.com", "cnpja.com",
  "consultasocio.com", "empresaqualifica.com.br", "casadosdados.com.br",
  "apontador.com.br", "telelistas.net", "guiamais.com.br",
  "receita.fazenda.gov.br", "solucoes.receita.fazenda.gov.br", "gov.br",
  // International data providers (never the company's own site)
  "crunchbase.com", "bloomberg.com", "dnb.com", "zoominfo.com",
  "apollo.io", "rocketreach.co", "owler.com", "pitchbook.com",
  // Marketplaces
  "mercadolivre.com.br", "olx.com.br", "amazon.com", "amazon.com.br",
];

export function normalizeHostname(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(String(raw).startsWith("http") ? String(raw) : `https://${raw}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isBlockedDomain(domain: string | null | undefined): boolean {
  if (!domain) return false;
  const d = domain.toLowerCase().replace(/^www\./, "");
  return BLOCKED_DOMAINS.some((b) => d === b || d.endsWith(`.${b}`));
}

/**
 * Returns the input domain if it is safe to persist as a prospect's own domain,
 * or `null` if it points to an aggregator / social / directory that would
 * poison downstream enrichment.
 */
export function sanitizeProspectDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  const normalized = normalizeHostname(domain) ?? domain.toLowerCase().replace(/^www\./, "");
  return isBlockedDomain(normalized) ? null : normalized;
}
