// JetEngine listing provider (Elementor + JetEngine "Listing Grid").
// Many WordPress event sites (e.g. Expolazer) render their exhibitor list
// not as a <table> but as a `jet-listing-grid` of Elementor items. Each
// item contains one or more `<h2 class="elementor-heading-title">` widgets
// (the first is the exhibitor name) plus an optional `<a class="elementor-button …" href>`
// pointing to the exhibitor's website ("SITE" button).
//
// logo-wall needs <img>/<a> density to fire, exhibitor-table needs a real
// <table>, and Firecrawl/AI fallback frequently collapses the whole page
// onto a single banner. This deterministic provider closes that gap.

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

const NOISE_RE =
  /^(empresa|expositor(?:es)?|exhibitor|company|stand|booth|setor|categoria|cidade|estado|país|pais|country|website|site|tipo|cota|tier|nome divulga[cç][aã]o|marca|produto|localiza[cç][aã]o)$/i;

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/&#x([0-9a-f]+);/gi, (_, c) => String.fromCharCode(parseInt(c, 16)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function cleanName(raw: string): string | null {
  const n = raw.replace(/\s+/g, " ").trim();
  if (!n) return null;
  if (n.length < 2 || n.length > 200) return null;
  if (NOISE_RE.test(n)) return null;
  if (/^[\d\W_]+$/.test(n)) return null;
  return n;
}

function cleanBooth(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const n = raw.replace(/\s+/g, " ").trim();
  if (!n || n.length > 32) return null;
  // Booths look like "6/7/B", "1-A", "RUA 5", "B-6". Avoid full sentences.
  if (n.split(/\s+/).length > 5) return null;
  return n;
}

function normalizeWebsite(href: string, eventUrl: string): string | null {
  if (!href || !/^https?:\/\//i.test(href)) return null;
  let u: URL;
  try {
    u = new URL(href);
  } catch {
    return null;
  }
  // Reject hosts that contain spaces, accents or %-encoded text (broken hrefs).
  if (!/^[a-z0-9.-]+$/i.test(u.hostname)) return null;
  try {
    const eventHost = new URL(eventUrl).hostname.replace(/^www\./, "");
    if (u.hostname.replace(/^www\./, "").endsWith(eventHost)) return null;
  } catch { /* ignore */ }
  return `${u.protocol}//${u.hostname}`;
}

export interface JetEngineListingSponsor {
  name: string;
  booth: string | null;
  website: string | null;
  category: string | null;
  source_url: string;
}

export interface JetEngineListingDetection {
  grids_found: number;
  items_parsed: number;
  items_kept: number;
}

export interface JetEngineListingFetchResult {
  result:
    | { sponsors: JetEngineListingSponsor[]; detection: JetEngineListingDetection }
    | null;
  error: string | null;
}

export async function tryJetEngineListingFromUrl(
  pageUrl: string,
): Promise<JetEngineListingFetchResult> {
  let html: string;
  try {
    const res = await fetch(pageUrl, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!res.ok) return { result: null, error: `http_${res.status}` };
    html = await res.text();
  } catch (e) {
    return { result: null, error: `fetch_failed: ${String(e)}` };
  }

  // Fast pre-check: must contain jet-listing-grid markers.
  if (!/jet-listing-grid__item/i.test(html) || !/elementor-heading-title/i.test(html)) {
    return { result: null, error: "no_jet_listing" };
  }

  // Find every jet-listing-grid__item card across the page, then walk from
  // one item-start marker to the next. We deliberately ignore the wrapping
  // grid id (the same page can mix several `jet-listing-grid--<id>` themes
  // and Elementor often nests them).
  const itemStartRe =
    /<div class="jet-listing-grid__item\b[^"]*"[^>]*>/gi;

  const starts: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = itemStartRe.exec(html)) !== null) {
    starts.push(m.index + m[0].length);
  }
  if (starts.length === 0) return { result: null, error: "no_jet_listing_items" };

  const sponsors: JetEngineListingSponsor[] = [];
  const seen = new Set<string>();
  let parsed = 0;

  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const end = i + 1 < starts.length ? html.indexOf("<div class=\"jet-listing-grid__item", start) : html.length;
    const body = html.slice(start, end < 0 ? html.length : end);

    const h2s = [...body.matchAll(
      /<h2 class="elementor-heading-title[^"]*">([\s\S]*?)<\/h2>/gi,
    )].map((x) => stripTags(x[1]));

    if (h2s.length === 0) continue;
    parsed++;

    const nameRaw = h2s[0];
    const name = cleanName(nameRaw);
    if (!name) continue;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    // Expolazer template: [NOME, MARCA, PRODUTO, LOCALIZAÇÃO].
    const category = h2s[2] && !NOISE_RE.test(h2s[2]) ? h2s[2] : null;
    const booth = cleanBooth(h2s[3] ?? null);

    const hrefMatch = body.match(
      /<a [^>]*class="elementor-button[^"]*"[^>]*href="([^"]+)"/i,
    ) ?? body.match(/<a [^>]*href="(https?:\/\/[^"]+)"/i);
    const website = hrefMatch ? normalizeWebsite(decodeEntities(hrefMatch[1]), pageUrl) : null;

    sponsors.push({
      name,
      booth,
      website,
      category,
      source_url: pageUrl,
    });
  }


  if (sponsors.length < 6) {
    return { result: null, error: "no_jet_listing_items" };
  }

  return {
    result: {
      sponsors,
      detection: {
        grids_found: starts.length,
        items_parsed: parsed,
        items_kept: sponsors.length,
      },
    },
    error: null,
  };
}
