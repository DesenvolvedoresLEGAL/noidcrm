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
  "banner", "banner xp", "banner expert xp", "hero", "destaque",
  "todos os cursos", "curso", "cursos", "cosmetologia", "farmácia",
  "farmacia", "gestão e marketing", "gestao e marketing", "medicina",
  "nutrição", "nutricao", "veterinária", "veterinaria",
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
  extraction_mode?: "anchor_image" | "filename_grid" | "sectioned_alt_grid";
}

export interface LogoWallDetection {
  density: number;            // number of external-link logo pairs found
  page_host: string;
  mode: "anchor_image" | "filename_grid" | "sectioned_alt_grid";
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

function cleanCompanyNameCandidate(raw: string): string | null {
  const cleaned = decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\b\d{2,5}\s*x\s*\d{2,5}\b/gi, " ")
    .replace(/\b(?:quality|strip|resize|crop|fit|auto|format|webp|png|jpg|jpeg)\b/gi, " ")
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, " ")
    .replace(/\s+\d+$/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[-_\s]+|[-_\s]+$/g, "")
    .trim();
  if (!cleaned || cleaned.length < 2 || cleaned.length > 80) return null;
  if (isBlacklistedName(cleaned)) return null;
  if (/^(logo|icon|image|imagem|foto|picture|banner|hero|destaque|xp)$/i.test(cleaned)) return null;
  return cleaned;
}

function isRejectedLogoAsset(rawUrl: string, rawName = ""): boolean {
  const haystack = `${rawUrl} ${rawName}`.toLowerCase();
  return /(^|[\/_.-])(banner|hero|capa|cover|background|bg|placeholder|spacer|favicon|sprite|loader|divider|arrow|chevron|hor[-_]?line|pattern)([\/_.-]|$)/i.test(haystack) ||
    /\/(palestrantes?|speakers?|programacao|agenda|sessions?|comite|committee|ingressos?)\//i.test(haystack) ||
    /(logo[-_]?conarh|conarhlogo|conarh[-_]?agro|festival[-_]?do[-_]?trabalho|destaque[-_]?tech|arena|audit[oó]rio)/i.test(haystack);
}

function nameFromDomain(host: string): string {
  const cleanHost = stripWww(host);
  const parts = cleanHost.split(".").filter(Boolean);
  const brSecondLevel = new Set(["com", "org", "net", "edu", "gov", "tec", "ind", "adm", "art", "eco", "far"]);
  const clean = parts.length >= 3 && parts[parts.length - 1] === "br" && brSecondLevel.has(parts[parts.length - 2])
    ? parts[parts.length - 3]
    : (parts.length >= 2 ? parts[parts.length - 2] : parts[0]) || host;
  if (!clean) return host;
  return clean
    .replace(/[-_]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");
}

function nameFromSocialUrl(url: URL): string | null {
  const host = stripWww(url.hostname);
  if (!GENERIC_HOSTS.has(host) && !GENERIC_HOSTS.has(url.hostname.toLowerCase())) return null;

  const pathParts = url.pathname.split("/").map((p) => p.trim()).filter(Boolean);
  let handle = pathParts[0] || "";
  if (/^(company|in|school|pages?|share|reel|p|tv|status)$/i.test(handle)) {
    handle = pathParts[1] || "";
  }
  handle = handle.replace(/^@/, "").replace(/[?#].*$/, "");
  if (!handle || /^profile\.php$/i.test(handle)) return null;

  const name = handle
      .replace(/(oficial|official|brasil|brazil|industria|industry|pharma|farmacia|magistral|chemicals)$/i, "")
    .replace(/[._-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!name || name.length < 2) return null;
  return cleanCompanyNameCandidate(
    name.split(" ").map((w) => (w.length <= 3 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())).join(" "),
  );
}

function pickAttr(tag: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i");
  const m = tag.match(re);
  return m ? decodeEntities(m[1]).trim() : null;
}

const SPONSOR_SECTION_LABELS = new Set([
  "parceiros", "parceiras", "partners", "experiências", "experiencias",
  "patrocinadores", "sponsors", "apoio", "apoiadores",
]);

const SPONSOR_TIER_LABELS = new Set([
  "master", "diamante", "diamond", "black", "platinum", "platina",
  "ouro", "gold", "prata", "silver", "bronze", "cobre",
]);

function normalizeLabel(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/**
 * Many WordPress/Elementor catalogues expose the media slug as alt text
 * ("EC3-AZIMUT", "diantonio-boats", "FLUVIMAR2_NOVO"). Turn those into readable
 * company names: drop internal cota prefixes (EC-, EC3-, LOGO-), separators and
 * editorial suffixes, then title-case the remaining tokens.
 */
const SLUG_PREFIX_RE = /^(ec\d*|logo(?:tipo)?|marca|brand|img|image|foto|patrocinador|expositor)[-_\s]+/i;
const SLUG_SUFFIX_RE = /[-_\s]+(novo|new|logo|logotipo|marca|final|atualizado|oficial|preto|branco|color|colorido|vector|horizontal|vertical|png|jpg|site|web|\d{2,4}|v\d)$/i;

export function normalizeSlugName(raw: string): string | null {
  let stem = decodeEntities(raw).trim();
  if (!stem) return null;
  // Only treat as slug when there is no natural spacing or it is clearly a file slug.
  const looksLikeSlug = !/\s/.test(stem) && /[-_]/.test(stem);
  if (!looksLikeSlug && !/^[A-Z0-9][A-Z0-9\s_-]*$/.test(stem)) return cleanCompanyNameCandidate(stem);

  stem = stem.replace(/\.(png|jpe?g|webp|svg|avif|gif)$/i, "");
  stem = stem.replace(/\([^)]*\)/g, " ");
  let previous = "";
  while (previous !== stem) {
    previous = stem;
    stem = stem.replace(SLUG_PREFIX_RE, "").replace(SLUG_SUFFIX_RE, "");
  }
  const tokens = stem
    .split(/[-_\s.]+/)
    .map((t) => t.trim())
    .filter((t) => t && !/^\d+$/.test(t) && !FILENAME_NOISE_RE.test(t));
  if (tokens.length === 0) return null;
  const name = tokens
    .map((t) =>
      /^[A-ZÀ-Ý0-9&]+$/.test(t) && t.length <= 4
        ? t.toUpperCase()
        : t[0].toLocaleUpperCase("pt-BR") + t.slice(1).toLocaleLowerCase("pt-BR")
    )
    .join(" ");
  return cleanCompanyNameCandidate(name);
}


function unwrapOptimizedImageUrl(rawSrc: string, pageUrl: string): URL | null {
  try {
    const outer = new URL(rawSrc, pageUrl);
    const nested = outer.searchParams.get("url");
    if (nested) return new URL(decodeURIComponent(nested), pageUrl);
    return outer;
  } catch {
    return null;
  }
}

/**
 * Generic parser for SSR sponsor catalogues (especially Next.js): the page
 * exposes trustworthy alt text, but the images are not links and their real
 * CDN URL is wrapped by /_next/image?url=. Walking the document in order also
 * preserves top-level sections and sponsorship tiers.
 */
function extractSectionedAltLogoGrid(
  html: string,
  pageHost: string,
  pagePath: string,
  opts: { permissiveSections?: boolean } = {},
): LogoWallSponsor[] {
  const out: LogoWallSponsor[] = [];
  const seen = new Set<string>();
  const pageUrl = `https://${pageHost}${pagePath || "/"}`;
  let section: string | null = null;
  let tier: string | null = null;

  const tokenRe = /(<h[1-4]\b[^>]*>[\s\S]*?<\/h[1-4]>)|(<(?:div|span|p)\b[^>]*>\s*([^<>]{2,30})\s*<\/(?:div|span|p)>)|(<img\b[^>]*>)/gi;
  for (const match of html.matchAll(tokenRe)) {
    if (match[1]) {
      const label = normalizeLabel(match[1]);
      const key = label.toLocaleLowerCase("pt-BR");
      if (SPONSOR_SECTION_LABELS.has(key)) {
        section = label;
        tier = null;
      } else if (section && SPONSOR_TIER_LABELS.has(key)) {
        tier = label;
      } else if (opts.permissiveSections && label && label.length <= 80 && /[A-Za-zÀ-ÿ]/.test(label)) {
        // Catalogue pages (URL already scoped to exhibitors/sponsors) group logos
        // under editorial headings ("ESTALEIROS", "SHOPPING"), not tier keywords.
        section = label;
        tier = null;
      }
      continue;
    }
    if (match[2]) {
      const label = normalizeLabel(match[3] || "");
      const key = label.toLocaleLowerCase("pt-BR");
      if (section && SPONSOR_TIER_LABELS.has(key)) tier = label;
      continue;
    }

    const tag = match[4];
    if (!tag || !section) continue;
    const alt = pickAttr(tag, "alt");
    const name = alt ? normalizeSlugName(alt) : null;
    if (!name || isBlacklistedName(name)) continue;


    const rawSrc = pickAttr(tag, "data-src") || pickAttr(tag, "data-lazy-src") || pickAttr(tag, "src");
    if (!rawSrc || /^data:/i.test(rawSrc)) continue;
    const imageUrl = unwrapOptimizedImageUrl(rawSrc, pageUrl);
    if (!imageUrl || isRejectedLogoAsset(imageUrl.toString(), name)) continue;

    // A catalogue logo must come from content media, a dedicated logo path, or
    // an external CDN. This excludes the event's own navigation/chrome assets.
    const imageHost = stripWww(imageUrl.hostname);
    const pageHostKey = stripWww(pageHost);
    const contentAsset = imageHost !== pageHostKey ||
      /\/(uploads?|media|content|sponsors?|patroc|parceir|partners?|logos?|assets)\//i.test(imageUrl.pathname);
    if (!contentAsset) continue;

    const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      website: null,
      logo_url: imageUrl.toString(),
      tier: tier ? `${section} — ${tier}` : section,
      source_url: pageUrl,
      extraction_mode: "sectioned_alt_grid",
    });
  }
  return out;
}

/**
 * Parse an HTML document into a list of <a href><img></a> pairs where the link
 * targets an external domain. Captures the closest preceding heading text as
 * tier metadata.
 */
function extractAnchorImagePairs(html: string, pageHost: string, pagePath = "/"): LogoWallSponsor[] {
  const out: LogoWallSponsor[] = [];
  const seen = new Set<string>();
  let currentTier: string | null = null;
  const sourceUrl = `https://${pageHost}${pagePath || "/"}`;

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
    if (src && isRejectedLogoAsset(src, alt || title || "")) continue;

    const srcPath = src ? (() => {
      try { return new URL(src, `https://${pageHost}/`).pathname.toLowerCase(); } catch { return ""; }
    })() : "";
    const exhibitorAsset = /\/(expositor(?:es)?|exhibitor(?:s)?|sponsor(?:s)?|patroc|parceir|partner|apoiador)\//i.test(srcPath);
    const genericHost = GENERIC_HOSTS.has(linkHost) || GENERIC_HOSTS.has(absHref.hostname.toLowerCase());
    if (genericHost && !exhibitorAsset) continue;

    // Candidate name resolution
    let name: string | null = null;
    const candidates = [alt, title].filter((x): x is string => !!x && x.trim().length >= 2);
    for (const c of candidates) {
      const clean = cleanCompanyNameCandidate(c);
      if (!clean) continue;
      name = clean;
      break;
    }
    // For same-host anchors prefer the filename; the domain name would collapse all
    // sponsors that link back to e.g. xpi.com.br into a single "Xpi" entry.
    if (!name && src) name = nameFromFilename(src);
    if (!name && genericHost && exhibitorAsset) name = nameFromSocialUrl(absHref);
    if (!name && !sameHost && !genericHost) name = nameFromDomain(absHref.hostname);
    if (!name) continue;
    if (isBlacklistedName(name)) continue;

    const website = sameHost || genericHost
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
      source_url: sourceUrl,
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
  /^(logo|logotipo|brand|brandmark|wordmark|symbol|icon|ic|imagem|image|img|banner|hero|placeholder|default|spacer|pixel|blank|transparent|sprite|untitled|prancheta|asset[s]?\d*|parceiro|partner|sponsor|patrocinador)$/i;

/** Convert a filename like `logo_vinci_compass-2x.jpg` → "Vinci Compass". */
function nameFromFilename(rawPath: string): string | null {
  try {
    const u = new URL(rawPath, "https://x.invalid/");
    const base = u.pathname.split("/").pop() || "";
    if (!base) return null;
    let stem = base.replace(/\.(png|jpe?g|jfif|webp|svg|gif|avif|bmp|ico)$/i, "");
    // Strip cache-busting hashes (8+ hex), size suffixes, leading "logo_"/"logotipo_".
    stem = stem.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, "");
    stem = stem.replace(/[-_][a-f0-9]{6,}$/i, "");
    stem = stem.replace(/[-_]?\d{2,5}x\d{2,5}/gi, "");
    stem = stem.replace(/[-_]?(\d{2,4})x?$/i, "");
    stem = stem.replace(/^(logo|logotipo|brand|marca|symbol)[-_]+/i, "");
    stem = stem.replace(/[-_]+(logo|logotipo|brand|marca)$/i, "");
    // Tokenize
    const tokens = stem
      .split(/[\s_\-.]+/)
      .map((t) => t.trim())
      .filter((t) => t && !/^\d+$/.test(t) && !/^(?=.*\d)[a-f0-9]{4,}$/i.test(t));
    if (tokens.length === 0) return null;
    // Reject if every token is noise (e.g. "logo", "banner_hero").
    if (tokens.every((t) => FILENAME_NOISE_RE.test(t))) return null;
    const meaningful = tokens.filter((t) => !FILENAME_NOISE_RE.test(t));
    if (meaningful.length === 0) return null;
    const name = meaningful
      .map((t) => (t.length <= 3 ? t.toUpperCase() : t[0].toUpperCase() + t.slice(1).toLowerCase()))
      .join(" ")
      .trim();
    return cleanCompanyNameCandidate(name);
  } catch {
    return null;
  }
}

async function fetchConarhPartners(eventUrl: string, html: string): Promise<LogoWallFetchResult | null> {
  let page: URL;
  try { page = new URL(eventUrl); } catch { return null; }
  if (!/(^|\.)conarh\.org\.br$/i.test(page.hostname)) return null;

  const scriptSrc = Array.from(html.matchAll(/<script\b[^>]*\bsrc=["']([^"']*\/assets\/index-[^"']+\.js)["'][^>]*>/gi))
    .map((m) => m[1])
    .find(Boolean);
  if (!scriptSrc) return null;

  let js = "";
  try {
    const bundleUrl = new URL(scriptSrc, page.origin).toString();
    const bundleResp = await fetch(bundleUrl, { headers: BROWSER_HEADERS, redirect: "follow", signal: AbortSignal.timeout(20_000) });
    if (!bundleResp.ok) return null;
    js = await bundleResp.text();
  } catch {
    return null;
  }

  const supabaseUrl = js.match(/https:\/\/[a-z0-9-]+\.supabase\.co/i)?.[0];
  const publishableKey = js.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0];
  if (!supabaseUrl || !publishableKey) return null;

  try {
    const apiUrl = `${supabaseUrl}/rest/v1/parceiros?select=name,logo_url,tier,order_index,active&active=eq.true&order=order_index.asc`;
    const resp = await fetch(apiUrl, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${publishableKey}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!resp.ok) return null;
    const rows = await resp.json();
    if (!Array.isArray(rows)) return null;

    const seen = new Set<string>();
    const sponsors: LogoWallSponsor[] = [];
    for (const row of rows) {
      const name = cleanCompanyNameCandidate(String(row?.name ?? ""));
      if (!name || isBlacklistedName(name)) continue;
      const logoUrl = typeof row?.logo_url === "string" ? row.logo_url : null;
      if (logoUrl && isRejectedLogoAsset(logoUrl, name)) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      sponsors.push({
        name,
        website: null,
        logo_url: logoUrl,
        tier: typeof row?.tier === "string" ? row.tier : null,
        source_url: page.toString(),
        extraction_mode: "filename_grid",
      });
    }

    if (sponsors.length < 6) return null;
    return {
      detection: { density: sponsors.length, page_host: page.hostname, mode: "filename_grid" },
      sponsors,
    };
  } catch {
    return null;
  }
}

/**
 * Fallback: many sponsor pages render `<img data-src="…/logo_<name>.jpg">` with no
 * surrounding anchor (carousels, JS-driven grids). When the URL path obviously
 * points to a sponsor/exhibitor section, derive company names from filenames.
 */
function extractFilenameGridLogos(html: string, pageHost: string, pagePath: string, opts: { strictPath: boolean }): LogoWallSponsor[] {
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
    const sponsorAssetPath = /\/(sponsors?|patroc|exhibitor|expositor|parceir|partner|apoiador|marcas?|brands?|logos?)\//i.test(path);
    // Heuristic: must look like a content/upload image (not theme/plugin chrome).
    const isContentUpload = opts.strictPath
      ? (/\/(uploads?|media|files|content|sponsors?|patroc|exhibitor|expositor|parceir|partner|apoiador|marca|brand)\//i.test(path) ||
        /\/logos?\//i.test(path) ||
        /\/storage\/v1\/object\/public\//i.test(path) ||
        /\/assets\/[^/]+\.(png|jpe?g|webp|svg|avif)/i.test(path))
      : sponsorAssetPath;
    if (!isContentUpload) continue;
    // Reject obvious chrome assets even when inside /uploads/.
    if (isRejectedLogoAsset(absUrl.toString(), pickAttr(tag, "alt") || "")) continue;

    // Prefer alt text when meaningful; otherwise derive from filename.
    const alt = pickAttr(tag, "alt");
    let name: string | null = null;
    if (alt && alt.trim().length >= 2) {
      name = normalizeSlugName(alt);
    }
    if (!name) name = nameFromFilename(src);
    if (!name) continue;
    if (isBlacklistedName(name)) continue;
    // In permissive (content-trigger) mode require that the name didn't come from
    // a totally chrome-y filename (already filtered) AND has at least one letter.
    if (!/[A-Za-zÀ-ÿ]/.test(name)) continue;

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

// Content-level signals that the page is a sponsor/partner/exhibitor wall, even
// when the URL is just "/". CONARH, Expert XP and many others surface these
// keywords as section titles around the logo grids.
const SPONSOR_CONTENT_RE =
  /\b(patrocinador(?:es)?|sponsors?|exhibitors?|expositor(?:es|as)?|parceir[oa]s?|partners?|apoiador(?:es)?|marcas\s+participantes|nossos\s+clientes|nossos\s+parceiros)\b/i;

export function detectLogoWall(eventUrl: string, html: string): LogoWallFetchResult | null {
  let pageHost = "";
  let pagePath = "/";
  try {
    const u = new URL(eventUrl);
    pageHost = u.hostname;
    pagePath = u.pathname;
  } catch { return null; }
  if (!pageHost) return null;

  const pathSignal = SPONSOR_PATH_RE.test(pagePath);
  const contentSignal = SPONSOR_CONTENT_RE.test(html);
  if (pathSignal || contentSignal) {
    const sectionedSponsors = extractSectionedAltLogoGrid(html, pageHost, pagePath, {
      permissiveSections: pathSignal,
    });
    const minDensity = pathSignal ? 6 : 10;
    if (sectionedSponsors.length >= minDensity) {
      return {
        detection: { density: sectionedSponsors.length, page_host: pageHost, mode: "sectioned_alt_grid" },
        sponsors: sectionedSponsors,
      };
    }
  }

  const anchorSponsors = extractAnchorImagePairs(html, pageHost, pagePath);
  for (const s of anchorSponsors) s.extraction_mode = "anchor_image";
  if (anchorSponsors.length >= 6) {
    return {
      detection: { density: anchorSponsors.length, page_host: pageHost, mode: "anchor_image" },
      sponsors: anchorSponsors,
    };
  }

  // Filename/alt grid: runs when (a) the URL path looks like a sponsor list, OR
  // (b) the page text mentions sponsors/partners/exhibitors. Without (b) we'd
  // never catch CONARH ("/") or other landing pages that embed a logo wall.
  if (pathSignal || contentSignal) {
    const grid = extractFilenameGridLogos(html, pageHost, pagePath, { strictPath: pathSignal });
    // Require a higher threshold when triggered purely by content to avoid
    // hijacking marketing pages with a handful of partner logos.
    const minDensity = pathSignal ? 6 : 10;
    if (grid.length >= minDensity) {
      return {
        detection: { density: grid.length, page_host: pageHost, mode: "filename_grid" },
        sponsors: grid,
      };
    }
    // If anchor mode found a few (1-5) and grid mode found many, merge anchors'
    // websites into grid entries by matching logo filename, then return grid.
    if (grid.length >= minDensity) {
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

  let detected = detectLogoWall(eventUrl, html);

  if (!detected) {
    detected = await fetchConarhPartners(eventUrl, html);
  }

  // Render fallback: sponsor routes frequently return a sizeable Next.js shell
  // (navigation, analytics and footer included), so HTML size alone is not a
  // reliable signal. If a sponsor/exhibitor URL did not yield a catalogue,
  // render it before allowing the generic extractor to consume navigation text.
  const looksLikeShell = (html.length < 5000) || (!/<img\b/i.test(html));
  let pathLooksLikeCatalogue = false;
  try {
    pathLooksLikeCatalogue = SPONSOR_PATH_RE.test(new URL(eventUrl).pathname);
  } catch {
    pathLooksLikeCatalogue = false;
  }
  if (!detected && (looksLikeShell || pathLooksLikeCatalogue)) {
    const apiKey = (globalThis as any).Deno?.env?.get?.("FIRECRAWL_API_KEY");
    if (apiKey) {
      try {
        const fcResp = await fetch("https://api.firecrawl.dev/v2/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url: eventUrl,
            formats: ["html"],
            onlyMainContent: false,
            waitFor: 4000,
            timeout: 60000,
          }),
          signal: AbortSignal.timeout(75_000),
        });
        const fcData = await fcResp.json();
        const renderedHtml = fcData?.data?.html || fcData?.html || "";
        if (renderedHtml && renderedHtml.length > html.length) {
          html = renderedHtml;
          detected = detectLogoWall(eventUrl, html);
        }
      } catch (e) {
        return { result: detected, error: `firecrawl render failed: ${(e as Error).message}` };
      }
    }
  }

  if (!detected) return { result: null };
  return { result: detected };
}
