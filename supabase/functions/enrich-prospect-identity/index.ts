// Etapa A do enriquecimento: descobre domínio, CNPJ, e-mail e telefone públicos.
// Usa Firecrawl Search (Google) + scrape leve + lookup-cnpj interno.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CNPJ_REGEX = /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g;
const RAW_CNPJ_REGEX = /\b\d{14}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+?55\s?)?\(?\d{2}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;

import { BLOCKED_DOMAINS, isBlockedDomain, normalizeHostname } from "../_shared/domain-blocklist.ts";

function normalizeDomain(url: string): string | null {
  return normalizeHostname(url);
}

// Re-export for any local readers that previously imported from this module.
export { BLOCKED_DOMAINS, isBlockedDomain };

function formatCnpj(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 14) return raw;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function extractCnpjsFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(CNPJ_REGEX)) found.add(m[0]);
  for (const m of text.matchAll(RAW_CNPJ_REGEX)) found.add(formatCnpj(m[0]));
  return Array.from(found);
}

async function firecrawlSearch(query: string, limit = 5): Promise<Array<{ url: string; title?: string; description?: string; markdown?: string }>> {
  if (!FIRECRAWL_API_KEY) return [];
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query, limit, scrapeOptions: { formats: ["markdown"] } }),
    });
    if (!resp.ok) {
      console.warn("[enrich-identity] firecrawl search failed", resp.status, await resp.text());
      return [];
    }
    const data = await resp.json();
    // v2 returns { success, data: { web: [...] } } OR { success, data: [...] }
    const web = data?.data?.web ?? data?.data ?? [];
    return Array.isArray(web) ? web : [];
  } catch (e) {
    console.error("[enrich-identity] firecrawl search exception", e);
    return [];
  }
}

async function firecrawlScrape(url: string): Promise<string> {
  if (!FIRECRAWL_API_KEY) return "";
  try {
    const resp = await fetch("https://api.firecrawl.dev/v2/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown", "rawHtml"], onlyMainContent: false }),
    });
    if (!resp.ok) return "";
    const data = await resp.json();
    const md = data?.data?.markdown ?? data?.markdown ?? "";
    const html = data?.data?.rawHtml ?? data?.rawHtml ?? "";
    return `${md}\n${html}`;
  } catch {
    return "";
  }
}

async function lookupCnpj(cnpj: string): Promise<any | null> {
  try {
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/lookup-cnpj`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
      body: JSON.stringify({ cnpj: cnpj.replace(/\D/g, "") }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

function pickBestDomain(
  results: Array<{ url: string; title?: string }>,
  companyName: string,
): string | null {
  const nameTokens = companyName
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .split(/\s+/).filter((t) => t.length > 2);

  const candidates: Array<{ domain: string; score: number }> = [];
  for (const r of results) {
    const domain = normalizeDomain(r.url);
    if (!domain || isBlockedDomain(domain)) continue;
    let score = 0;
    if (domain.endsWith(".com.br")) score += 3;
    else if (domain.endsWith(".com")) score += 2;
    if (domain.endsWith(".gov.br")) score -= 5;
    const titleLower = (r.title || "").toLowerCase();
    for (const tok of nameTokens) {
      if (domain.includes(tok)) score += 4;
      if (titleLower.includes(tok)) score += 1;
    }
    candidates.push({ domain, score });
  }
  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 && candidates[0].score > 0 ? candidates[0].domain : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { prospect_id } = await req.json();
    if (!prospect_id) {
      return new Response(JSON.stringify({ error: "prospect_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: prospect, error: pErr } = await supabase
      .from("prospects").select("*").eq("id", prospect_id).single();
    if (pErr || !prospect) {
      return new Response(JSON.stringify({ error: "Prospect not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const updates: Record<string, any> = {};
    const log: Record<string, any> = { steps: [] };

    // 1) Domain discovery (only if missing)
    let domain = prospect.normalized_domain as string | null;
    let website = prospect.website as string | null;
    if (!domain && !website) {
      log.steps.push({ step: "search_domain", query: `"${prospect.company_name}" site oficial` });
      const results = await firecrawlSearch(`"${prospect.company_name}" site oficial Brasil`, 6);
      domain = pickBestDomain(results, prospect.company_name);
      if (domain) {
        website = `https://${domain}`;
        updates.normalized_domain = domain;
        updates.website = website;
        log.domain_found = domain;
      } else {
        log.domain_found = null;
      }
    }

    // 2) CNPJ discovery + full company data (address, CNAE, porte)
    let cnpj = prospect.cnpj as string | null;
    const needsCompanyData = !prospect.cnae_code || !prospect.endereco || !prospect.cep || !prospect.cidade_enriched;

    if (cnpj && needsCompanyData) {
      // Já tem CNPJ mas faltam dados — enriquece direto via lookup-cnpj
      const data = await lookupCnpj(cnpj);
      if (data) {
        if (!prospect.razao_social && data.razao_social) updates.razao_social = data.razao_social;
        if (!prospect.nome_fantasia) updates.nome_fantasia = data.nome_fantasia || data.razao_social;
        if (!prospect.cnae_code && data.cnae_principal?.codigo) updates.cnae_code = data.cnae_principal.codigo;
        if (!prospect.cnae_desc && data.cnae_principal?.descricao) updates.cnae_desc = data.cnae_principal.descricao;
        if (!prospect.porte && data.porte) updates.porte = data.porte;
        if (!prospect.cep && data.cep) updates.cep = data.cep;
        if (!prospect.cidade_enriched && data.cidade) updates.cidade_enriched = data.cidade;
        if (!prospect.uf_enriched && data.uf) updates.uf_enriched = data.uf;
        if (!prospect.endereco) {
          const addr = [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ");
          if (addr) updates.endereco = addr;
        }
        if (!prospect.email_public && data.email) updates.email_public = data.email;
        if (!prospect.phone_public && Array.isArray(data.telefones) && data.telefones.length > 0) {
          updates.phone_public = data.telefones[0];
        }
        log.cnpj_data_enriched = cnpj;
      }
    } else if (!cnpj) {
      // Sem CNPJ — descobre via Firecrawl
      const cnpjResults = await firecrawlSearch(`"${prospect.company_name}" CNPJ`, 5);
      const allText = cnpjResults
        .map((r) => `${r.title || ""} ${r.description || ""} ${r.markdown || ""}`)
        .join("\n");
      const candidates = extractCnpjsFromText(allText);
      log.cnpj_candidates = candidates;

      const nameTokens = prospect.company_name
        .toLowerCase()
        .normalize("NFD").replace(/\p{Diacritic}/gu, "")
        .split(/\s+/).filter((t: string) => t.length > 3);

      for (const c of candidates.slice(0, 5)) {
        const data = await lookupCnpj(c);
        const razao = (data?.razao_social || data?.nome_fantasia || "").toLowerCase()
          .normalize("NFD").replace(/\p{Diacritic}/gu, "");
        if (data && nameTokens.some((t: string) => razao.includes(t))) {
          cnpj = c;
          updates.cnpj = c;
          updates.razao_social = data.razao_social;
          updates.nome_fantasia = data.nome_fantasia || data.razao_social;
          updates.cnae_code = data.cnae_principal?.codigo;
          updates.cnae_desc = data.cnae_principal?.descricao;
          updates.porte = data.porte;
          updates.cep = data.cep;
          updates.cidade_enriched = data.cidade;
          updates.uf_enriched = data.uf;
          updates.endereco = [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ");
          if (!updates.email_public && data.email) updates.email_public = data.email;
          if (!updates.phone_public && Array.isArray(data.telefones) && data.telefones.length > 0) {
            updates.phone_public = data.telefones[0];
          }
          log.cnpj_validated = c;
          break;
        }
      }
    }

    // 3) Scrape contact page for email/phone (only if missing one)
    if (website && (!prospect.email_public || !prospect.phone_public)) {
      const scrapeText = await firecrawlScrape(website);
      const emails = (scrapeText.match(EMAIL_REGEX) || [])
        .filter((e) => !e.endsWith(".png") && !e.endsWith(".jpg") && !e.includes("sentry"));
      const phones = scrapeText.match(PHONE_REGEX) || [];

      if (!prospect.email_public && emails.length > 0) {
        updates.email_public = emails[0];
      }
      if (!prospect.phone_public && phones.length > 0) {
        updates.phone_public = phones[0].trim();
      }

      // Try /contato page if still missing
      if ((!updates.email_public && !prospect.email_public) || (!updates.phone_public && !prospect.phone_public)) {
        const base = website.replace(/\/$/, "");
        for (const path of ["/contato", "/contact", "/fale-conosco"]) {
          const t = await firecrawlScrape(`${base}${path}`);
          if (!t) continue;
          if (!updates.email_public && !prospect.email_public) {
            const e = (t.match(EMAIL_REGEX) || [])[0];
            if (e) updates.email_public = e;
          }
          if (!updates.phone_public && !prospect.phone_public) {
            const p = (t.match(PHONE_REGEX) || [])[0];
            if (p) updates.phone_public = p.trim();
          }
          if (updates.email_public && updates.phone_public) break;
        }
      }
    }

    updates.identity_enriched_at = new Date().toISOString();

    const { error: uErr } = await supabase
      .from("prospects")
      .update(updates)
      .eq("id", prospect_id);
    if (uErr) {
      console.error("[enrich-identity] update failed", uErr);
      return new Response(JSON.stringify({ error: uErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      updates,
      log,
      has_minimum_data: !!(updates.cnpj || updates.normalized_domain || prospect.cnpj || prospect.normalized_domain),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[enrich-identity] fatal", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
