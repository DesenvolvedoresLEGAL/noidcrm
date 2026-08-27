const HIS_HOST = "his.saudebusiness.com";
const HIS_SPONSORS_PATH = "/patrocinio/patrocinadores";
const DIRECTORY_URL = `https://${HIS_HOST}${HIS_SPONSORS_PATH}/`;
const MIN_SPONSORS = 70;

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

const SECTION_MARKERS: Array<[RegExp, string]> = [
  [/lounge-internacional/i, "Lounge Internacional"],
  [/02-negocios1-premium/i, "Negócios — Premium"],
  [/02-negocios1-target/i, "Negócios — Target"],
  [/02-negocios1-advance/i, "Negócios — Advance"],
  [/02-negocios1-lite/i, "Negócios — Lite"],
  [/02-negocios1-lounge/i, "Negócios — Lounge"],
  [/startup-premium/i, "Startup Premium"],
  [/02-negocios1-startup/i, "Startup"],
  [/04-conteudo/i, "Conteúdo"],
  [/03-experiencia/i, "Experiência"],
  [/08-mi-dias-parceiras/i, "Mídia Parceira"],
  [/09-apoio-institucional/i, "Apoio Institucional"],
];

// A página não fornece alt, link ou legenda para os logos. Estes arquivos têm
// nomes editoriais genéricos; o mapa evita salvar "Design sem nome", hashes etc.
const OPAQUE_FILENAME_NAMES: Array<[RegExp, string]> = [
  [/^fbbc557d-/i, "AICEP"],
  [/^logo-clicknurse/i, "Clicknurse"],
  [/^logo-mv-/i, "MV"],
  [/^outsystems-logo/i, "OutSystems"],
  [/^design-sem-nome--1--/i, "Liberty Group"],
  [/^telepatia-/i, "Telepatia"],
  [/^claro-empresas/i, "Claro Empresas"],
  [/^6033db74/i, "Bionexo Tasy"],
  [/^rivio-/i, "Rivio"],
  [/^gesta-/i, "Gesta"],
  [/^logo-invisual/i, "Invisual"],
  [/^logo-mevo|^mevo-/i, "Mevo"],
  [/^intelectah-/i, "Intelectah"],
  [/^level-/i, "Level"],
  [/^conectivida-/i, "Conectivida by Macrosul"],
  [/^net2phone-/i, "Net2Phone"],
  [/^logo-a3data/i, "A3Data"],
  [/^logo-datasigh/i, "DataSigh"],
  [/^logotipo-rapidoc/i, "Rapidoc"],
  [/^seiwa-/i, "Seiwa"],
  [/^hexgreen-/i, "HexGreen"],
  [/^logo-dgs-brasil/i, "DGS Brasil"],
  [/^logo-cadernos-branco/i, "Wellon"],
  [/^logo-azul-fundo-transparente/i, "Pega Plantão"],
  [/^logo3-/i, "Multiedro"],
  [/^logo-topdoc/i, "TopDOC"],
  [/^techmag-/i, "Techmag"],
  [/^background-transparent-wfo/i, "WFO"],
  [/^logos-boxware/i, "Boxware"],
  [/^logo-1-/i, "Cluvo"],
  [/^foxit-/i, "Foxit"],
  [/^precare-/i, "Precare"],
  [/^logowh2/i, "WH2"],
  [/^horizontal--3--/i, "Botdesigner"],
  [/^logo-haistech/i, "HaisTech"],
  [/^nextrun-/i, "NextRun"],
  [/^logo-fundo-verde/i, "Convi"],
  [/^isologotipo-/i, "Medipreço"],
  [/^style-symbol-logo-primary-dark/i, "Turi Saúde"],
  [/^logo-02-azul-escuro/i, "Escuro"],
  [/^logo-ktech-genesys/i, "KTech Genesys"],
  [/^hosplog-/i, "Hosplog"],
  [/^pm1-/i, "Saúde Business"],
  [/^logo-portal-revista/i, "Portal Revista"],
  [/^logo-abiis/i, "ABIIS"],
  [/^sem-nome--200-x-200-mm/i, "A.C.Camargo Cancer Center"],
  [/^cmyk--logo-federa/i, "Federação Assespro"],
  [/^logo-biominas/i, "Biominas"],
  [/^full-azul-turquesa/i, "CBEXS"],
  [/^logo-fbah/i, "FBAH"],
  [/^fenaess-/i, "FENAESS"],
  [/^logo-iess/i, "IESS"],
  [/^ona-/i, "ONA"],
  [/^sindhosfil-/i, "Sindhosfil"],
  [/^logo-principal-green-rock/i, "Green Rock"],
  [/^logo-nova-2023-abeclin/i, "ABEClin"],
  [/^logo-acate/i, "ACATE"],
  [/^hcx-fmusp/i, "HCX FMUSP"],
  [/^artemisia-/i, "Artemisia"],
  [/^logo-cietec/i, "CIETEC"],
  [/^nina-hub/i, "Nina Hub"],
  [/^logo-tecnosinos/i, "Tecnosinos"],
  [/^assinatura-de-logotipos/i, "DE Hub"],
  [/^ailogo/i, "AI Brasil"],
  [/^wmn-hub/i, "WMN Hub"],
  [/^logo-aceventures/i, "ACE Ventures"],
  [/^hub-connect-healthtech/i, "Hub Connect Healthtech"],
  [/^imgi-6-logo2024/i, "Health Connection"],
  [/^abria-/i, "ABRIA"],
  [/^logo-ai-safety-brazil/i, "AI Safety Brazil"],
  [/^imgi-1-perfil3/i, "Perfil 3"],
  [/^c-pia-de-tv-doutor/i, "TV Doutor"],
  [/^logo-anbiotec/i, "ANBIOTEC Brasil"],
  [/^logo\.tec\.incubadora/i, "TEC Incubadora"],
  [/^imgi-1-logo-abes/i, "ABES"],
  [/^celta-/i, "CELTA"],
  [/^brasilien-/i, "Brasilien"],
];

const NOISE_TOKENS = new Set([
  "logo", "logos", "logotipo", "horizontal", "vertical", "fundo", "transparente",
  "novo", "nova", "color", "colorido", "colorida", "azul", "verde", "rosa", "branco",
  "preto", "curva", "web", "digital", "main", "primary", "dark", "light", "symbol",
  "vetorizado", "vetorizada", "page", "perfil", "imgi", "assinatura", "positivo",
  "cmky", "cmyk", "rgb", "arquivo", "design", "sem", "nome", "background",
]);

export interface HisSponsor {
  name: string;
  category: string;
  logo_url: string;
  source_url: string;
}

export interface HisSponsorsFetchResult {
  sponsors: HisSponsor[];
  access_method: "direct" | "firecrawl_proxy";
}

type FetchLike = typeof fetch;

function runtimeSecret(name: string): string | null {
  return (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno?.env?.get?.(name) ?? null;
}

function decodeEntities(value: string): string {
  return value.replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
}

function imageFilename(rawUrl: string): string {
  try { return new URL(decodeEntities(rawUrl), DIRECTORY_URL).pathname.split("/").pop() ?? ""; }
  catch { return ""; }
}

function normalizeKey(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function titleCaseToken(token: string): string {
  const upper = new Set(["mv", "smed", "dgs", "wfo", "abiis", "fbah", "iess", "ona", "acate", "hcx", "a3data"]);
  if (upper.has(token.toLowerCase())) return token.toUpperCase();
  return token.length <= 2 ? token.toUpperCase() : token[0].toUpperCase() + token.slice(1).toLowerCase();
}

function nameFromFilename(filename: string): string | null {
  const override = OPAQUE_FILENAME_NAMES.find(([pattern]) => pattern.test(filename));
  if (override) return override[1];

  let stem = filename.replace(/\.(png|jpe?g|webp|svg|avif)$/i, "");
  stem = stem.replace(/-[a-f0-9]{24,}$/i, "").replace(/\.pdf/gi, " ");
  stem = stem.replace(/\b\d{3,4}x\d{3,4}\b/gi, " ").replace(/--?\d+--?/g, " ");
  const tokens = stem.split(/[^\p{L}\p{N}]+/u)
    .map((token) => token.trim())
    .filter((token) => token && !/^\d+$/.test(token) && !NOISE_TOKENS.has(token.toLowerCase()));
  if (tokens.length === 0) return null;
  const name = tokens.slice(0, 6).map(titleCaseToken).join(" ").trim();
  return name.length >= 2 && name.length <= 80 ? name : null;
}

function extractSponsors(html: string): HisSponsor[] {
  const sponsors: HisSponsor[] = [];
  const seen = new Set<string>();
  let category: string | null = null;

  for (const match of html.matchAll(/<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi)) {
    const rawUrl = match[1];
    if (!/knect365\.imgix\.net\/uploads\//i.test(rawUrl)) continue;
    const filename = imageFilename(rawUrl);
    if (!filename) continue;

    const section = SECTION_MARKERS.find(([pattern]) => pattern.test(filename));
    if (section) {
      category = section[1];
      continue;
    }
    if (/^(his-colour|01-patrocinadores|02-negocios-|informa-markets-logo)/i.test(filename)) continue;
    if (!category) continue;

    const name = nameFromFilename(filename);
    if (!name) continue;
    const key = normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    let logoUrl: string;
    try { logoUrl = new URL(decodeEntities(rawUrl), DIRECTORY_URL).toString(); }
    catch { continue; }
    sponsors.push({ name, category, logo_url: logoUrl, source_url: DIRECTORY_URL });
  }
  return sponsors;
}

async function fetchViaFirecrawl(fetchImpl: FetchLike): Promise<string> {
  const firecrawlKey = runtimeSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured for HIS fallback");
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
  if (!response.ok) throw new Error(`HIS Firecrawl proxy HTTP ${response.status}: ${body.slice(0, 160)}`);
  const envelope = JSON.parse(body) as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object" ? envelope.data as Record<string, unknown> : envelope;
  const html = typeof data.rawHtml === "string" ? data.rawHtml : typeof envelope.rawHtml === "string" ? envelope.rawHtml : null;
  if (!html) throw new Error("HIS Firecrawl proxy returned no raw HTML");
  return html;
}

async function fetchDirectory(fetchImpl: FetchLike): Promise<{ html: string; method: "direct" | "firecrawl_proxy" }> {
  try {
    const response = await fetchImpl(DIRECTORY_URL, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(25_000) });
    if (response.ok) return { html: await response.text(), method: "direct" };
  } catch {
    // Retry using the configured server-side proxy.
  }
  return { html: await fetchViaFirecrawl(fetchImpl), method: "firecrawl_proxy" };
}

export function detectHisSponsors(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === HIS_HOST && parsed.pathname.toLowerCase().startsWith(HIS_SPONSORS_PATH);
  } catch { return false; }
}

export async function fetchHisSponsors(fetchImpl: FetchLike = fetch): Promise<HisSponsorsFetchResult> {
  const { html, method } = await fetchDirectory(fetchImpl);
  const sponsors = extractSponsors(html);
  if (sponsors.length < MIN_SPONSORS) {
    throw new Error(`HIS incomplete extraction: sponsors=${sponsors.length}, minimum=${MIN_SPONSORS}`);
  }
  return { sponsors, access_method: method };
}

export async function tryHisSponsorsFromUrl(url: string): Promise<{ detection: boolean; result: HisSponsorsFetchResult | null; error?: string }> {
  if (!detectHisSponsors(url)) return { detection: false, result: null };
  try { return { detection: true, result: await fetchHisSponsors() }; }
  catch (error) { return { detection: true, result: null, error: String(error) }; }
}