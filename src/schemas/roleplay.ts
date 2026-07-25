import { z } from 'zod';
import { EVENTS_ARCHETYPE_TYPES } from '@/vertical-packs/events/roleplay';

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
 * LEGACY EVENTS-CONSTRAINED CONTRACT — VERT-01.4A.
 *
 * `archetypeSchema` continues to enforce the four Events archetype types for
 * runtime backwards-compatibility with the Postgres enum `client_type`. The
 * value list is sourced from the Events Vertical Pack — this file must never
 * redeclare the union. Level/tone/decision-role enums remain here until their
 * own extraction sprint (see VERT-01.4A docs, "other roleplay literals").
 *
 * Activation of the generic Core factory in runtime is deferred to VERT-01.4B,
 * which also requires a database migration to unlock non-events archetype
 * types.
 */
export const archetypeSchema = z.object({
  name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  type: z.enum(EVENTS_ARCHETYPE_TYPES),
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
