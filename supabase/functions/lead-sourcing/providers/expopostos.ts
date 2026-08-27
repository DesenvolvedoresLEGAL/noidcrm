const API_URL = "https://admin.expopostos.com.br/api/marca_confirmada/?page_size=50&ordering=nome";
const MAX_PAGES = 25;
const REQUEST_TIMEOUT_MS = 20_000;
const DIRECT_RETRIES = 2;

const API_HEADERS: Record<string, string> = {
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  "Origin": "https://expopostos.com.br",
  "Referer": "https://expopostos.com.br/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36",
};

export interface ExpoPostosBrand {
  id: number | string;
  name: string;
  description: string | null;
  website: string | null;
  logo_url: string | null;
}

export interface ExpoPostosFetchResult {
  brands: ExpoPostosBrand[];
  total_count: number | null;
  pages_fetched: number;
  access_method: "direct" | "firecrawl_proxy" | "mixed";
}

interface ApiPage {
  count?: number;
  next?: string | null;
  results?: Array<Record<string, unknown>>;
}

type FetchLike = typeof fetch;

function runtimeSecret(name: string): string | null {
  return (globalThis as { Deno?: { env?: { get?: (key: string) => string | undefined } } })
    .Deno?.env?.get?.(name) ?? null;
}

function parseApiPage(raw: string): ApiPage {
  const candidates = [raw.trim()];
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  if (fenced) candidates.push(fenced);
  const objectStart = raw.indexOf("{");
  const objectEnd = raw.lastIndexOf("}");
  if (objectStart >= 0 && objectEnd > objectStart) candidates.push(raw.slice(objectStart, objectEnd + 1));

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as ApiPage;
      if (parsed && Array.isArray(parsed.results)) return parsed;
    } catch {
      // Try the next representation returned by the proxy.
    }
  }
  throw new Error("Expo Postos proxy returned invalid JSON");
}

async function fetchViaFirecrawl(url: string, fetchImpl: FetchLike): Promise<ApiPage> {
  const firecrawlKey = runtimeSecret("FIRECRAWL_API_KEY");
  if (!firecrawlKey) throw new Error("FIRECRAWL_API_KEY not configured for Expo Postos fallback");

  const gatewayMode = firecrawlKey.startsWith("lovc_");
  const lovableKey = runtimeSecret("LOVABLE_API_KEY");
  if (gatewayMode && !lovableKey) throw new Error("LOVABLE_API_KEY not configured for Firecrawl gateway");

  const endpoint = gatewayMode
    ? "https://connector-gateway.lovable.dev/firecrawl/v2/scrape"
    : "https://api.firecrawl.dev/v2/scrape";
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${gatewayMode ? lovableKey : firecrawlKey}`,
    "Content-Type": "application/json",
  };
  if (gatewayMode) headers["X-Connection-Api-Key"] = firecrawlKey;

  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url,
      formats: ["rawHtml", "markdown"],
      onlyMainContent: false,
      proxy: "stealth",
      timeout: 60_000,
    }),
    signal: AbortSignal.timeout(75_000),
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Expo Postos Firecrawl proxy HTTP ${response.status}: ${body.slice(0, 160)}`);

  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(body) as Record<string, unknown>;
  } catch {
    throw new Error("Expo Postos Firecrawl proxy returned a non-JSON envelope");
  }
  const data = (envelope.data && typeof envelope.data === "object")
    ? envelope.data as Record<string, unknown>
    : envelope;
  const proxied = [data.rawHtml, data.markdown, envelope.rawHtml, envelope.markdown]
    .find((value): value is string => typeof value === "string" && value.trim().length > 0);
  if (!proxied) throw new Error("Expo Postos Firecrawl proxy returned an empty body");
  return parseApiPage(proxied);
}

async function fetchApiPage(url: string, fetchImpl: FetchLike): Promise<{ page: ApiPage; method: "direct" | "firecrawl_proxy" }> {
  let lastError = "unknown direct fetch failure";
  for (let attempt = 1; attempt <= DIRECT_RETRIES; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: API_HEADERS,
        redirect: "follow",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (response.ok) return { page: await response.json() as ApiPage, method: "direct" };
      lastError = `HTTP ${response.status}`;
      if (response.status === 403 || response.status === 401) break;
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      lastError = String(error);
    }
  }

  try {
    return { page: await fetchViaFirecrawl(url, fetchImpl), method: "firecrawl_proxy" };
  } catch (proxyError) {
    throw new Error(`Expo Postos direct request failed (${lastError}); proxy failed (${String(proxyError)})`);
  }
}

export function detectExpoPostos(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "expopostos.com.br" || host.endsWith(".expopostos.com.br");
  } catch {
    return false;
  }
}

export async function fetchExpoPostosBrands(fetchImpl: FetchLike = fetch): Promise<ExpoPostosFetchResult> {
  const brands: ExpoPostosBrand[] = [];
  const seen = new Set<string>();
  const accessMethods = new Set<"direct" | "firecrawl_proxy">();
  let nextUrl: string | null = API_URL;
  let pagesFetched = 0;
  let totalCount: number | null = null;
  let rawItemsFetched = 0;

  while (nextUrl && pagesFetched < MAX_PAGES) {
    const { page, method } = await fetchApiPage(nextUrl, fetchImpl);
    accessMethods.add(method);
    const results = Array.isArray(page.results) ? page.results : [];
    if (pagesFetched === 0 && results.length === 0) {
      throw new Error("Expo Postos API returned no brands");
    }

    if (typeof page.count === "number") totalCount = page.count;
    rawItemsFetched += results.length;
    for (const item of results) {
      const name = typeof item.nome === "string" ? item.nome.trim() : "";
      if (!name) continue;
      const externalId = typeof item.id === "number" || typeof item.id === "string" ? String(item.id) : "";
      const key = externalId ? `id:${externalId}` : `name:${name.toLocaleLowerCase("pt-BR")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      brands.push({
        id: externalId || key,
        name,
        description: typeof item.descricao === "string" && item.descricao.trim() ? item.descricao.trim() : null,
        website: typeof item.link === "string" && item.link.trim() ? item.link.trim() : null,
        logo_url: typeof item.arquivo === "string" && item.arquivo.trim() ? item.arquivo.trim() : null,
      });
    }

    pagesFetched += 1;
    nextUrl = typeof page.next === "string" && page.next ? page.next : null;
  }

  if (nextUrl) throw new Error(`Expo Postos pagination exceeded ${MAX_PAGES} pages`);
  if (totalCount === null) throw new Error("Expo Postos API did not provide a total count");
  if (rawItemsFetched !== totalCount || brands.length !== totalCount) {
    throw new Error(`Expo Postos incomplete pagination: raw=${rawItemsFetched}, unique=${brands.length}, expected=${totalCount}`);
  }

  const accessMethod = accessMethods.size > 1
    ? "mixed"
    : accessMethods.has("firecrawl_proxy") ? "firecrawl_proxy" : "direct";
  return { brands, total_count: totalCount, pages_fetched: pagesFetched, access_method: accessMethod };
}

export async function tryExpoPostosFromUrl(url: string): Promise<{
  detection: boolean;
  result: ExpoPostosFetchResult | null;
  error?: string;
}> {
  if (!detectExpoPostos(url)) return { detection: false, result: null };
  try {
    return { detection: true, result: await fetchExpoPostosBrands() };
  } catch (error) {
    return { detection: true, result: null, error: String(error) };
  }
}