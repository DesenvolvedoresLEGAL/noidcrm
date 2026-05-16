// Provider: MundoGEO / DroneShow / SpaceBR / Expo eVTOL
// A página mundogeo.com/feiras2026/ (e variantes anuais) lista expositores
// como HTML estático puro, no padrão WordPress:
//   <BOOTH> – <b>NAME</b> – <a href="URL">site</a><br>
// Onde BOOTH é dígito(s) opcionalmente seguido de letra (ex.: 203A, 210B).
// O markdown/Firecrawl tende a tratar "site" como conteúdo solto e a perder a
// estrutura — extrair via regex resolve 100% em uma única requisição.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

// Booth – <b>NAME</b> [– <a ...>site</a>]
// O HTML real entrega o en-dash como entidade &#8211; (ou &ndash;), não como
// caractere literal. Normalizamos antes de aplicar a regex.
// Capturas: 1=booth, 2=name, 3=url (opcional)
const ROW_REGEX =
  /(\d{1,4}[A-Z]?)\s*[–-]\s*<b>\s*([^<]{2,200}?)\s*<\/b>(?:[^<]*<a[^>]*href=["']([^"']+)["'][^>]*>\s*site\s*<\/a>)?/gi;

function decodeDashes(html: string): string {
  return html
    .replace(/&#8211;/g, "–")
    .replace(/&#8212;/g, "—")
    .replace(/&ndash;/gi, "–")
    .replace(/&mdash;/gi, "—");
}

const MUNDOGEO_HOSTS = [
  "mundogeo.com",
  "droneshowla.com",
  "spacebrshow.com",
  "expoevtol.com",
  "mundogeoconnect.com",
];

export interface MundoGeoDetection {
  origin: "mundogeo";
  host: string;
}

export interface MundoGeoExhibitor {
  name: string;
  booth: string | null;
  website: string | null;
}

export interface MundoGeoFetchResult {
  exhibitors: MundoGeoExhibitor[];
  total_count: number;
  source_url: string;
}

function normalize(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function detectMundoGeo(html: string, pageUrl: string): MundoGeoDetection | null {
  if (!html) return null;
  let host = "";
  try {
    host = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return null;
  }
  const hostMatch = MUNDOGEO_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  if (!hostMatch) return null;

  // Confirmação estrutural: pelo menos 5 linhas no padrão "N – <b>X</b>"
  const normalized = decodeDashes(html);
  const probe = normalized.match(/\d{1,4}[A-Z]?\s*[–-]\s*<b>[^<]+<\/b>/gi);
  if (!probe || probe.length < 5) return null;

  return { origin: "mundogeo", host };
}

export function extractMundoGeoExhibitors(html: string): MundoGeoExhibitor[] {
  const seen = new Set<string>();
  const out: MundoGeoExhibitor[] = [];
  const normalized = decodeDashes(html);
  ROW_REGEX.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ROW_REGEX.exec(html)) !== null) {
    const booth = normalize(m[1] || "") || null;
    const name = normalize(m[2] || "");
    const website = m[3]?.trim() || null;
    if (!name || name.length < 2 || name.length > 250) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, booth, website });
  }
  return out;
}

export async function fetchMundoGeoExhibitors(
  detection: MundoGeoDetection,
  pageUrl: string,
  html?: string,
): Promise<MundoGeoFetchResult> {
  let pageHtml = html ?? "";
  if (!pageHtml) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const resp = await fetch(pageUrl, {
        headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`MundoGEO HTTP ${resp.status}`);
      pageHtml = await resp.text();
    } finally {
      clearTimeout(timer);
    }
  }
  const exhibitors = extractMundoGeoExhibitors(pageHtml);
  return {
    exhibitors,
    total_count: exhibitors.length,
    source_url: pageUrl,
  };
}

export async function tryMundoGeoFromUrl(pageUrl: string): Promise<{
  detection: MundoGeoDetection | null;
  result: MundoGeoFetchResult | null;
  error?: string;
}> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
    });
    const html = resp.ok ? await resp.text() : "";
    const detection = detectMundoGeo(html, pageUrl);
    if (!detection) return { detection: null, result: null };
    const result = await fetchMundoGeoExhibitors(detection, pageUrl, html);
    return { detection, result };
  } catch (err) {
    return { detection: null, result: null, error: String(err) };
  }
}
