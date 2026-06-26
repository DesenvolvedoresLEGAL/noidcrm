// Generic HTML "exhibitor table" provider.
// Many WordPress event sites (e.g. Expolamo) publish exhibitors as a plain
// <table> with company name + booth/stand columns and no logos/links.
// The logo-wall provider needs <img>/<a> density to fire, the SPA provider
// needs a hydrated payload, and the AI/Firecrawl fallback frequently
// collapses the whole page to a single "lead". This provider closes that gap.

const BROWSER_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
};

const COMPANY_HEADER_RE = /\b(empresa|expositor(?:es)?|exhibitor|company|companhia|marca|patrocinador(?:es)?|sponsor|parceiro(?:s)?|brand)\b/i;

const NOISE_RE = /^(empresa|expositor|exhibitor|company|stand|booth|setor|categoria|cidade|estado|país|pais|country|website|site|tipo|cota|tier)$/i;

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

function extractHrefFromCell(cellHtml: string): string | null {
  const m = cellHtml.match(/<a\s[^>]*href=["']([^"']+)["']/i);
  return m ? decodeEntities(m[1]).trim() : null;
}

export interface ExhibitorTableSponsor {
  name: string;
  booth: string | null;
  website: string | null;
  source_url: string;
}

export interface ExhibitorTableDetection {
  tables_found: number;
  matched_table_rows: number;
  company_column_index: number;
  booth_column_index: number | null;
}

export interface ExhibitorTableFetchResult {
  result: { sponsors: ExhibitorTableSponsor[]; detection: ExhibitorTableDetection } | null;
  error: string | null;
}

export async function tryExhibitorTableFromUrl(
  pageUrl: string,
): Promise<ExhibitorTableFetchResult> {
  let html: string;
  try {
    const res = await fetch(pageUrl, { headers: BROWSER_HEADERS, redirect: "follow" });
    if (!res.ok) return { result: null, error: `http_${res.status}` };
    html = await res.text();
  } catch (e) {
    return { result: null, error: `fetch_failed: ${String(e)}` };
  }

  const tableMatches = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
  if (tableMatches.length === 0) return { result: null, error: "no_tables" };

  let best: { sponsors: ExhibitorTableSponsor[]; detection: ExhibitorTableDetection } | null = null;

  for (const table of tableMatches) {
    // Parse header row to locate company / booth columns.
    const headRowMatch = table.match(/<thead[\s\S]*?<\/thead>/i);
    let companyIdx = -1;
    let boothIdx: number | null = null;

    if (headRowMatch) {
      const ths = [...headRowMatch[0].matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((m) =>
        stripTags(m[1]).toLowerCase(),
      );
      ths.forEach((label, i) => {
        if (companyIdx === -1 && COMPANY_HEADER_RE.test(label)) companyIdx = i;
        if (boothIdx === null && /\b(stand|booth|estande|cota|tier|cidade|categoria)\b/i.test(label)) {
          if (/\b(stand|booth|estande)\b/i.test(label)) boothIdx = i;
        }
      });
    }

    // Heuristic fallback: class="company-name" cell.
    const hasCompanyClass = /class=["'][^"']*\bcompany-name\b/i.test(table);

    if (companyIdx === -1 && !hasCompanyClass) {
      // Try first column if the table has 2-4 columns and a reasonable row count.
      const sampleRow = table.match(/<tbody[\s\S]*?<tr[\s\S]*?<\/tr>/i);
      if (!sampleRow) continue;
      const tdCount = (sampleRow[0].match(/<td\b/gi) ?? []).length;
      if (tdCount < 1 || tdCount > 5) continue;
      companyIdx = 0;
    }

    const bodyMatch = table.match(/<tbody[\s\S]*?<\/tbody>/i);
    const rowsScope = bodyMatch ? bodyMatch[0] : table;
    const rows = [...rowsScope.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

    const sponsors: ExhibitorTableSponsor[] = [];
    const seen = new Set<string>();

    for (const row of rows) {
      const cells = [...row[1].matchAll(/<td\b([^>]*)>([\s\S]*?)<\/td>/gi)];
      if (cells.length === 0) continue;

      let nameRaw: string | null = null;
      let boothRaw: string | null = null;

      if (hasCompanyClass) {
        for (const c of cells) {
          if (/class=["'][^"']*\bcompany-name\b/i.test(c[1])) {
            nameRaw = stripTags(c[2]);
          } else if (/\bstand-code\b/i.test(c[2]) || /stand|booth/i.test(c[1])) {
            boothRaw = stripTags(c[2]);
          }
        }
      }
      if (!nameRaw && companyIdx >= 0 && cells[companyIdx]) {
        nameRaw = stripTags(cells[companyIdx][2]);
      }
      if (!boothRaw && boothIdx !== null && cells[boothIdx]) {
        boothRaw = stripTags(cells[boothIdx][2]);
      }

      const name = nameRaw ? cleanName(nameRaw) : null;
      if (!name) continue;

      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      const href = cells[companyIdx]
        ? extractHrefFromCell(cells[companyIdx][2])
        : null;
      let website: string | null = null;
      if (href && /^https?:\/\//i.test(href)) {
        try {
          const u = new URL(href);
          const eventHost = new URL(pageUrl).hostname.replace(/^www\./, "");
          if (!u.hostname.replace(/^www\./, "").endsWith(eventHost)) {
            website = `${u.protocol}//${u.hostname}`;
          }
        } catch { /* ignore */ }
      }

      sponsors.push({
        name,
        booth: boothRaw && boothRaw.length <= 32 ? boothRaw : null,
        website,
        source_url: pageUrl,
      });
    }

    if (sponsors.length >= 6 && (!best || sponsors.length > best.sponsors.length)) {
      best = {
        sponsors,
        detection: {
          tables_found: tableMatches.length,
          matched_table_rows: sponsors.length,
          company_column_index: companyIdx,
          booth_column_index: boothIdx,
        },
      };
    }
  }

  if (!best) return { result: null, error: "no_matching_table" };
  return { result: best, error: null };
}
