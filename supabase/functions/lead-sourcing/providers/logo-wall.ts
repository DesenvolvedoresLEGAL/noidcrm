// Logo-Wall Provider — extracts sponsors/partners from pages that render a grid of
// clickable logos (each <a href="external"><img src="logo" alt="Name" /></a>).
// Typical pages: event sponsor pages (expertxp.com.br/patrocinadores), partner
// pages, "nossos clientes" walls. The page HTML has no company name as text;
// the AI/markdown extractor falls back to section titles (DIAMANTE, OURO, PRATA…)
// and produces garbage. This provider extracts directly from the DOM.

const BROWSER_UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0 Safari/537.36";
const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent": BROWSER_UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Ch-Ua": '"Chromium";v="147", "Not_A Brand";v="24"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Linux"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
};


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
  website: string | null;     // external link from <a href>, null when extracted by filename
  logo_url: string | null;    // <img src>
  tier?: string | null;       // closest preceding h1/h2/h3 (DIAMANTE, OURO…)
  source_url: string;         // page where the logo was found
  extraction_mode?: "anchor_image" | "filename_grid";
}

export interface LogoWallDetection {
  density: number;            // number of external-link logo pairs found
  page_host: string;
  mode: "anchor_image" | "filename_grid";
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
    if (!linkHost) continue;
    if (GENERIC_HOSTS.has(linkHost) || GENERIC_HOSTS.has(absHref.hostname.toLowerCase())) continue;
    // Same-host anchors are allowed (e.g. Expert XP routes sponsors to /produtos/...);
    // we still dedupe per logo filename below so multiple sponsors on the same host
    // are kept as separate entries.
    const sameHost = linkHost === stripWww(pageHost);

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
    // For same-host anchors prefer the filename; the domain name would collapse all
    // sponsors that link back to e.g. xpi.com.br into a single "Xpi" entry.
    if (!name && src) name = nameFromFilename(src);
    if (!name && !sameHost) name = nameFromDomain(absHref.hostname);
    if (!name) continue;
    if (isBlacklistedName(name)) continue;

    const website = sameHost
      ? null
      : `${absHref.protocol}//${absHref.hostname}${absHref.pathname === "/" ? "" : absHref.pathname}`;
    // Dedupe key combines normalized name with the image filename so a sponsor
    // with no link host (or a shared host) is still kept once per logo asset.
    let imgBase = "";
    if (src) {
      try { imgBase = new URL(src, `https://${pageHost}/`).pathname.split("/").pop() || ""; } catch { imgBase = ""; }
    }
    const dedupeKey = `${name.toLowerCase()}::${imgBase || (sameHost ? absHref.pathname : linkHost)}`;
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

// URL paths that signal a sponsor/exhibitor wall — used to gate the filename
// fallback (which is heuristic and could otherwise misfire on random galleries).
const SPONSOR_PATH_RE =
  /\/(patroc[a-z]*|sponsor[s]?|exhibitor[s]?|expositor[a-z]*|expositores|partner[s]?|parceir[oa]s?|apoiadores?|nossos[-_]?clientes|clients)\b/i;

// Filename tokens that should never become a company name on their own.
const FILENAME_NOISE_RE =
  /^(logo|logotipo|brand|brandmark|wordmark|symbol|icon|ic|imagem|image|img|banner|hero|placeholder|default|spacer|pixel|blank|transparent|sprite|untitled|prancheta|asset[s]?\d*)$/i;

/** Convert a filename like `logo_vinci_compass-2x.jpg` → "Vinci Compass". */
function nameFromFilename(rawPath: string): string | null {
  try {
    const u = new URL(rawPath, "https://x.invalid/");
    const base = u.pathname.split("/").pop() || "";
    if (!base) return null;
    let stem = base.replace(/\.(png|jpe?g|webp|svg|gif|avif|bmp|ico)$/i, "");
    // Strip cache-busting hashes (8+ hex), size suffixes, leading "logo_"/"logotipo_".
    stem = stem.replace(/[-_][a-f0-9]{6,}$/i, "");
    stem = stem.replace(/[-_]?\d+x\d+$/i, "");
    stem = stem.replace(/[-_]?(\d{2,4})x?$/i, "");
    stem = stem.replace(/^(logo|logotipo|brand|marca|symbol)[-_]+/i, "");
    stem = stem.replace(/[-_]+(logo|logotipo|brand|marca)$/i, "");
    // Tokenize
    const tokens = stem
      .split(/[\s_\-.]+/)
      .map((t) => t.trim())
      .filter((t) => t && !/^\d+$/.test(t));
    if (tokens.length === 0) return null;
    // Reject if every token is noise (e.g. "logo", "banner_hero").
    if (tokens.every((t) => FILENAME_NOISE_RE.test(t))) return null;
    const meaningful = tokens.filter((t) => !FILENAME_NOISE_RE.test(t));
    if (meaningful.length === 0) return null;
    const name = meaningful
      .map((t) => (t.length <= 3 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1).toLowerCase()))
      .join(" ")
      .trim();
    if (!name || name.length < 2 || name.length > 60) return null;
    return name;
  } catch {
    return null;
  }
}

/**
 * Fallback: many sponsor pages render `<img data-src="…/logo_<name>.jpg">` with no
 * surrounding anchor (carousels, JS-driven grids). When the URL path obviously
 * points to a sponsor/exhibitor section, derive company names from filenames.
 */
function extractFilenameGridLogos(html: string, pageHost: string, pagePath: string): LogoWallSponsor[] {
  const out: LogoWallSponsor[] = [];
  const seen = new Set<string>();
  const sourceUrl = `https://${pageHost}${pagePath || "/"}`;

  const imgRe = /<img\b[^>]*>/gi;
  for (const m of html.matchAll(imgRe)) {
    const tag = m[0];
    const src =
      pickAttr(tag, "data-src") ||
      pickAttr(tag, "data-lazy-src") ||
      pickAttr(tag, "data-original") ||
      pickAttr(tag, "src");
    if (!src) continue;
    // Skip inline/data URIs and sprites.
    if (/^data:/i.test(src)) continue;

    let absUrl: URL;
    try {
      absUrl = new URL(src, `https://${pageHost}/`);
    } catch { continue; }

    const path = absUrl.pathname.toLowerCase();
    // Heuristic: must look like a content/upload image (not theme/plugin chrome).
    const isContentUpload =
      /\/(uploads?|media|files|content|sponsors?|patroc|exhibitor|expositor)\//i.test(path) ||
      /\/logos?\//i.test(path);
    if (!isContentUpload) continue;
    // Reject obvious chrome assets even when inside /uploads/.
    if (/(banner|hero|capa|cover|background|bg|placeholder|spacer|favicon|sprite|loader)/i.test(path)) continue;

    // Prefer alt text when meaningful; otherwise derive from filename.
    const alt = pickAttr(tag, "alt");
    let name: string | null = null;
    if (alt && alt.trim().length >= 2) {
      const cleanAlt = alt.replace(/\s+/g, " ").trim();
      if (!isBlacklistedName(cleanAlt) && !/^(banner|logo|icon|image|imagem|foto|picture)$/i.test(cleanAlt)) {
        name = cleanAlt;
      }
    }
    if (!name) name = nameFromFilename(src);
    if (!name) continue;
    if (isBlacklistedName(name)) continue;

    const dedupeKey = name.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    out.push({
      name,
      website: null,
      logo_url: absUrl.toString(),
      tier: null,
      source_url: sourceUrl,
      extraction_mode: "filename_grid",
    });
  }
  return out;
}

export function detectLogoWall(eventUrl: string, html: string): LogoWallFetchResult | null {
  let pageHost = "";
  let pagePath = "/";
  try {
    const u = new URL(eventUrl);
    pageHost = u.hostname;
    pagePath = u.pathname;
  } catch { return null; }
  if (!pageHost) return null;

  const anchorSponsors = extractAnchorImagePairs(html, pageHost);
  for (const s of anchorSponsors) s.extraction_mode = "anchor_image";
  if (anchorSponsors.length >= 6) {
    return {
      detection: { density: anchorSponsors.length, page_host: pageHost, mode: "anchor_image" },
      sponsors: anchorSponsors,
    };
  }

  // Filename-grid fallback — only on URLs that explicitly look like sponsor lists,
  // to avoid hijacking arbitrary marketing pages.
  if (SPONSOR_PATH_RE.test(pagePath)) {
    const grid = extractFilenameGridLogos(html, pageHost, pagePath);
    if (grid.length >= 6) {
      return {
        detection: { density: grid.length, page_host: pageHost, mode: "filename_grid" },
        sponsors: grid,
      };
    }
  }

  return null;
}


export async function tryLogoWallFromUrl(eventUrl: string): Promise<{
  result: LogoWallFetchResult | null;
  error?: string;
}> {
  let html = "";
  try {
    const resp = await fetch(eventUrl, {
      headers: BROWSER_HEADERS,
      redirect: "follow",
      signal: AbortSignal.timeout(20_000),
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
