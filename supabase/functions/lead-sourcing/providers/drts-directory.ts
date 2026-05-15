// Provider: WordPress "Directories Pro" / DRTS plugin
// Used by exposec.tmp.br/directory-2026/ and similar event directories built
// on the DRTS plugin (markup with `drts-entity-*` classes).
//
// The full listing (often hundreds of exhibitors) is rendered server-side in
// a single HTML page. We extract everything in one fetch — no detail page
// crawling, no Firecrawl, no SPA hydration required.

export interface DrtsDetection {
  origin: string;
  signature: "drts-entity";
}

export interface DrtsExhibitor {
  name: string;
  rua: string | null;
  estande: string | null;
  source_url: string | null;
}

export interface DrtsFetchResult {
  exhibitors: DrtsExhibitor[];
  total_count: number;
  source_url: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36";

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

export function detectDrts(html: string): DrtsDetection | null {
  if (!html) return null;
  if (/drts-entity-permalink|drts-display-element-entity_field|directory-listing-title/i.test(html)) {
    return { origin: "drts", signature: "drts-entity" };
  }
  return null;
}

export function extractDrtsExhibitors(html: string, pageUrl: string): DrtsExhibitor[] {
  const exhibitors: DrtsExhibitor[] = [];
  const seen = new Set<string>();

  // Each card has a title anchor with class `drts-entity-permalink`.
  // Fields (Rua, Estande, ...) live as siblings inside the same card container,
  // before the next card title. We split on the title anchor and parse each
  // chunk independently — robust to plugin theme tweaks.
  const titleRe =
    /<a[^>]*class="[^"]*drts-entity-permalink[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;

  const matches: { href: string; name: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = titleRe.exec(html)) !== null) {
    matches.push({ href: m[1], name: decodeEntities(m[2]).trim(), index: m.index });
  }

  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    const next = matches[i + 1];
    const chunk = html.slice(cur.index, next ? next.index : Math.min(html.length, cur.index + 4000));

    const ruaMatch = chunk.match(
      /entity_field_field_rua[\s\S]{0,400}?drts-entity-field-value">([^<]+)</i,
    );
    const estandeMatch = chunk.match(
      /entity_field_field_estande[\s\S]{0,400}?drts-entity-field-value">([^<]+)</i,
    );

    const name = cur.name.replace(/\s+/g, " ").trim();
    if (!name || name.length < 2 || name.length > 200) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    let sourceUrl: string | null = null;
    try {
      sourceUrl = new URL(cur.href, pageUrl).toString();
    } catch {
      sourceUrl = cur.href || null;
    }

    exhibitors.push({
      name,
      rua: ruaMatch ? decodeEntities(ruaMatch[1]).trim() : null,
      estande: estandeMatch ? decodeEntities(estandeMatch[1]).trim().toUpperCase() : null,
      source_url: sourceUrl,
    });
  }

  return exhibitors;
}

export async function fetchDrtsExhibitors(pageUrl: string): Promise<DrtsFetchResult> {
  const resp = await fetch(pageUrl, {
    headers: {
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  if (!resp.ok) {
    throw new Error(`DRTS directory fetch failed (${resp.status}) for ${pageUrl}`);
  }
  const html = await resp.text();
  const exhibitors = extractDrtsExhibitors(html, pageUrl);
  return { exhibitors, total_count: exhibitors.length, source_url: pageUrl };
}

export async function tryDrtsFromUrl(pageUrl: string): Promise<{
  detection: DrtsDetection | null;
  result: DrtsFetchResult | null;
  error?: string;
}> {
  try {
    const resp = await fetch(pageUrl, {
      headers: { "User-Agent": UA, Accept: "text/html,*/*;q=0.8" },
    });
    if (!resp.ok) {
      return { detection: null, result: null, error: `HTTP ${resp.status}` };
    }
    const html = await resp.text();
    const detection = detectDrts(html);
    if (!detection) return { detection: null, result: null };
    const exhibitors = extractDrtsExhibitors(html, pageUrl);
    return {
      detection,
      result: { exhibitors, total_count: exhibitors.length, source_url: pageUrl },
    };
  } catch (err) {
    return { detection: null, result: null, error: String(err) };
  }
}
