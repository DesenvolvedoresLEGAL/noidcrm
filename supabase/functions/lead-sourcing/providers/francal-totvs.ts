// Provider: Francal / TOTVS RM Cloud
// Sites do grupo Francal (Naturaltech, Fispal Food, Fispal Café, Bio Brazil Fair,
// entre outros) servem a listagem de expositores via uma única chamada AJAX a um
// endpoint TOTVS RM exposto publicamente. O HTML inicial vem vazio — só a tabela
// é populada client-side por jQuery a partir do JSON do TOTVS.
//
// Estratégia:
//   1. Buscar a página alvo e procurar a URL TOTVS + Authorization no script inline.
//   2. Fallback: whitelist de domínios Francal conhecidos com CODIGO_FEIRA mapeado.
//   3. Fazer uma única chamada GET ao endpoint TOTVS → array completo de expositores.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const TOTVS_HOST = "francalfeiras152909.rm.cloudtotvs.com.br";
const TOTVS_BASE = `https://${TOTVS_HOST}:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/FRA_000000/1/T`;

// Header padrão extraído do JS público das páginas Francal (integracao:Fr@@2022).
// Usado APENAS como fallback se o HTML alvo não revelar o header — o ideal é
// extrair do próprio HTML em cada execução pra sobreviver a rotações.
const DEFAULT_AUTH_HEADER = "Basic aW50ZWdyYWNhbzpGckBAMjAyMg==";

// Fallback domain → CODIGO_FEIRA quando não dá pra extrair do HTML.
const FRANCAL_FEIRA_BY_DOMAIN: Record<string, string> = {
  "naturaltech.com.br": "1.06.2026.01",
  "fispalfood.com.br": "1.01.2026.01",
  "fispalcafe.com.br": "1.05.2026.01",
  "biobrazilfair.com.br": "1.07.2026.01",
};

export interface FrancalDetection {
  origin: "francal-totvs";
  codigo_feira: string;
  auth_header: string;
  source: "html" | "domain-fallback";
}

export interface FrancalExhibitor {
  name: string;            // MARCA DIVULGACAO (fallback NOME DIVULGACAO)
  publication_name: string | null; // NOME DIVULGACAO
  product: string | null;
  booth: string | null;
  website: string | null;
}

export interface FrancalFetchResult {
  exhibitors: FrancalExhibitor[];
  total_count: number;
  source_url: string;
  codigo_feira: string;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const v = String(raw).trim();
  if (!v || v === "#" || /^javascript:/i.test(v)) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[a-z0-9.-]+\.[a-z]{2,}/i.test(v)) return `https://${v.replace(/^\/+/, "")}`;
  return null;
}

function pickField(row: Record<string, unknown>, ...keys: string[]): string | null {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") {
      return String(v).trim();
    }
  }
  // Tenta case-insensitive (TOTVS às vezes muda capitalização)
  const map = new Map(Object.keys(row).map((k) => [k.toUpperCase().trim(), k]));
  for (const k of keys) {
    const real = map.get(k.toUpperCase().trim());
    if (real) {
      const v = row[real];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return null;
}

export function detectFrancalTotvs(html: string, pageUrl: string): FrancalDetection | null {
  if (!html) return null;

  // 1) Detecção via HTML: procura o host TOTVS + CODIGO_FEIRA
  if (html.includes(TOTVS_HOST) || /CODIGO_FEIRA\s*=\s*[0-9.]+/i.test(html)) {
    const codigoMatch = html.match(/CODIGO_FEIRA\s*=\s*([0-9.]+)/i);
    const authMatch = html.match(/["']Authorization["']\s*:\s*["'](Basic\s+[A-Za-z0-9+/=]+)["']/i);
    if (codigoMatch) {
      return {
        origin: "francal-totvs",
        codigo_feira: decodeEntities(codigoMatch[1]).trim(),
        auth_header: authMatch ? decodeEntities(authMatch[1]).trim() : DEFAULT_AUTH_HEADER,
        source: "html",
      };
    }
  }

  // 2) Fallback por domínio conhecido
  try {
    const host = new URL(pageUrl).hostname.toLowerCase().replace(/^www\./, "");
    const codigo = FRANCAL_FEIRA_BY_DOMAIN[host];
    if (codigo) {
      return {
        origin: "francal-totvs",
        codigo_feira: codigo,
        auth_header: DEFAULT_AUTH_HEADER,
        source: "domain-fallback",
      };
    }
  } catch {
    /* ignore */
  }

  return null;
}

export async function fetchFrancalExhibitors(
  detection: FrancalDetection,
  pageUrl: string,
): Promise<FrancalFetchResult> {
  const apiUrl = `${TOTVS_BASE}?parameters=CODIGO_FEIRA=${encodeURIComponent(detection.codigo_feira)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let resp: Response;
  try {
    resp = await fetch(apiUrl, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Authorization": detection.auth_header,
        "Origin": (() => { try { return new URL(pageUrl).origin; } catch { return "https://naturaltech.com.br"; } })(),
        "Referer": pageUrl,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(`Francal/TOTVS API retornou HTTP ${resp.status}`);
  }

  const data = await resp.json();
  if (!Array.isArray(data)) {
    throw new Error("Francal/TOTVS API retornou payload inesperado (não-array)");
  }

  // Remove linha de cabeçalho se o primeiro item não tiver as chaves esperadas
  // (o script público faz a mesma checagem).
  let rows = data as Record<string, unknown>[];
  if (rows.length > 0) {
    const first = rows[0];
    const hasExpectedKey = Object.keys(first).some((k) =>
      /NOME\s*DIVULGACAO/i.test(k) || /MARCA\s*DIVULGACAO/i.test(k),
    );
    if (!hasExpectedKey) rows = rows.slice(1);
  }

  const exhibitors: FrancalExhibitor[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const marca = pickField(row, "MARCA DIVULGACAO");
    const nome = pickField(row, "NOME DIVULGACAO");
    const produto = pickField(row, "PRODUTO DIVULGACAO");
    const estande = pickField(row, "LOCALIZAÇÃO DO ESTANDE", "LOCALIZACAO DO ESTANDE");
    const site = pickField(row, "SITE DIVULGACAO");

    const name = (marca || nome || "").replace(/\s+/g, " ").trim();
    if (!name || name.length < 2 || name.length > 250) continue;

    const dedupKey = `${name.toLowerCase()}|${(estande || "").toLowerCase()}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);

    exhibitors.push({
      name,
      publication_name: nome,
      product: produto,
      booth: estande ? estande.toUpperCase() : null,
      website: normalizeWebsite(site),
    });
  }

  return {
    exhibitors,
    total_count: exhibitors.length,
    source_url: pageUrl,
    codigo_feira: detection.codigo_feira,
  };
}

export async function tryFrancalTotvsFromUrl(pageUrl: string): Promise<{
  detection: FrancalDetection | null;
  result: FrancalFetchResult | null;
  error?: string;
}> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
    });
    const html = resp.ok ? await resp.text() : "";
    const detection = detectFrancalTotvs(html, pageUrl);
    if (!detection) return { detection: null, result: null };

    const result = await fetchFrancalExhibitors(detection, pageUrl);
    return { detection, result };
  } catch (err) {
    return { detection: null, result: null, error: String(err) };
  }
}
