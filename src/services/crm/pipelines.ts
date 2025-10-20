import { Pipeline, Stage } from './types';

const MOCK_PIPELINES: Pipeline[] = [
  {
    id: 'pipe-pre-vendas',
    name: 'PRÉ-VENDAS',
    bu: 'ALUGUE',
    stages: [
      { 
        id: 'stage-lead', 
        pipeline_id: 'pipe-pre-vendas', 
        name: 'Lead Captado', 
        description: 'Todo lead novo entra aqui com TAG da BU e origem. Ainda sem contato.',
        position: 1, 
        color: '#9333ea',
        probability: 0,
        stagnation_alert_days: 7,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-contact', 
        pipeline_id: 'pipe-pre-vendas', 
        name: 'Contato Inicial', 
        description: 'Tentativa de 1º contato via ligação, WhatsApp ou e-mail.',
        position: 2, 
        color: '#3b82f6',
        probability: 10,
        stagnation_alert_days: 5,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-attempt', 
        pipeline_id: 'pipe-pre-vendas', 
        name: 'Tentativa', 
        description: 'Tentativa de 2º contato via ligação, WhatsApp ou e-mail.',
        position: 3, 
        color: '#06b6d4',
        probability: 15,
        stagnation_alert_days: 3,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-qualifying', 
        pipeline_id: 'pipe-pre-vendas', 
        name: 'Qualificação', 
        description: 'Vendedor fez contato inicial, está levantando briefing, dores e fit.',
        position: 4, 
        color: '#10b981',
        probability: 25,
        stagnation_alert_days: 7,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-qualified', 
        pipeline_id: 'pipe-pre-vendas', 
        name: 'Qualificado', 
        description: 'Lead com Briefing completo, dor clara e interesse real.',
        position: 5, 
        color: '#22c55e',
        probability: 40,
        stagnation_alert_days: 5,
        allow_create_opportunity: true,
        allow_win_opportunity: true,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-disqualified', 
        pipeline_id: 'pipe-pre-vendas', 
        name: 'Desqualificado', 
        description: 'Lead sem fit para dara, sem verba ou fora da proposta LEGAL.',
        position: 6, 
        color: '#ef4444',
        probability: 0,
        stagnation_alert_days: 0,
        allow_create_opportunity: false,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'pipe-alugue',
    name: 'ALUGUE: VENDAS',
    bu: 'ALUGUE',
    stages: [
      { 
        id: 'stage-discovery', 
        pipeline_id: 'pipe-alugue', 
        name: 'Discovery', 
        description: 'Entenda oportunidade após qualificação no pré-vendas. TAG obrigatória da BU.',
        position: 1, 
        color: '#8b5cf6',
        probability: 20,
        stagnation_alert_days: 7,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-qualification', 
        pipeline_id: 'pipe-alugue', 
        name: 'Qualificação', 
        description: 'Proposta em mesa para o cliente com briefing validado e valores definidos.',
        position: 2, 
        color: '#3b82f6',
        probability: 40,
        stagnation_alert_days: 5,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-proposal', 
        pipeline_id: 'pipe-alugue', 
        name: 'Proposta', 
        description: 'Proposta em mesa para o cliente com briefing validado e valores definidos. FUP realizado e no dia.',
        position: 3, 
        color: '#06b6d4',
        probability: 60,
        stagnation_alert_days: 7,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-negotiation', 
        pipeline_id: 'pipe-alugue', 
        name: 'Negociação', 
        description: 'Início e visualização de proposta e FUP. Aguardando até 48h para primeira visualização.',
        position: 4, 
        color: '#f59e0b',
        probability: 75,
        stagnation_alert_days: 5,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-closed-won', 
        pipeline_id: 'pipe-alugue', 
        name: 'Ganho', 
        description: 'Mão na roda assinatura confirmada. Bora conectar TUDO!',
        position: 5, 
        color: '#22c55e',
        probability: 100,
        stagnation_alert_days: 0,
        allow_create_opportunity: false,
        allow_win_opportunity: true,
        allow_lose_opportunity: false,
        created_at: new Date().toISOString() 
      },
    ],
    created_at: new Date().toISOString(),
  },
  {
    id: 'pipe-humanoid',
    name: 'HUMANOID: VENDAS',
    bu: 'HUMANOID',
    stages: [
      { 
        id: 'stage-discovery-h', 
        pipeline_id: 'pipe-humanoid', 
        name: 'Discovery', 
        description: 'Entenda oportunidade após qualificação no pré-vendas. TAG obrigatória da BU.',
        position: 1, 
        color: '#8b5cf6',
        probability: 25,
        stagnation_alert_days: 7,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-proposal-h', 
        pipeline_id: 'pipe-humanoid', 
        name: 'Proposta', 
        description: 'Proposta em mesa para o cliente com briefing validado e valores definidos.',
        position: 2, 
        color: '#3b82f6',
        probability: 60,
        stagnation_alert_days: 7,
        allow_create_opportunity: true,
        allow_win_opportunity: false,
        allow_lose_opportunity: true,
        created_at: new Date().toISOString() 
      },
      { 
        id: 'stage-closed-won-h', 
        pipeline_id: 'pipe-humanoid', 
        name: 'Ganho', 
        description: 'Mão na roda assinatura confirmada. Bora conectar TUDO!',
        position: 3, 
        color: '#22c55e',
        probability: 100,
        stagnation_alert_days: 0,
        allow_create_opportunity: false,
        allow_win_opportunity: true,
        allow_lose_opportunity: false,
        created_at: new Date().toISOString() 
      },
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

export async function createPipeline(data: Omit<Pipeline, 'id' | 'created_at' | 'stages'>): Promise<Pipeline> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const newPipeline: Pipeline = {
    ...data,
    id: `pipe-${Date.now()}`,
    stages: [],
    created_at: new Date().toISOString(),
  };
  MOCK_PIPELINES.push(newPipeline);
  return newPipeline;
}

export async function updatePipeline(id: string, data: Partial<Pipeline>): Promise<Pipeline | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = MOCK_PIPELINES.findIndex(p => p.id === id);
  if (index === -1) return null;
  MOCK_PIPELINES[index] = { ...MOCK_PIPELINES[index], ...data };
  return MOCK_PIPELINES[index];
}

export async function deletePipeline(id: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const index = MOCK_PIPELINES.findIndex(p => p.id === id);
  if (index === -1) return false;
  MOCK_PIPELINES.splice(index, 1);
  return true;
}

export async function createStage(pipelineId: string, data: Omit<Stage, 'id' | 'pipeline_id' | 'created_at'>): Promise<Stage | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const pipeline = MOCK_PIPELINES.find(p => p.id === pipelineId);
  if (!pipeline) return null;
  
  const newStage: Stage = {
    ...data,
    id: `stage-${Date.now()}`,
    pipeline_id: pipelineId,
    created_at: new Date().toISOString(),
  };
  pipeline.stages.push(newStage);
  return newStage;
}

export async function updateStage(pipelineId: string, stageId: string, data: Partial<Stage>): Promise<Stage | null> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const pipeline = MOCK_PIPELINES.find(p => p.id === pipelineId);
  if (!pipeline) return null;
  
  const stageIndex = pipeline.stages.findIndex(s => s.id === stageId);
  if (stageIndex === -1) return null;
  
  pipeline.stages[stageIndex] = { ...pipeline.stages[stageIndex], ...data };
  return pipeline.stages[stageIndex];
}

export async function deleteStage(pipelineId: string, stageId: string): Promise<boolean> {
  await new Promise(resolve => setTimeout(resolve, 300));
  const pipeline = MOCK_PIPELINES.find(p => p.id === pipelineId);
  if (!pipeline) return false;
  
  const stageIndex = pipeline.stages.findIndex(s => s.id === stageId);
  if (stageIndex === -1) return false;
  
  pipeline.stages.splice(stageIndex, 1);
  return true;
}
