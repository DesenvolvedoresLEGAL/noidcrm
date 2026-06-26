// PDF Floorplan / Exhibitor List provider
// ----------------------------------------
// Many events publish exhibitor lists only as PDFs (floorplans, brochures,
// catalogues). Examples: FEIPLAR/FEIPUR (planta baixa com nomes nas quadras),
// FEIMEC, FEIPLASTIC, etc.
//
// Strategy (deterministic-first, cheap-fallback):
//   1) Detect: URL ends with .pdf OR Content-Type=application/pdf
//   2) Native text extraction via `unpdf` (Deno-native, no binaries)
//   3) Heuristic filter to discard map labels (dimensions, areas comuns,
//      auditórios, palavras genéricas)
//   4) If native extraction yields < 8 names, fallback to Gemini Vision
//      (Lovable AI Gateway, OpenAI-compatible) with PDF inline base64
//
// Returns the same shape used by logo-wall so the pipeline can treat it
// the same way.

import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.12.1";

export interface PdfFloorplanDetection {
  mode: "native" | "vision";
  source_url: string;
  pages: number;
}

export interface PdfFloorplanExhibitor {
  name: string;
  website: string | null;
  source_url: string;
  tier: string | null;
  logo_url: string | null;
  extraction_mode: "pdf_native" | "pdf_vision";
}

export interface PdfFloorplanFetchResult {
  result: {
    sponsors: PdfFloorplanExhibitor[];
    detection: { mode: string; density: number };
  } | null;
  error?: string;
}

// ─────────────────────────────────────────────
// Detection
// ─────────────────────────────────────────────
export function isPdfUrl(url: string): boolean {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    return /\.pdf($|\?|#)/i.test(u.pathname);
  } catch {
    return false;
  }
}

async function isPdfByHead(url: string): Promise<boolean> {
  try {
    const r = await fetch(url, { method: "HEAD", redirect: "follow" });
    const ct = r.headers.get("content-type") || "";
    return ct.toLowerCase().includes("application/pdf");
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────
// Noise filter — descarta labels de planta baixa
// ─────────────────────────────────────────────
const NOISE_EXACT = new Set([
  "área", "area", "rodadas", "negócios", "negocios", "serviços", "servicos",
  "auditório", "auditorio", "auditório 1", "auditório 2", "auditório 3", "auditório 4",
  "auditorio 1", "auditorio 2", "auditorio 3", "auditorio 4",
  "lanchonete", "imprensa", "coffee-breaks", "coffee break", "coffee-break",
  "workshops", "workshop", "arena", "área vip", "area vip", "vip",
  "reuniões agendadas", "reunioes agendadas",
  "arena de peças", "arena de pecas", "área de peças", "area de pecas",
  "credenciamento", "patrocinadores", "expositores", "parceiros",
  "entrada", "saída", "saida", "wc", "banheiro", "praça", "praca",
  "stand", "stands", "booth", "boxes", "rua", "av",
  "feira", "feiplar", "feipur", "expositor", "mapa", "planta", "legenda",
  "patrocínio", "patrocinio", "apoio", "realização", "realizacao",
  "organização", "organizacao", "edição", "edicao",
]);

const NOISE_REGEX = [
  /^\d+\s*(m|m²|m2|mts?)$/i,                  // 117m², 9m, 3m, 12m
  /^[A-H]\s*\d+m?$/i,                          // A1, B25, C13
  /^\d+m?\s*[xX×]\s*\d+m?$/i,                  // 5x10, 8x8m
  /^[0-9]+\s*$/,                                // pure numbers
  /^[A-Z]{1,2}\d{1,3}$/,                       // grid refs like G81, F43, B25
  /^\d+[a-z]?$/i,                              // 25a, 5b
  /^pag[ie]?\s*\d+/i,
  /^p[áa]gina\s*\d+/i,
  /^\d+\s*\/\s*\d+/,                           // 1/27
  /^cor(redor|redores)?$/i,
  /^[a-z]{1,2}$/i,                             // single/double letters
];

function isLikelyCompanyName(raw: string): boolean {
  const s = raw.trim();
  if (s.length < 2 || s.length > 80) return false;
  const lower = s.toLowerCase();
  if (NOISE_EXACT.has(lower)) return false;
  if (NOISE_REGEX.some((re) => re.test(s))) return false;
  // Must contain at least one letter
  if (!/[a-záéíóúâêôãõç]/i.test(s)) return false;
  // Reject if mostly digits/symbols
  const letters = (s.match(/[a-záéíóúâêôãõç]/gi) || []).length;
  if (letters < 2) return false;
  return true;
}

function normalizeName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .replace(/^[\s\-•·:]+|[\s\-•·:]+$/g, "")
    .trim();
}

// Split a large extracted text blob into candidate tokens.
// PDF planta-baixa tem nomes em maiúsculas separados por quebras/espaços.
function tokenizePdfText(text: string): string[] {
  // Split by newlines; many planta-baixa labels are one-per-line
  const lines = text.split(/[\r\n]+/);
  const out: string[] = [];
  for (const ln of lines) {
    const t = ln.trim();
    if (!t) continue;
    // Some lines contain multiple labels separated by 2+ spaces
    const parts = t.split(/\s{2,}|\t+/).map((p) => p.trim()).filter(Boolean);
    out.push(...parts);
  }
  return out;
}

// ─────────────────────────────────────────────
// Native extraction
// ─────────────────────────────────────────────
async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const resp = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      Accept: "application/pdf,*/*",
    },
  });
  if (!resp.ok) throw new Error(`Falha ao baixar PDF (${resp.status})`);
  const buf = await resp.arrayBuffer();
  return new Uint8Array(buf);
}

async function extractNative(bytes: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(bytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : String(text || "");
  return { text: merged, pages: totalPages || 1 };
}

function extractCandidatesFromText(text: string): string[] {
  const tokens = tokenizePdfText(text);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tk of tokens) {
    const name = normalizeName(tk);
    if (!isLikelyCompanyName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// ─────────────────────────────────────────────
// LLM-assisted extraction (cheap: text-only, no vision unless needed)
// ─────────────────────────────────────────────
async function extractNamesWithLLM(rawText: string, useVision: { bytes: Uint8Array } | null): Promise<string[]> {
  const apiKey = Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY / LOVABLE_API_KEY not configured for PDF LLM extraction");

  const isOpenAI = !!Deno.env.get("OPENAI_API_KEY");
  const endpoint = isOpenAI
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";
  const model = isOpenAI ? "gpt-4o-mini" : "google/gemini-2.5-flash";

  const systemPrompt =
    "Você extrai nomes de empresas expositoras e patrocinadoras de plantas baixas de feiras. " +
    "Ignore TUDO que for: dimensão (9m, 117m²), referência de grid (A1, B25, G81, F43), " +
    "áreas comuns (auditório, lanchonete, restaurante, área VIP, rodadas de negócios, workshops, imprensa, coffee-breaks, credenciamento, entrada, saída, WC, banheiro, anexo), " +
    "rótulos genéricos (stand, rua, projeção, caixa, mais dessecantes, megapatrocinadores), " +
    "endereços (São Paulo, Pavilhão 5, Brasil), datas. " +
    "Retorne SOMENTE um array JSON de strings com os nomes únicos das empresas/marcas, sem markdown e sem texto extra. " +
    'Exemplo: ["EMPRESA A", "MARCA B", "BRAND C"]';

  let userContent: any;
  if (useVision) {
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < useVision.bytes.length; i += chunk) {
      binary += String.fromCharCode(...useVision.bytes.subarray(i, i + chunk));
    }
    const base64 = btoa(binary);
    userContent = [
      { type: "text", text: "Planta baixa em PDF. Extraia somente nomes de expositores/marcas conforme as regras." },
      {
        type: "file",
        file: {
          filename: "exhibitors.pdf",
          file_data: `data:application/pdf;base64,${base64}`,
        },
      },
    ];
  } else {
    // Cheap path: send already-extracted text
    const truncated = rawText.length > 60000 ? rawText.slice(0, 60000) : rawText;
    userContent = `Texto bruto extraído de planta baixa de feira (mistura nomes de expositores com dimensões e rótulos de área). Aplique as regras e retorne o array JSON:\n\n${truncated}`;
  }

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
    temperature: 0,
  };
  if (isOpenAI) (body as any).response_format = { type: "json_object" };

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const t = await resp.text().catch(() => "");
    throw new Error(`PDF LLM extraction failed (${resp.status}): ${t.slice(0, 300)}`);
  }
  const data = await resp.json();
  let raw: string = data?.choices?.[0]?.message?.content ?? "";
  raw = raw.replace(/```json|```/gi, "").trim();

  let parsed: unknown = null;
  try { parsed = JSON.parse(raw); } catch { /* try below */ }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    // OpenAI json_object mode wraps the array — find first array property
    for (const v of Object.values(parsed as Record<string, unknown>)) {
      if (Array.isArray(v)) { parsed = v; break; }
    }
  }
  if (!Array.isArray(parsed)) {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) {
      try { parsed = JSON.parse(m[0]); } catch { /* noop */ }
    }
  }
  if (!Array.isArray(parsed)) return [];

  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const name = normalizeName(item);
    if (!isLikelyCompanyName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

// ─────────────────────────────────────────────
// Public entry
// ─────────────────────────────────────────────
export async function tryPdfFloorplanFromUrl(eventUrl: string): Promise<PdfFloorplanFetchResult> {
  try {
    const isPdf = isPdfUrl(eventUrl) || (await isPdfByHead(eventUrl));
    if (!isPdf) return { result: null };

    const bytes = await fetchPdfBytes(eventUrl);

    // 1) Native text extraction (unpdf)
    let rawText = "";
    let pages = 1;
    try {
      const { text, pages: p } = await extractNative(bytes);
      pages = p;
      rawText = text;
    } catch (e) {
      console.warn("[pdf-floorplan] native extraction failed:", String(e));
    }

    // 2) Heuristic candidate filter (zero LLM cost when it works)
    let names = extractCandidatesFromText(rawText);
    let mode: "pdf_native" | "pdf_vision" = "pdf_native";

    // 3) LLM cleanup on extracted text (cheap — no vision) when noise is too high
    //    Plantas baixas misturam dimensões com nomes, então quase sempre cai aqui.
    if (rawText.length > 200) {
      try {
        const llmNames = await extractNamesWithLLM(rawText, null);
        if (llmNames.length > names.length) {
          names = llmNames;
          mode = "pdf_native";
        }
      } catch (e) {
        console.warn("[pdf-floorplan] LLM text extraction failed:", String(e));
      }
    }

    // 4) Vision fallback only if everything else failed (scanned PDFs / image-only)
    if (names.length < 8) {
      try {
        const visionNames = await extractNamesWithLLM(rawText, { bytes });
        if (visionNames.length > names.length) {
          names = visionNames;
          mode = "pdf_vision";
        }
      } catch (e) {
        console.warn("[pdf-floorplan] vision fallback failed:", String(e));
      }
    }

    if (names.length === 0) {
      return { result: null, error: "Nenhum nome de expositor extraído do PDF" };
    }

    const sponsors: PdfFloorplanExhibitor[] = names.map((name) => ({
      name,
      website: null,
      source_url: eventUrl,
      tier: null,
      logo_url: null,
      extraction_mode: mode,
    }));

    return {
      result: {
        sponsors,
        detection: { mode, density: sponsors.length / Math.max(1, pages) },
      },
    };
  } catch (err) {
    return { result: null, error: String(err) };
  }
}
