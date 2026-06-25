// Logo-Wall Provider — extracts sponsors/partners from pages that render a grid of
// clickable logos (each <a href="external"><img src="logo" alt="Name" /></a>).
// Typical pages: event sponsor pages (expertxp.com.br/patrocinadores), partner
// pages, "nossos clientes" walls. The page HTML has no company name as text;
// the AI/markdown extractor falls back to section titles (DIAMANTE, OURO, PRATA…)
// and produces garbage. This provider extracts directly from the DOM.

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

// Names that are clearly sponsorship tiers or structural section labels, never
// real companies. Anything that matches is rejected as a candidate name.
const TIER_BLACKLIST = new Set([
  "diamante", "ouro", "prata", "bronze", "cobre", "platina", "master",
  "premium", "exclusivo", "segmento exclusivo", "cota segmento exclusivo",
  "patrocinador", "patrocinadores", "sponsor", "sponsors", "apoiador",
  "apoiadores", "parceiro", "parceiros", "partner", "partners", "logo",
  "logos", "todos", "novo na base", "3 dias", "2 dias", "1 dia",
  "segmento financeiro", "diamond", "gold", "silver", "bronze",
]);

const GENERIC_HOSTS = new Set([
  "facebook.com", "www.facebook.com", "instagram.com", "www.instagram.com",
  "twitter.com", "x.com", "www.x.com", "linkedin.com", "www.linkedin.com",
  "youtube.com", "www.youtube.com", "wa.me", "api.whatsapp.com",
  "google.com", "maps.google.com", "goo.gl", "t.me", "tiktok.com",
]);

export interface LogoWallSponsor {
  name: string;
  website: string;            // external link from <a href>
  logo_url: string | null;    // <img src>
  tier?: string | null;       // closest preceding h1/h2/h3 (DIAMANTE, OURO…)
  source_url: string;         // page where the logo was found
}

export interface LogoWallDetection {
  density: number;            // number of external-link logo pairs found
  page_host: string;
}

export interface LogoWallFetchResult {
  detection: LogoWallDetection;
  sponsors: LogoWallSponsor[];
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&aacute;/gi, "á").replace(/&Aacute;/g, "Á")
    .replace(/&eacute;/gi, "é").replace(/&Eacute;/g, "É")
    .replace(/&iacute;/gi, "í").replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú").replace(/&ccedil;/gi, "ç")
    .replace(/&atilde;/gi, "ã").replace(/&otilde;/gi, "õ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function stripWww(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

function isBlacklistedName(raw: string): boolean {
  const k = raw.trim().toLowerCase();
  if (!k) return true;
  if (TIER_BLACKLIST.has(k)) return true;
  // pure tier word + extra punctuation
  for (const tier of TIER_BLACKLIST) {
    if (k === tier || k === tier + "s" || k === tier + ":") return true;
  }
  return false;
}

function nameFromDomain(host: string): string {
  const clean = stripWww(host).split(".")[0] || host;
  if (!clean) return host;
  return clean
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function pickAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? decodeEntities(m[1]).trim() : null;
}

/**
 * Parse an HTML document into a list of <a href><img></a> pairs where the link
 * targets an external domain. Captures the closest preceding heading text as
 * tier metadata.
 */
function extractAnchorImagePairs(html: string, pageHost: string): LogoWallSponsor[] {
  const out: LogoWallSponsor[] = [];
  const seen = new Set<string>();
  let currentTier: string | null = null;

  // Walk a single regex across the document: headings update currentTier; <a>…</a>
  // blocks containing an <img> become candidates.
  const tokenRe = /(<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>)|(<a\b[^>]*>[\s\S]*?<\/a>)/gi;

  for (const m of html.matchAll(tokenRe)) {
    if (m[1]) {
      // heading
      const text = decodeEntities(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
      if (text && text.length <= 80) currentTier = text;
      continue;
    }
    const anchor = m[3];
    if (!anchor || !/<img\b/i.test(anchor)) continue;

    const openTagMatch = anchor.match(/^<a\b[^>]*>/i);
    if (!openTagMatch) continue;
    const aTag = openTagMatch[0];
    const href = pickAttr(aTag, "href");
    if (!href) continue;

    let absHref: URL;
    try {
      absHref = new URL(href, `https://${pageHost}/`);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(absHref.protocol)) continue;
    const linkHost = stripWww(absHref.hostname);
    if (!linkHost || linkHost === stripWww(pageHost)) continue;
    if (GENERIC_HOSTS.has(linkHost) || GENERIC_HOSTS.has(absHref.hostname.toLowerCase())) continue;

    const imgMatch = anchor.match(/<img\b[^>]*>/i);
    if (!imgMatch) continue;
    const imgTag = imgMatch[0];
    const src = pickAttr(imgTag, "src") || pickAttr(imgTag, "data-src") || pickAttr(imgTag, "data-lazy-src");
    const alt = pickAttr(imgTag, "alt");
    const title = pickAttr(aTag, "title");

    // Candidate name resolution
    let name: string | null = null;
    const candidates = [alt, title].filter((x): x is string => !!x && x.trim().length >= 2);
    for (const c of candidates) {
      const clean = c.replace(/\s+/g, " ").trim();
      if (clean.length < 2) continue;
      if (isBlacklistedName(clean)) continue;
      // skip generic alt like "logo" / "icon" / "image"
      if (/^(logo|icon|image|imagem|foto|picture)$/i.test(clean)) continue;
      name = clean;
      break;
    }
    if (!name) name = nameFromDomain(absHref.hostname);
    if (isBlacklistedName(name)) continue;

    const website = `${absHref.protocol}//${absHref.hostname}${absHref.pathname === "/" ? "" : absHref.pathname}`;
    const dedupeKey = linkHost;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    let logoUrl: string | null = null;
    if (src) {
      try {
        logoUrl = new URL(src, `https://${pageHost}/`).toString();
      } catch { logoUrl = null; }
    }

    out.push({
      name,
      website,
      logo_url: logoUrl,
      tier: currentTier,
      source_url: `https://${pageHost}/`,
    });
  }

  return out;
}

export function detectLogoWall(eventUrl: string, html: string): LogoWallFetchResult | null {
  let pageHost = "";
  try { pageHost = new URL(eventUrl).hostname; } catch { return null; }
  if (!pageHost) return null;

  const sponsors = extractAnchorImagePairs(html, pageHost);
  if (sponsors.length < 6) return null;

  return {
    detection: { density: sponsors.length, page_host: pageHost },
    sponsors,
  };
}

export async function tryLogoWallFromUrl(eventUrl: string): Promise<{
  result: LogoWallFetchResult | null;
  error?: string;
}> {
  let html = "";
  try {
    const resp = await fetch(eventUrl, {
      headers: { "User-Agent": BROWSER_UA, "Accept": "text/html,*/*" },
      redirect: "follow",
    });
    if (!resp.ok) return { result: null, error: `host fetch HTTP ${resp.status}` };
    html = await resp.text();
  } catch (e) {
    return { result: null, error: `host fetch failed: ${(e as Error).message}` };
  }

  const detected = detectLogoWall(eventUrl, html);
  if (!detected) return { result: null };
  return { result: detected };
}
