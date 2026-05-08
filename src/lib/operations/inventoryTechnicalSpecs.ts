import { z } from 'zod';

export const TECHNICAL_SPEC_TYPES = ['text', 'number', 'date', 'boolean', 'url'] as const;
export type TechnicalSpecType = (typeof TECHNICAL_SPEC_TYPES)[number];

export const TECHNICAL_SPEC_TYPE_LABEL: Record<TechnicalSpecType, string> = {
  text: 'Texto',
  number: 'Número',
  date: 'Data',
  boolean: 'Sim/Não',
  url: 'URL',
};

export const MAX_TECHNICAL_SPECS = 30;

export interface TechnicalSpec {
  key: string;
  label: string;
  value: string;
  type: TechnicalSpecType;
  notes?: string | null;
}

export function normalizeSpecKey(label: string): string {
  if (!label) return '';
  return label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

export function getTechnicalSpecs(metadata: unknown): TechnicalSpec[] {
  if (!metadata || typeof metadata !== 'object') return [];
  const specs = (metadata as any).technical_specs;
  if (!Array.isArray(specs)) return [];
  return specs.filter((s) => s && typeof s === 'object') as TechnicalSpec[];
}

export function mergeTechnicalSpecs(
  existingMetadata: unknown,
  specs: TechnicalSpec[],
): Record<string, unknown> {
  const base =
    existingMetadata && typeof existingMetadata === 'object'
      ? { ...(existingMetadata as Record<string, unknown>) }
      : {};
  base.technical_specs = specs;
  return base;
}

export const technicalSpecSchema = z.object({
  key: z.string().min(1, 'Campo obrigatório.').max(80, 'Máximo 80 caracteres.'),
  label: z
    .string()
    .trim()
    .min(2, 'Mínimo 2 caracteres.')
    .max(80, 'Máximo 80 caracteres.'),
  value: z
    .string()
    .trim()
    .min(1, 'Valor obrigatório.')
    .max(200, 'Máximo 200 caracteres.'),
  type: z.enum(TECHNICAL_SPEC_TYPES).default('text'),
  notes: z
    .string()
    .trim()
    .max(300, 'Máximo 300 caracteres.')
    .optional()
    .nullable()
    .or(z.literal('')),
});

export const technicalSpecsArraySchema = z
  .array(technicalSpecSchema)
  .max(MAX_TECHNICAL_SPECS, `Limite de ${MAX_TECHNICAL_SPECS} especificações técnicas por item.`)
  .default([])
  .superRefine((arr, ctx) => {
    const seenKeys = new Map<string, number>();
    const seenLabels = new Map<string, number>();
    arr.forEach((spec, idx) => {
      const key = (spec.key || '').toLowerCase().trim();
      const label = (spec.label || '').toLowerCase().trim();
      if (key) {
        const prev = seenKeys.get(key);
        if (prev !== undefined) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [idx, 'label'],
            message: 'Já existe uma especificação com este campo neste item.',
          });
        } else {
          seenKeys.set(key, idx);
        }
      }
      if (label) {
        const prev = seenLabels.get(label);
        if (prev !== undefined && seenKeys.get(key) === idx) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [idx, 'label'],
            message: 'Já existe uma especificação com este campo neste item.',
          });
        } else {
          seenLabels.set(label, idx);
        }
      }
    });
  });

export function sanitizeTechnicalSpecs(specs: TechnicalSpec[] | undefined | null): TechnicalSpec[] {
  if (!Array.isArray(specs)) return [];
  return specs.map((s) => ({
    key: normalizeSpecKey(s.label || s.key || ''),
    label: (s.label || '').trim(),
    value: (s.value ?? '').toString().trim(),
    type: (TECHNICAL_SPEC_TYPES as readonly string[]).includes(s.type) ? s.type : 'text',
    notes: s.notes ? String(s.notes).trim() : null,
  }));
}
