const API_URL = "https://admin.expopostos.com.br/api/marca_confirmada/?page_size=50&ordering=nome";
const MAX_PAGES = 25;

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
}

interface ApiPage {
  count?: number;
  next?: string | null;
  results?: Array<Record<string, unknown>>;
}

export function detectExpoPostos(url: string): boolean {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    return host === "expopostos.com.br" || host.endsWith(".expopostos.com.br");
  } catch {
    return false;
  }
}

export async function fetchExpoPostosBrands(): Promise<ExpoPostosFetchResult> {
  const brands: ExpoPostosBrand[] = [];
  const seen = new Set<string>();
  let nextUrl: string | null = API_URL;
  let pagesFetched = 0;
  let totalCount: number | null = null;

  while (nextUrl && pagesFetched < MAX_PAGES) {
    const response = await fetch(nextUrl, {
      headers: { "Accept": "application/json", "User-Agent": "Mozilla/5.0" },
    });
    if (!response.ok) throw new Error(`Expo Postos API HTTP ${response.status}`);

    const page = await response.json() as ApiPage;
    const results = Array.isArray(page.results) ? page.results : [];
    if (pagesFetched === 0 && results.length === 0) {
      throw new Error("Expo Postos API returned no brands");
    }

    if (typeof page.count === "number") totalCount = page.count;
    for (const item of results) {
      const name = typeof item.nome === "string" ? item.nome.trim() : "";
      if (!name) continue;
      const key = name.toLocaleLowerCase("pt-BR");
      if (seen.has(key)) continue;
      seen.add(key);
      brands.push({
        id: typeof item.id === "number" || typeof item.id === "string" ? item.id : key,
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
  if (totalCount !== null && brands.length < totalCount * 0.9) {
    throw new Error(`Expo Postos incomplete pagination: ${brands.length}/${totalCount}`);
  }

  return { brands, total_count: totalCount, pages_fetched: pagesFetched };
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