// Generic provider for event sites (Next.js/SPA) that render their sponsor or
// exhibitor wall client-side from a small public JSON endpoint on the same
// origin (e.g. `/api/partners`, `/api/sponsors`, `/api/expositores`).
//
// Case that motivated it: ExpoIN26 (incongress.com.br) — the served HTML has
// zero sponsors (only navigation art), so generic scrapers emit junk names,
// while `/api/partners` returns all 104 sponsors grouped by tier.
//
// The endpoint typically returns either:
//   [{ title: "MASTER", partners: [{ name, logo, link }] }]   (grouped)
//   [{ name, logo, link }]                                     (flat)
// Names are frequently empty, so we derive them from the logo file name
// (preferred, it carries the brand) with the link domain as fallback.

import { normalizeSlugName } from "./logo-wall.ts";

export interface NextApiPartner {
  name: string;
  website: string | null;
  logo_url: string | null;
  category: string | null;
  source_url: string;
}

export interface NextApiPartnersDetection {
  endpoint: string;
  groups: number;
}

export interface NextApiPartnersFetchResult {
  partners: NextApiPartner[];
  announced_total: number;
  endpoint: string;
}

const CANDIDATE_PATHS = [
  "/api/partners",
  "/api/sponsors",
  "/api/patrocinadores",
  "/api/apoiadores",
  "/api/exhibitors",
  "/api/expositores",
  "/api/marcas",
  "/api/empresas",
];

const CATALOG_URL_HINTS = [
  "patrocinad", "sponsor", "expositor", "exhibitor", "marcas", "apoiad", "partner", "empresas",
];

const NON_IDENTIFYING_HOSTS = new Set([
  "instagram.com", "facebook.com", "linkedin.com", "x.com", "twitter.com",
  "tiktok.com", "youtube.com", "youtu.be", "wa.me", "api.whatsapp.com", "linktr.ee",
]);

function fileStem(url: string): string | null {
  try {
    const path = new URL(url).pathname;
    const file = path.split("/").pop() ?? "";
    const stem = decodeURIComponent(file).replace(/\.[a-z0-9]{2,5}$/i, "").trim();
    return stem || null;
  } catch {
    return null;
  }
}

function domainBrand(link: string): string | null {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "").toLowerCase();
    if (NON_IDENTIFYING_HOSTS.has(host)) return null;
    const label = host.split(".")[0];
    if (!label || label.length < 2) return null;
    return normalizeSlugName(label);
  } catch {
    return null;
  }
}

function websiteFrom(link: string | null | undefined): string | null {
  if (!link) return null;
  try {
    const url = new URL(link);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();
    if (NON_IDENTIFYING_HOSTS.has(host)) return null;
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return null;
  }
}

// Logo files on a single event usually share an event token (`NEODENT-IN26`,
// `FGM-IN26`). Detect and strip it so names stay clean without hardcoding it.
function detectSharedSuffix(stems: string[]): string | null {
  const counts = new Map<string, number>();
  for (const stem of stems) {
    const parts = stem.split(/[-_ ]+/).filter(Boolean);
    if (parts.length < 2) continue;
    const last = parts[parts.length - 1].toUpperCase();
    if (last.length < 2 || last.length > 10) continue;
    counts.set(last, (counts.get(last) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [token, count] of counts) {
    if (count > bestCount) { best = token; bestCount = count; }
  }
  if (best && bestCount >= Math.max(3, Math.ceil(stems.length * 0.5))) return best;
  return null;
}

function stripSuffix(stem: string, suffix: string | null): string {
  if (!suffix) return stem;
  const re = new RegExp(`[-_ ]+${suffix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  return stem.replace(re, "");
}

type RawPartner = { name?: unknown; logo?: unknown; image?: unknown; link?: unknown; url?: unknown; site?: unknown; website?: unknown };

function collect(payload: unknown): { groups: Array<{ title: string | null; items: RawPartner[] }> } | null {
  if (!Array.isArray(payload) || payload.length === 0) return null;
  const groups: Array<{ title: string | null; items: RawPartner[] }> = [];
  let flat: RawPartner[] = [];
  for (const entry of payload) {
    if (!entry || typeof entry !== "object") return null;
    const record = entry as Record<string, unknown>;
    const nested = record.partners ?? record.items ?? record.sponsors ?? record.exhibitors;
    if (Array.isArray(nested)) {
      groups.push({
        title: typeof record.title === "string" ? record.title : (typeof record.name === "string" ? record.name : null),
        items: nested as RawPartner[],
      });
    } else if (record.logo || record.image || record.name) {
      flat.push(record as RawPartner);
    }
  }
  if (groups.length === 0 && flat.length > 0) groups.push({ title: null, items: flat });
  if (groups.length === 0) return null;
  return { groups };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NoidLeadSourcing/1.0)",
        "Accept": "application/json",
      },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("json")) return null;
    return await response.json();
  } catch {
    return null;
  }
}

export async function tryNextApiPartnersFromUrl(eventUrl: string): Promise<{
  detection: NextApiPartnersDetection | null;
  result: NextApiPartnersFetchResult | null;
  error?: string;
}> {
  let origin: string;
  try {
    origin = new URL(eventUrl).origin;
  } catch {
    return { detection: null, result: null };
  }

  const lowerUrl = eventUrl.toLowerCase();
  const looksLikeCatalog = CATALOG_URL_HINTS.some((hint) => lowerUrl.includes(hint));

  for (const path of CANDIDATE_PATHS) {
    const endpoint = `${origin}${path}`;
    const payload = await fetchJson(endpoint);
    if (!payload) continue;
    const collected = collect(payload);
    if (!collected) continue;

    const totalItems = collected.groups.reduce((sum, group) => sum + group.items.length, 0);
    // Guard against tiny/unrelated endpoints when the page itself gives no hint.
    if (totalItems < (looksLikeCatalog ? 3 : 12)) continue;

    const detection: NextApiPartnersDetection = { endpoint, groups: collected.groups.length };

    const stems: string[] = [];
    for (const group of collected.groups) {
      for (const item of group.items) {
        const logo = typeof item.logo === "string" ? item.logo : (typeof item.image === "string" ? item.image : null);
        const stem = logo ? fileStem(logo) : null;
        if (stem) stems.push(stem);
      }
    }
    const sharedSuffix = detectSharedSuffix(stems);

    const seen = new Set<string>();
    const partners: NextApiPartner[] = [];
    for (const group of collected.groups) {
      for (const item of group.items) {
        const logo = typeof item.logo === "string" ? item.logo : (typeof item.image === "string" ? item.image : null);
        const link = typeof item.link === "string" ? item.link
          : typeof item.url === "string" ? item.url
          : typeof item.site === "string" ? item.site
          : typeof item.website === "string" ? item.website
          : null;

        const declared = typeof item.name === "string" ? item.name.trim() : "";
        let name = declared ? normalizeSlugName(declared) : null;
        if (!name && logo) {
          const stem = fileStem(logo);
          if (stem) name = normalizeSlugName(stripSuffix(stem, sharedSuffix));
        }
        if (!name && link) name = domainBrand(link);
        if (!name) continue;

        const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
        if (!key || seen.has(key)) continue;
        seen.add(key);

        partners.push({
          name,
          website: websiteFrom(link),
          logo_url: logo ? new URL(logo, origin).toString() : null,
          category: group.title ? group.title.trim() : null,
          source_url: eventUrl,
        });
      }
    }

    if (partners.length === 0) {
      return { detection, result: null, error: `Endpoint ${endpoint} respondeu, mas nenhum nome pôde ser derivado.` };
    }

    return {
      detection,
      result: { partners, announced_total: totalItems, endpoint },
    };
  }

  return { detection: null, result: null };
}
