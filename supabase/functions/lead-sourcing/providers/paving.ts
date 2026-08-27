// PAVING EXPO (paving.com.br) — Elementor loop grid of the `cpt_services`
// custom post type. Every exhibitor/sponsor card renders only a logo image plus
// a "Estande: NNN" caption, so the generic logo-wall extractor collapses the
// grid to a fraction of the list. This provider reads every loop item from the
// server-rendered HTML (single page, no pagination) and derives the company
// name from the logo filename, keeping cards that have no outbound link.

const PAVING_HOST = "paving.com.br";
const EXHIBITORS_PATH = "/expositor/expositores";
const DIRECTORY_URL = `https://${PAVING_HOST}${EXHIBITORS_PATH}/`;
const MIN_EXHIBITORS = 180;

type FetchLike = typeof fetch;

const BROWSER_HEADERS: Record<string, string> = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

// Editorial noise present in the uploaded logo filenames.
const NOISE_TOKENS = new Set([
  "logo", "logos", "logotipo", "logomarca", "site", "nova", "novo", "atual",
  "png", "jpg", "jpeg", "svg", "webp", "amarelo", "vermelho", "final",
]);

// Filenames that do not carry a usable company name.
const OPAQUE_FILENAME_NAMES: Array<[RegExp, string]> = [
  [/^90ti/i, "90TI"],
  [/^ff-logo-leao/i, "FF Leão"],
  [/^xes-e-black/i, "XES e Black"],
  [/^radio[_-]onibus/i, "Rádio Ônibus"],
  [/^der-sp/i, "DER-SP"],
  [/^irmen-sany/i, "Irmen Sany"],
];

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function filenameFromUrl(rawUrl: string): string {
  const clean = decodeEntities(rawUrl).split("?")[0].split("#")[0];
  const last = clean.split("/").pop() ?? "";
  return decodeURIComponent(last)
    .replace(/\.(png|jpe?g|svg|webp|gif|avif)$/i, "")
    .replace(/\.(png|jpe?g)$/i, "");
}

function nameFromFilename(filename: string): string | null {
  const mapped = OPAQUE_FILENAME_NAMES.find(([pattern]) => pattern.test(filename));
  if (mapped) return mapped[1];

  const base = filename
    // WordPress resize suffixes (-1024x1024, -300x300, …)
    .replace(/-\d{2,4}x\d{2,4}$/i, "")
    .replace(/[_]+/g, "-")
    .replace(/[.]+/g, "-");

  const tokens = base
    .split("-")
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .filter((token) => !NOISE_TOKENS.has(token.toLowerCase()))
    // Drop trailing version/duplication counters ("-1", "-2-1", "-2026").
    .filter((token) => !/^\d{1,4}$/.test(token) || /^\d{2,4}$/.test(token) === false);

  const cleaned: string[] = [];
  for (const token of tokens) {
    if (/^\d+$/.test(token) && cleaned.length > 0) continue;
    cleaned.push(token);
  }
  if (cleaned.length === 0) return null;

  const name = cleaned
    .map((token) => {
      if (token === token.toUpperCase() && /[A-Z]/.test(token)) return token;
      if (/^\d/.test(token)) return token;
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (name.length < 2) return null;
  return name;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export interface PavingExhibitor {
  name: string;
  website: string | null;
  booth: string | null;
  logo_url: string;
  source_url: string;
}

export interface PavingFetchResult {
  exhibitors: PavingExhibitor[];
  access_method: "direct" | "firecrawl_proxy";
}

export interface PavingDetection {
  detection: boolean;
  result: PavingFetchResult | null;
  error?: string;
}

export function detectPaving(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return host === PAVING_HOST && parsed.pathname.toLowerCase().startsWith(EXHIBITORS_PATH);
  } catch {
    return false;
  }
}

export function extractPavingExhibitors(html: string): PavingExhibitor[] {
  const exhibitors: PavingExhibitor[] = [];
  const seen = new Set<string>();

  // Each exhibitor card is a top-level Elementor loop item.
  const blocks = html.split(/e-loop-item e-loop-item-/i).slice(1);

  for (const block of blocks) {
    const imageMatch = block.match(/data-src="([^"]+\.(?:png|jpe?g|svg|webp))"/i)
      ?? block.match(/src="(https:\/\/paving\.com\.br\/wp-content\/uploads\/[^"]+)"/i);
    if (!imageMatch) continue;

    const rawLogo = imageMatch[1];
    const filename = filenameFromUrl(rawLogo);
    if (!filename) continue;

    const name = nameFromFilename(filename);
    if (!name) continue;

    const linkMatch = block.match(/<a\s+href="(https?:\/\/[^"]+)"/i);
    let website: string | null = null;
    if (linkMatch) {
      const candidate = decodeEntities(linkMatch[1]);
      if (!/paving\.com\.br/i.test(candidate)) website = candidate;
    }

    const boothMatch = block.match(/Estande:\s*([^<\s][^<]{0,20})</i);
    const boothRaw = boothMatch ? boothMatch[1].trim() : "";
    const booth = boothRaw && !/^n\/?d$/i.test(boothRaw) ? boothRaw : null;

    const key = normalizeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    let logoUrl: string;
    try {
      logoUrl = new URL(rawLogo, DIRECTORY_URL).toString();
    } catch {
      continue;
    }

    exhibitors.push({ name, website, booth, logo_url: logoUrl, source_url: DIRECTORY_URL });
  }

  return exhibitors;
}

function runtimeSecret(name: string): string | undefined {
  try {
    return (globalThis as { Deno?: { env: { get(key: string): string | undefined } } }).Deno?.env.get(name);
  } catch {
    return undefined;
  }
}

async function fetchViaFirecrawl(fetchImpl: FetchLike): Promise<string> {
  const firecrawlKey = runtimeSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured for PAVING fallback");
  const gatewayMode = firecrawlKey.startsWith("lovc_");
  const lovableKey = runtimeSecret("LOVABLE_API_KEY");
  if (gatewayMode && !lovableKey) throw new Error("LOVABLE_API_KEY not configured for Firecrawl gateway");

  const response = await fetchImpl(
    gatewayMode
      ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape"
      : "https://api.firecrawl.dev/v2/scrape",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${gatewayMode ? lovableKey : firecrawlKey}`,
        "Content-Type": "application/json",
        ...(gatewayMode ? { "X-Connection-Api-Key": firecrawlKey } : {}),
      },
      body: JSON.stringify({
        url: DIRECTORY_URL,
        formats: ["rawHtml"],
        onlyMainContent: false,
        proxy: "stealth",
      }),
      signal: AbortSignal.timeout(75_000),
    },
  );

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`PAVING Firecrawl proxy HTTP ${response.status}: ${body.slice(0, 160)}`);
  }
  const envelope = JSON.parse(body) as Record<string, unknown>;
  const data = envelope.data && typeof envelope.data === "object"
    ? envelope.data as Record<string, unknown>
    : envelope;
  const html = typeof data.rawHtml === "string" ? data.rawHtml : null;
  if (!html) throw new Error("PAVING Firecrawl proxy returned no raw HTML");
  return html;
}

async function fetchDirectory(fetchImpl: FetchLike): Promise<{ html: string; method: "direct" | "firecrawl_proxy" }> {
  try {
    const response = await fetchImpl(DIRECTORY_URL, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) {
      const html = await response.text();
      if (/e-loop-item/i.test(html)) return { html, method: "direct" };
    }
  } catch {
    // Fall back to the configured server-side proxy.
  }
  return { html: await fetchViaFirecrawl(fetchImpl), method: "firecrawl_proxy" };
}

export async function fetchPavingExhibitors(fetchImpl: FetchLike = fetch): Promise<PavingFetchResult> {
  const { html, method } = await fetchDirectory(fetchImpl);
  const exhibitors = extractPavingExhibitors(html);
  if (exhibitors.length < MIN_EXHIBITORS) {
    throw new Error(`PAVING incomplete extraction: exhibitors=${exhibitors.length}, minimum=${MIN_EXHIBITORS}`);
  }
  return { exhibitors, access_method: method };
}

export async function tryPavingFromUrl(url: string): Promise<PavingDetection> {
  if (!detectPaving(url)) return { detection: false, result: null };
  try {
    return { detection: true, result: await fetchPavingExhibitors() };
  } catch (error) {
    return { detection: true, result: null, error: String(error) };
  }
}
