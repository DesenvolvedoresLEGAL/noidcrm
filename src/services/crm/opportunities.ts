import { Opportunity, OpportunityListParams } from './types';

const MOCK_OPPORTUNITIES: Opportunity[] = [
  {
    id: '1',
    account_id: 'acc-1',
    pipeline_id: 'pipe-alugue',
    stage_id: 'stage-discovery',
    produto: 'ALUGUE',
    valor_previsto: 150000,
    prob: 0.3,
    close_date_prevista: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    account_id: 'acc-2',
    pipeline_id: 'pipe-humanoid',
    stage_id: 'stage-proposal',
    produto: 'HUMANOID',
    valor_previsto: 250000,
    prob: 0.7,
    close_date_prevista: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export async function listOpportunities(params: OpportunityListParams = {}): Promise<{ data: Opportunity[]; total: number }> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  let filtered = [...MOCK_OPPORTUNITIES];
  
  if (params.pipeline_id) {
    filtered = filtered.filter(o => o.pipeline_id === params.pipeline_id);
  }
  
  if (params.stage_id) {
    filtered = filtered.filter(o => o.stage_id === params.stage_id);
  }
  
  if (params.produto) {
    filtered = filtered.filter(o => o.produto === params.produto);
  }
  
  return {
    data: filtered,
    total: filtered.length,
  };
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_OPPORTUNITIES.find(o => o.id === id) || null;
}

export async function createOpportunity(dto: Partial<Opportunity>): Promise<Opportunity> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newOpp: Opportunity = {
    id: `opp-${Date.now()}`,
    account_id: dto.account_id || 'acc-default',
    pipeline_id: dto.pipeline_id || 'pipe-alugue',
    stage_id: dto.stage_id || 'stage-discovery',
    produto: dto.produto || 'ALUGUE',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...dto,
  };
  
  MOCK_OPPORTUNITIES.push(newOpp);
  return newOpp;
}

export async function advanceOpportunity(id: string, targetStageId: string): Promise<Opportunity> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const opp = MOCK_OPPORTUNITIES.find(o => o.id === id);
  if (!opp) throw new Error('Opportunity not found');
  
  opp.stage_id = targetStageId;
  opp.updated_at = new Date().toISOString();
  
  return opp;
}
