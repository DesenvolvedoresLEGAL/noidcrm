// NOID Skills Engine — shared helpers
// Lightweight JSON schema validation (required fields + primitive types + maxLength)
// and guardrail enforcement for skill outputs.

export type SkillRow = {
  id: string;
  organization_id: string | null;
  slug: string;
  name: string;
  category: string;
  skill_type: string;
  status: "draft" | "active" | "deprecated" | "archived";
  version: number;
  description: string | null;
  system_prompt: string;
  task_prompt: string;
  input_schema: Record<string, any>;
  output_schema: Record<string, any>;
  guardrails: Record<string, any>;
  examples: any[];
};

export type ValidationResult = { ok: true } | { ok: false; error: string };

export function validateAgainstSchema(payload: any, schema: Record<string, any>): ValidationResult {
  if (!schema || typeof schema !== "object") return { ok: true };
  if (schema.type === "object" && payload && typeof payload === "object") {
    const required: string[] = Array.isArray(schema.required) ? schema.required : [];
    for (const key of required) {
      if (payload[key] === undefined || payload[key] === null || payload[key] === "") {
        return { ok: false, error: `Campo obrigatório ausente: ${key}` };
      }
    }
    const props = schema.properties || {};
    for (const [key, def] of Object.entries<any>(props)) {
      const val = payload[key];
      if (val === undefined || val === null) continue;
      const t = def.type;
      if (t === "string" && typeof val !== "string") return { ok: false, error: `Campo ${key} deve ser string` };
      if (t === "number" && typeof val !== "number") return { ok: false, error: `Campo ${key} deve ser number` };
      if (t === "integer" && !Number.isInteger(val)) return { ok: false, error: `Campo ${key} deve ser integer` };
      if (t === "boolean" && typeof val !== "boolean") return { ok: false, error: `Campo ${key} deve ser boolean` };
      if (t === "array" && !Array.isArray(val)) return { ok: false, error: `Campo ${key} deve ser array` };
      if (typeof val === "string" && typeof def.maxLength === "number" && val.length > def.maxLength) {
        return { ok: false, error: `Campo ${key} excede maxLength ${def.maxLength}` };
      }
    }
  }
  return { ok: true };
}

export function applyGuardrails(output: any, guardrails: Record<string, any>): ValidationResult {
  if (!guardrails) return { ok: true };
  const flatStrings: string[] = [];
  const walk = (v: any) => {
    if (typeof v === "string") flatStrings.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(output);
  const joined = flatStrings.join(" \n ").toLowerCase();
  const forbidden: string[] = Array.isArray(guardrails.forbid_phrases) ? guardrails.forbid_phrases : [];
  for (const p of forbidden) {
    if (typeof p === "string" && joined.includes(p.toLowerCase())) {
      return { ok: false, error: `Guardrail: frase proibida "${p}"` };
    }
  }
  if (typeof guardrails.max_output_chars === "number") {
    const totalLen = flatStrings.reduce((s, x) => s + x.length, 0);
    if (totalLen > guardrails.max_output_chars) {
      return { ok: false, error: `Guardrail: excede max_output_chars ${guardrails.max_output_chars}` };
    }
  }
  return { ok: true };
}

export function buildSkillMessages(skill: SkillRow, context: Record<string, any>) {
  const outSchemaText = JSON.stringify(skill.output_schema, null, 2);
  const contextText = JSON.stringify(context ?? {}, null, 2);
  const guardrailsText = JSON.stringify(skill.guardrails ?? {}, null, 2);
  const master = [
    "Você é o NOID Skills Engine.",
    "Executa uma habilidade comercial específica. Nunca chatbot genérico.",
    "Regras:",
    "- Nunca invente dados.",
    "- Nunca prometa SLA, desconto, disponibilidade ou garantia fora do contexto.",
    "- Adapte ao ICP, evento, dor provável e canal.",
    "- Se faltar contexto essencial, retorne confidence baixo e explique.",
    "- Retorne SOMENTE JSON compatível com o output_schema.",
  ].join("\n");
  const system = [master, skill.system_prompt || "", `OUTPUT_SCHEMA:\n${outSchemaText}`, `GUARDRAILS:\n${guardrailsText}`].filter(Boolean).join("\n\n");
  const user = (skill.task_prompt || "").replace("{{context}}", contextText) || contextText;
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

export function safeParseJson(text: string): any | null {
  if (!text) return null;
  try { return JSON.parse(text); } catch {}
  const m = text.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}
