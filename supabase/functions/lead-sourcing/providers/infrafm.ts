// Provider: InfraFM / IEG Brasil
// As páginas de eventos infrafm.com.br (Expo InfraFM, etc.) servem a listagem
// de expositores via uma única chamada fetch() a um JSON estático hospedado em
// images.infrafm.com.br/arquivos/exhibitors_<hash>.json. O HTML inicial só tem
// um <div id="exhibitors_logotypes"></div> vazio — qualquer scrape de
// markdown captura lixo (menu, banners, CTA). Fetch direto ao JSON resolve 100%.
//
// Schema do JSON (array):
//   { alt: "121 Smart Shop", description: "…", logo: "https://…webp", link: "https://…", width: "130px" }

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

const JSON_URL_REGEX =
  /https?:\/\/images\.infrafm\.com\.br\/arquivos\/exhibitors_[a-f0-9]+\.json/i;

export interface InfraFmDetection {
  origin: "infrafm";
  json_url: string;
}

export interface InfraFmExhibitor {
  name: string;
  description: string | null;
  logo: string | null;
  profile_url: string | null;
}

export interface InfraFmFetchResult {
  exhibitors: InfraFmExhibitor[];
  total_count: number;
  source_url: string;
  json_url: string;
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

function isHttpUrl(v: unknown): v is string {
  if (typeof v !== "string") return false;
  return /^https?:\/\//i.test(v.trim());
}

export function detectInfraFm(html: string, pageUrl: string): InfraFmDetection | null {
  if (!html) return null;

  // Sinal forte: container conhecido + URL JSON inline no script
  const hasContainer = /id=["']exhibitors_logotypes["']/i.test(html);
  const urlMatch = html.match(JSON_URL_REGEX);

  if (urlMatch) {
    return { origin: "infrafm", json_url: urlMatch[0] };
  }

  // Fallback: se for domínio infrafm.com.br e tiver o container, ainda assim
  // não conseguimos descobrir o hash sem o script — devolve null para evitar
  // chute. (O hash muda por evento.)
  if (hasContainer) {
    try {
      const host = new URL(pageUrl).hostname.toLowerCase();
      if (host.endsWith("infrafm.com.br")) {
        // sinaliza presença mas sem URL — handler decide fallback
        return null;
      }
    } catch {
      /* ignore */
    }
  }

  return null;
}

export async function fetchInfraFmExhibitors(
  detection: InfraFmDetection,
  pageUrl: string,
): Promise<InfraFmFetchResult> {
  const url = `${detection.json_url}${detection.json_url.includes("?") ? "&" : "?"}t=${Date.now()}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  let resp: Response;
  try {
    resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Referer": pageUrl,
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!resp.ok) {
    throw new Error(`InfraFM JSON retornou HTTP ${resp.status}`);
  }

  // O arquivo pode vir em UTF-8 ou windows-1252 (o JS do site faz fallback).
  const buf = new Uint8Array(await resp.arrayBuffer());
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(buf);
  } catch {
    text = new TextDecoder("windows-1252").decode(buf);
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (err) {
    throw new Error(`InfraFM JSON parse falhou: ${String(err)}`);
  }

  if (!Array.isArray(data)) {
    throw new Error("InfraFM JSON retornou payload inesperado (não-array)");
  }

  const exhibitors: InfraFmExhibitor[] = [];
  const seen = new Set<string>();

  for (const row of data as Record<string, unknown>[]) {
    if (!row || typeof row !== "object") continue;
    const rawName = typeof row.alt === "string" ? row.alt : "";
    const name = normalizeWhitespace(rawName);
    if (!name || name.length < 2 || name.length > 250) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const rawDesc = typeof row.description === "string" ? row.description : "";
    const description = normalizeWhitespace(rawDesc) || null;
    const logo = isHttpUrl(row.logo) ? (row.logo as string).trim() : null;
    const link = isHttpUrl(row.link) ? (row.link as string).trim() : null;

    exhibitors.push({
      name,
      description,
      logo,
      profile_url: link,
    });
  }

  return {
    exhibitors,
    total_count: exhibitors.length,
    source_url: pageUrl,
    json_url: detection.json_url,
  };
}

export async function tryInfraFmFromUrl(pageUrl: string): Promise<{
  detection: InfraFmDetection | null;
  result: InfraFmFetchResult | null;
  error?: string;
}> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
    });
    const html = resp.ok ? await resp.text() : "";
    const detection = detectInfraFm(html, pageUrl);
    if (!detection) return { detection: null, result: null };

    const result = await fetchInfraFmExhibitors(detection, pageUrl);
    return { detection, result };
  } catch (err) {
    return { detection: null, result: null, error: String(err) };
  }
}
