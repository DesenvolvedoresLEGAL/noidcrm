const FESQUA_HOST = "fesqua.com.br";
const DIRECTORY_URL = "https://fesqua.com.br/lista-de-expositores/";
const REQUEST_TIMEOUT_MS = 25_000;
const MIN_EXHIBITOR_TABLES = 20;
const MIN_EXHIBITORS = 250;
const MIN_MEDIA_PARTNERS = 8;
const MIN_SUPPORT_PARTNERS = 20;

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

const PARTNER_NAMES: Record<string, string> = {
  "abal.org.br": "ABAL", "abividro.org.br": "ABIVIDRO", "abnt.org.br": "ABNT",
  "abrape.com.br": "ABRAPE", "achival.cl": "ACHIVAL", "adivipar.com.br": "ADIVIPAR",
  "afeal.com.br": "AFEAL", "portaldoaluminio.com.br": "PORTAL DO ALUMÍNIO",
  "anfaje.pt": "ANFAJE", "amevec.mx": "AMEVEC", "asbea.org.br": "ASBEA",
  "ascevi.com.br": "ASCEVI", "asefave.org": "ASEFAVE", "aspecpvc.org.br": "ASPEC PVC",
  "proacustica.org.br": "PROACÚSTICA", "causp.gov.br": "CAU/SP",
  "guiadovidro.com.br": "GUIA DO VIDRO", "guiafornecedoresic.com.br": "GUIA FORNECEDORES",
  "institutoidea.org.br": "INSTITUTO IDEA", "inp.org.br": "INP", "pvc.org.br": "INSTITUTO BRASILEIRO DO PVC",
  "sp.senai.br": "SENAI-SP", "siescomet.com.br": "SIESCOMET", "simvidro.com.br": "SIMVIDRO",
  "sinbevidros.com.br": "SINBEVIDROS", "sindividrosrs.com.br": "SINDIVIDROS-RS",
  "sindusconsp.com.br": "SINDUSCON-SP", "visitesaopaulo.com": "VISITE SÃO PAULO",
  "obrasonline.com.br": "OBRAS ONLINE", "canaldoserralheiro.com.br": "CANAL DO SERRALHEIRO",
  "fastener-world.com": "FASTENER WORLD", "facebook.com/feirasnegocios": "FEIRAS & NEGÓCIOS",
  "escala.com.br": "GESTÃO NEGÓCIOS", "guiadaspersianas.com.br": "GUIA DAS PERSIANAS",
  "arcoweb.com.br/projetodesign": "PROJETO DESIGN", "vidros.inf.br": "REVISTA VIDROS",
  "linktr.ee/revistaventana": "REVISTA VENTANA", "vidroimpresso.com.br": "VIDRO IMPRESSO",
  "facebook.com/revistavanoarq": "REVISTA VANO", "vanoarq.com": "REVISTA VANO",
  "vidrioperfil.com": "VIDRIO PERFIL", "contramarco.com": "CONTRAMARCO",
};

export interface FesquaCompany {
  name: string;
  website: string | null;
  logo_url: string | null;
  group: "exhibitor" | "support" | "media_partner";
  source_url: string;
}

export interface FesquaFetchResult {
  companies: FesquaCompany[];
  exhibitors_count: number;
  support_count: number;
  media_partners_count: number;
  tables_found: number;
  access_method: "direct" | "firecrawl_proxy";
}

type FetchLike = typeof fetch;

function runtimeSecret(name: string): string | null {
  return (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno?.env?.get?.(name) ?? null;
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ").replace(/&[a-z]+;/gi, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function textOnly(value: string): string {
  return decodeEntities(value.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/g, " ").trim();
}

function absoluteUrl(raw: string): string | null {
  try {
    const parsed = new URL(decodeEntities(raw), DIRECTORY_URL);
    return /^https?:$/.test(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function resolveRedirectUrl(raw: string): string {
  try {
    const parsed = new URL(raw);
    const nested = parsed.searchParams.get("u");
    return nested ? decodeURIComponent(nested) : raw;
  } catch {
    return raw;
  }
}

function partnerName(url: string, imageUrl: string | null): string | null {
  const resolved = resolveRedirectUrl(url);
  try {
    const parsed = new URL(resolved);
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    const lookup = `${host}${parsed.pathname}`.toLowerCase();
    const exact = Object.entries(PARTNER_NAMES).find(([key]) => lookup.includes(key));
    if (exact) return exact[1];
    const segment = host.split(".")[0];
    if (!segment || ["www", "l", "linktr", "instagram"].includes(segment)) return null;
    return segment.replace(/[-_]+/g, " ").toUpperCase();
  } catch {
    if (!imageUrl) return null;
    return null;
  }
}

function extractExhibitors(html: string): { companies: FesquaCompany[]; tablesFound: number } {
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)];
  const companies: FesquaCompany[] = [];
  const seen = new Set<string>();
  for (const table of tables) {
    const rows = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    for (const row of rows) {
      const name = textOnly(row[1]);
      if (!name || name.length < 2 || name.length > 180) continue;
      const key = normalizeKey(name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      companies.push({ name, website: null, logo_url: null, group: "exhibitor", source_url: DIRECTORY_URL });
    }
  }
  return { companies, tablesFound: tables.length };
}

function extractPartnerSection(html: string, startMarker: RegExp, endMarker: RegExp, group: "support" | "media_partner"): FesquaCompany[] {
  const start = html.search(startMarker);
  if (start < 0) return [];
  const tail = html.slice(start);
  const relativeEnd = tail.search(endMarker);
  const section = relativeEnd > 0 ? tail.slice(0, relativeEnd) : tail;
  const companies: FesquaCompany[] = [];
  const seen = new Set<string>();
  for (const match of section.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi)) {
    const website = absoluteUrl(match[1]);
    const logoUrl = absoluteUrl(match[2]);
    if (!website) continue;
    const name = partnerName(website, logoUrl);
    if (!name) continue;
    const key = normalizeKey(name);
    if (seen.has(key)) continue;
    seen.add(key);
    companies.push({ name, website: resolveRedirectUrl(website), logo_url: logoUrl, group, source_url: DIRECTORY_URL });
  }
  return companies;
}

async function fetchViaFirecrawl(fetchImpl: FetchLike): Promise<string> {
  const firecrawlKey = runtimeSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured for FESQUA fallback");
  const gatewayMode = firecrawlKey.startsWith("lovc_");
  const lovableKey = runtimeSecret("LOVABLE_API_KEY");
  if (gatewayMode && !lovableKey) throw new Error("LOVABLE_API_KEY not configured for Firecrawl gateway");
  const response = await fetchImpl(gatewayMode ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape" : "https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayMode ? lovableKey : firecrawlKey}`,
      "Content-Type": "application/json",
      ...(gatewayMode ? { "X-Connection-Api-Key": firecrawlKey } : {}),
    },
    body: JSON.stringify({ url: DIRECTORY_URL, formats: ["rawHtml"], onlyMainContent: false, proxy: "stealth" }),
    signal: AbortSignal.timeout(75_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`FESQUA Firecrawl proxy HTTP ${response.status}: ${body.slice(0, 160)}`);
  const envelope = JSON.parse(body) as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object" ? envelope.data as Record<string, unknown> : envelope;
  const html = typeof data.rawHtml === "string" ? data.rawHtml : typeof envelope.rawHtml === "string" ? envelope.rawHtml : null;
  if (!html) throw new Error("FESQUA Firecrawl proxy returned no raw HTML");
  return html;
}

async function fetchDirectory(fetchImpl: FetchLike): Promise<{ html: string; method: "direct" | "firecrawl_proxy" }> {
  try {
    const response = await fetchImpl(DIRECTORY_URL, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (response.ok) return { html: await response.text(), method: "direct" };
    if (response.status !== 403 && response.status !== 429 && response.status < 500) throw new Error(`HTTP ${response.status}`);
  } catch {
    // Retry through the configured server-side proxy below.
  }
  return { html: await fetchViaFirecrawl(fetchImpl), method: "firecrawl_proxy" };
}

export function detectFesqua(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === FESQUA_HOST || host.endsWith(`.${FESQUA_HOST}`);
  } catch {
    return false;
  }
}

export async function fetchFesquaCompanies(fetchImpl: FetchLike = fetch): Promise<FesquaFetchResult> {
  const { html, method } = await fetchDirectory(fetchImpl);
  const exhibitors = extractExhibitors(html);
  const media = extractPartnerSection(html, /Parceiros-de-Midia\.png/i, /apoio\.png/i, "media_partner");
  const support = extractPartnerSection(html, /apoio\.png/i, /eventos\.png/i, "support");

  if (exhibitors.tablesFound < MIN_EXHIBITOR_TABLES || exhibitors.companies.length < MIN_EXHIBITORS ||
      media.length < MIN_MEDIA_PARTNERS || support.length < MIN_SUPPORT_PARTNERS) {
    throw new Error(`FESQUA incomplete extraction: tables=${exhibitors.tablesFound}, exhibitors=${exhibitors.companies.length}, media=${media.length}, support=${support.length}`);
  }

  const companies: FesquaCompany[] = [];
  const seen = new Set<string>();
  for (const company of [...exhibitors.companies, ...media, ...support]) {
    const key = normalizeKey(company.name);
    if (seen.has(key)) continue;
    seen.add(key);
    companies.push(company);
  }
  return {
    companies,
    exhibitors_count: exhibitors.companies.length,
    support_count: support.length,
    media_partners_count: media.length,
    tables_found: exhibitors.tablesFound,
    access_method: method,
  };
}

export async function tryFesquaFromUrl(url: string): Promise<{ detection: boolean; result: FesquaFetchResult | null; error?: string }> {
  if (!detectFesqua(url)) return { detection: false, result: null };
  try {
    return { detection: true, result: await fetchFesquaCompanies() };
  } catch (error) {
    return { detection: true, result: null, error: String(error) };
  }
}