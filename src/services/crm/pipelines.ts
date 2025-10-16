import { Pipeline } from './types';

const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-pre-vendas',
    name: 'PRÉ-VENDAS',
    bu: 'ALUGUE',
    stages: [
      { id: 'stage-lead', pipeline_id: 'pipe-pre-vendas', name: 'Lead Captado', position: 1, created_at: new Date().toISOString() },
      { id: 'stage-contact', pipeline_id: 'pipe-pre-vendas', name: 'Contato Inicial', position: 2, created_at: new Date().toISOString() },
      { id: 'stage-attempt', pipeline_id: 'pipe-pre-vendas', name: 'Tentativa', position: 3, created_at: new Date().toISOString() },
      { id: 'stage-qualifying', pipeline_id: 'pipe-pre-vendas', name: 'Qualificação', position: 4, created_at: new Date().toISOString() },
      { id: 'stage-qualified', pipeline_id: 'pipe-pre-vendas', name: 'Qualificado', position: 5, created_at: new Date().toISOString() },
      { id: 'stage-disqualified', pipeline_id: 'pipe-pre-vendas', name: 'Desqualificado', position: 6, created_at: new Date().toISOString() },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'pipe-alugue',
    name: 'ALUGUE: VENDAS',
    bu: 'ALUGUE',
    stages: [
      { id: 'stage-discovery', pipeline_id: 'pipe-alugue', name: 'Discovery', position: 1, created_at: new Date().toISOString() },
      { id: 'stage-qualification', pipeline_id: 'pipe-alugue', name: 'Qualificação', position: 2, created_at: new Date().toISOString() },
      { id: 'stage-proposal', pipeline_id: 'pipe-alugue', name: 'Proposta', position: 3, created_at: new Date().toISOString() },
      { id: 'stage-negotiation', pipeline_id: 'pipe-alugue', name: 'Negociação', position: 4, created_at: new Date().toISOString() },
      { id: 'stage-closed-won', pipeline_id: 'pipe-alugue', name: 'Ganho', position: 5, created_at: new Date().toISOString() },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'pipe-humanoid',
    name: 'HUMANOID: VENDAS',
    bu: 'HUMANOID',
    stages: [
      { id: 'stage-discovery', pipeline_id: 'pipe-humanoid', name: 'Discovery', position: 1, created_at: new Date().toISOString() },
      { id: 'stage-proposal', pipeline_id: 'pipe-humanoid', name: 'Proposta', position: 2, created_at: new Date().toISOString() },
      { id: 'stage-closed-won', pipeline_id: 'pipe-humanoid', name: 'Ganho', position: 3, created_at: new Date().toISOString() },
    ],
    created_at: new Date().toISOString(),
  },
];

export async function getPipeline(id: string): Promise<Pipeline | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_PIPELINES.find(p => p.id === id) || null;
}

export async function listPipelines(): Promise<Pipeline[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_PIPELINES;
}
