import { Opportunity, OpportunityListParams } from './types';

const MOCK_OPPORTUNITIES: any[] = [
  {
    id: '1',
    account_id: 'acc-1',
    account_name: 'Festival Rock in Rio 2025',
    contact_name: 'Maria Santos',
    contact_email: 'maria@rockinrio.com',
    contact_phone: '(21) 98765-4321',
    pipeline_id: 'pipe-alugue',
    stage_id: 'stage-discovery',
    produto: 'ALUGUE',
    valor_previsto: 150000,
    prob: 0.3,
    close_date_prevista: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meta: {
      mrr: 0,
      status: 'Indicação',
      origem: 'Indicação',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
    },
  },
  {
    id: '2',
    account_id: 'acc-2',
    account_name: 'Lollapalooza Brasil',
    contact_name: 'João Silva',
    contact_email: 'joao@lollapalooza.com.br',
    contact_phone: '(11) 99876-5432',
    contact_linkedin: 'https://linkedin.com/in/joaosilva',
    pipeline_id: 'pipe-alugue',
    stage_id: 'stage-proposal',
    produto: 'ALUGUE',
    valor_previsto: 250000,
    prob: 0.7,
    close_date_prevista: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meta: {
      mrr: 0,
      status: 'Prospecção',
      origem: 'Google ADS',
      cidade: 'São Paulo',
      uf: 'SP',
    },
  },
  {
    id: '3',
    account_id: 'acc-3',
    account_name: 'Shopping Iguatemi',
    contact_name: 'Ana Paula',
    contact_email: 'ana@iguatemi.com.br',
    contact_phone: '(11) 3456-7890',
    pipeline_id: 'pipe-humanoid',
    stage_id: 'stage-discovery',
    produto: 'HUMANOID',
    valor_previsto: 180000,
    prob: 0.5,
    close_date_prevista: new Date(Date.now() + 45 * 86400000).toISOString().split('T')[0],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    meta: {
      mrr: 5000,
      status: 'Qualificação',
      origem: 'WhatsApp',
      cidade: 'São Paulo',
      uf: 'SP',
      observacoes: 'Interessado em robô para recepção',
    },
  },
  {
    id: '4',
    account_id: 'acc-4',
    account_name: 'Casamento VIP - Marina & Carlos',
    contact_name: 'Marina Costa',
    contact_email: 'marina@evento.com',
    contact_phone: '(21) 99123-4567',
    pipeline_id: 'pipe-alugue',
    stage_id: 'stage-qualification',
    produto: 'ALUGUE',
    valor_previsto: 85000,
    prob: 0.5,
    close_date_prevista: new Date(Date.now() + 20 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    meta: {
      mrr: 0,
      status: 'Qualificação',
      origem: 'Ligação',
      cidade: 'Rio de Janeiro',
      uf: 'RJ',
    },
  },
  {
    id: '5',
    account_id: 'acc-5',
    account_name: 'Tecnisa Construtora',
    contact_name: 'Roberto Lima',
    contact_email: 'roberto@tecnisa.com',
    contact_phone: '(11) 3210-9876',
    pipeline_id: 'pipe-humanoid',
    stage_id: 'stage-proposal',
    produto: 'HUMANOID',
    valor_previsto: 320000,
    prob: 0.8,
    close_date_prevista: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
    updated_at: new Date().toISOString(),
    meta: {
      mrr: 8000,
      status: 'Negociação',
      origem: 'Indicação',
      cidade: 'São Paulo',
      uf: 'SP',
      observacoes: 'Quer 3 robôs para stands de vendas',
    },
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

export async function moveOpportunity(id: string, newStageId: string): Promise<Opportunity> {
  return advanceOpportunity(id, newStageId);
}

export async function updateOpportunityStatus(id: string, status: 'won' | 'lost'): Promise<Opportunity> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const opp = MOCK_OPPORTUNITIES.find(o => o.id === id);
  if (!opp) throw new Error('Opportunity not found');
  
  opp.meta = { ...opp.meta, status: status === 'won' ? 'Ganhou' : 'Perdeu' };
  opp.updated_at = new Date().toISOString();
  
  return opp;
}
