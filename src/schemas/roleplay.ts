import { z } from 'zod';
import { clientArchetypeTypeSchema } from '@/roleplay/archetypes';

export const icpSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  segment: z.string().min(3, 'Segmento é obrigatório'),
  company_size: z.string().optional(),
  pain_points: z.array(z.string()).min(1, 'Adicione pelo menos 1 pain point'),
  revenue_band: z.string().optional(),
  tech_maturity: z.number().min(1).max(5).optional(),
  buying_triggers: z.array(z.string()).optional(),
  success_criteria: z.array(z.string()).optional(),
  competing_alternatives: z.array(z.string()).optional(),
});

/**
 * Runtime archetype schema — VERT-01.4B2.
 *
 * `type` is validated by the generic Core `clientArchetypeTypeSchema` (any
 * well-formed trimmed string, 2–60 chars). Events-specific literals live in
 * the Events Vertical Pack (`eventsArchetypeSchema`). The other structural
 * enums (level / tone_style / decision_role) remain restricted here because
 * they are still enforced by dedicated Postgres enums and are pending their
 * own extraction sprint.
 */
export const archetypeSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  type: clientArchetypeTypeSchema,
  level: z.enum(['Entrada', 'Intermediário', 'Avançado', 'Enterprise']),
  tone_style: z.enum(['técnico', 'apressado', 'cético', 'indeciso', 'agressivo', 'metódico']),
  decision_role: z.enum(['Decisor', 'Influenciador', 'Usuário-Chave']),
  complexity_score: z.number().min(1).max(5),
  min_message_exchanges: z.number().min(10).max(200),
  objection_set: z.array(z.string()).min(1, 'Adicione pelo menos 1 objeção'),
});


export const rubricSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  passing_score: z.number().min(0).max(10),
  dimensions: z.array(z.object({
    name: z.string().min(1, 'Nome da dimensão é obrigatório'),
    weight: z.number().min(0).max(100),
    description: z.string().min(1, 'Descrição é obrigatória'),
  })).refine((dims) => {
    const totalWeight = dims.reduce((sum, d) => sum + d.weight, 0);
    return Math.abs(totalWeight - 100) < 0.01;
  }, { message: 'Pesos devem somar 100%' }),
});

export const videoSchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(200),
  url: z.string().url('URL inválida'),
  duration_sec: z.number().min(1, 'Duração deve ser maior que 0'),
  level: z.enum(['Básico', 'Intermediário', 'Avançado']),
  source: z.enum(['YouTube', 'Vimeo', 'Internal']).optional(),
  tags: z.array(z.string()).optional(),
  language: z.string().optional(),
});

export type ICPFormData = z.infer<typeof icpSchema>;
export type ArchetypeFormData = z.infer<typeof archetypeSchema>;
export type RubricFormData = z.infer<typeof rubricSchema>;
export type VideoFormData = z.infer<typeof videoSchema>;
