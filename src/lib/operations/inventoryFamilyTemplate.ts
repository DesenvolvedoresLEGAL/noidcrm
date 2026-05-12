import { z } from 'zod';
import { normalizeSpecKey, type TechnicalSpec } from './inventoryTechnicalSpecs';

export const FAMILY_SPEC_FIELD_TYPES = [
  'text',
  'number',
  'date',
  'boolean',
  'url',
  'select',
  'password',
] as const;
export type FamilySpecFieldType = (typeof FAMILY_SPEC_FIELD_TYPES)[number];

export const FAMILY_SPEC_FIELD_TYPE_LABEL: Record<FamilySpecFieldType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  boolean: 'Sim/Não',
  url: 'URL',
  select: 'Seleção',
  password: 'Senha',
};

export const MAX_FAMILY_TEMPLATE_FIELDS = 50;

export interface FamilySpecTemplateField {
  key: string;
  label: string;
  type: FamilySpecFieldType;
  required: boolean;
  placeholder?: string | null;
  help_text?: string | null;
  sort_order: number;
  is_active: boolean;
  options: string[];
}

export const familySpecTemplateFieldSchema = z
  .object({
    key: z.string().min(1, 'Campo obrigatório.').max(80, 'Máximo 80 caracteres.'),
    label: z
      .string()
      .trim()
      .min(2, 'Mínimo 2 caracteres.')
      .max(80, 'Máximo 80 caracteres.'),
    type: z.enum(FAMILY_SPEC_FIELD_TYPES).default('text'),
    required: z.boolean().default(false),
    placeholder: z
      .string()
      .trim()
      .max(120, 'Máximo 120 caracteres.')
      .optional()
      .nullable()
      .or(z.literal('')),
    help_text: z
      .string()
      .trim()
      .max(200, 'Máximo 200 caracteres.')
      .optional()
      .nullable()
      .or(z.literal('')),
    sort_order: z.coerce.number().int('Apenas inteiros.').default(0),
    is_active: z.boolean().default(true),
    options: z.array(z.string().trim().max(80, 'Máximo 80 caracteres por opção.')).default([]),
  })
  .superRefine((val, ctx) => {
    if (val.type === 'select') {
      const cleaned = (val.options ?? []).map((o) => o.trim()).filter(Boolean);
      if (cleaned.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['options'],
          message: 'Campos do tipo Seleção precisam ter pelo menos uma opção.',
        });
      }
    }
  });

export const familySpecTemplateArraySchema = z
  .array(familySpecTemplateFieldSchema)
  .max(
    MAX_FAMILY_TEMPLATE_FIELDS,
    `Limite de ${MAX_FAMILY_TEMPLATE_FIELDS} campos técnicos por família.`,
  )
  .default([])
  .superRefine((arr, ctx) => {
    const seenKeys = new Map<string, number>();
    const seenLabels = new Map<string, number>();
    arr.forEach((spec, idx) => {
      const key = (spec.key || '').toLowerCase().trim();
      const label = (spec.label || '').toLowerCase().trim();
      if (key) {
        if (seenKeys.has(key)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [idx, 'label'],
            message: 'Já existe um campo técnico com este nome nesta família.',
          });
        } else {
          seenKeys.set(key, idx);
        }
      }
      if (label && seenLabels.has(label) && seenKeys.get(key) === idx) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, 'label'],
          message: 'Já existe um campo técnico com este nome nesta família.',
        });
      } else if (label) {
        seenLabels.set(label, idx);
      }
    });
  });

export function parseOptionsString(raw: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(',')) {
    const t = piece.trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function sanitizeFamilyTemplate(
  fields: Array<Partial<FamilySpecTemplateField>> | null | undefined,
): FamilySpecTemplateField[] {
  if (!Array.isArray(fields)) return [];
  return fields
    .map((f, idx) => {
      const label = (f?.label ?? '').toString().trim();
      const key = normalizeSpecKey(label || (f?.key ?? '').toString());
      const type: FamilySpecFieldType = (FAMILY_SPEC_FIELD_TYPES as readonly string[]).includes(
        f?.type as string,
      )
        ? (f!.type as FamilySpecFieldType)
        : 'text';
      const optionsRaw = Array.isArray(f?.options) ? (f!.options as string[]) : [];
      const optionsSeen = new Set<string>();
      const options: string[] = [];
      optionsRaw.forEach((o) => {
        const t = String(o ?? '').trim();
        if (!t) return;
        const k = t.toLowerCase();
        if (optionsSeen.has(k)) return;
        optionsSeen.add(k);
        options.push(t);
      });
      return {
        key,
        label,
        type,
        required: Boolean(f?.required),
        placeholder: f?.placeholder ? String(f.placeholder).trim() : null,
        help_text: f?.help_text ? String(f.help_text).trim() : null,
        sort_order: Number.isFinite(Number(f?.sort_order)) ? Number(f?.sort_order) : idx,
        is_active: f?.is_active === false ? false : true,
        options: type === 'select' ? options : [],
      } as FamilySpecTemplateField;
    })
    .filter((f) => f.label && f.key);
}

export function getActiveTemplateFields(
  template: FamilySpecTemplateField[] | null | undefined,
): FamilySpecTemplateField[] {
  if (!Array.isArray(template)) return [];
  return [...template]
    .filter((f) => f.is_active !== false)
    .sort((a, b) => {
      const so = (a.sort_order ?? 0) - (b.sort_order ?? 0);
      if (so !== 0) return so;
      return (a.label ?? '').localeCompare(b.label ?? '');
    });
}

/**
 * Splits current item specs into the family template slots vs custom extras.
 * - Specs whose key matches an active template field become the template values
 *   (preserving the existing `value`).
 * - Everything else becomes a `custom` extra.
 */
export interface ApplyTemplateResult {
  templateSpecs: TechnicalSpec[];
  customSpecs: TechnicalSpec[];
}

export function applyTemplateToSpecs(args: {
  template: FamilySpecTemplateField[] | null | undefined;
  existingSpecs: TechnicalSpec[] | null | undefined;
}): ApplyTemplateResult {
  const active = getActiveTemplateFields(args.template);
  const existing = Array.isArray(args.existingSpecs) ? args.existingSpecs : [];
  const byKey = new Map<string, TechnicalSpec>();
  existing.forEach((s) => {
    if (s?.key) byKey.set(s.key, s);
  });

  const templateSpecs: TechnicalSpec[] = active.map((field) => {
    const prev = byKey.get(field.key);
    byKey.delete(field.key);
    return {
      key: field.key,
      label: field.label,
      value: prev?.value ?? '',
      type: field.type === 'password' ? 'text' : field.type === 'select' ? 'text' : (field.type as any),
      notes: prev?.notes ?? null,
      source: 'family_template',
    } as TechnicalSpec;
  });

  // Any remaining existing spec (not part of template) is preserved as custom.
  const customSpecs: TechnicalSpec[] = [];
  byKey.forEach((s) => {
    customSpecs.push({ ...s, source: 'custom' });
  });

  return { templateSpecs, customSpecs };
}

export function splitSpecsBySource(
  specs: TechnicalSpec[] | null | undefined,
): ApplyTemplateResult {
  const templateSpecs: TechnicalSpec[] = [];
  const customSpecs: TechnicalSpec[] = [];
  (specs ?? []).forEach((s) => {
    if (s?.source === 'family_template') templateSpecs.push(s);
    else customSpecs.push({ ...s, source: 'custom' });
  });
  return { templateSpecs, customSpecs };
}
