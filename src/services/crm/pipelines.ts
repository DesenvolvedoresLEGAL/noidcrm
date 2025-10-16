import { Pipeline } from './types';

const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-alugue',
    name: 'Pipeline ALUGUE',
    bu: 'ALUGUE',
    stages: [
      { id: 'stage-discovery', pipeline_id: 'pipe-alugue', name: 'Discovery', position: 1, created_at: new Date().toISOString() },
      { id: 'stage-demo', pipeline_id: 'pipe-alugue', name: 'Demo', position: 2, created_at: new Date().toISOString() },
      { id: 'stage-proposal', pipeline_id: 'pipe-alugue', name: 'Proposta', position: 3, created_at: new Date().toISOString() },
      { id: 'stage-negotiation', pipeline_id: 'pipe-alugue', name: 'Negociação', position: 4, created_at: new Date().toISOString() },
      { id: 'stage-won', pipeline_id: 'pipe-alugue', name: 'Ganhou', position: 5, created_at: new Date().toISOString() },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'pipe-humanoid',
    name: 'Pipeline HUMANOID',
    bu: 'HUMANOID',
    stages: [
      { id: 'stage-h-qualification', pipeline_id: 'pipe-humanoid', name: 'Qualificação', position: 1, created_at: new Date().toISOString() },
      { id: 'stage-h-technical', pipeline_id: 'pipe-humanoid', name: 'Análise Técnica', position: 2, created_at: new Date().toISOString() },
      { id: 'stage-h-proposal', pipeline_id: 'pipe-humanoid', name: 'Proposta', position: 3, created_at: new Date().toISOString() },
      { id: 'stage-h-poc', pipeline_id: 'pipe-humanoid', name: 'POC', position: 4, created_at: new Date().toISOString() },
      { id: 'stage-h-won', pipeline_id: 'pipe-humanoid', name: 'Ganhou', position: 5, created_at: new Date().toISOString() },
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
