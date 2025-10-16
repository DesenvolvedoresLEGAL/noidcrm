import { Settings } from './types';

const MOCK_SETTINGS: Record<string, any> = {
  ProdutosServicos: {
    categorias: [
      { id: 'cat-1', nome: 'ALUGUE', produtos: ['Torre', 'Painel', 'Link'] },
      { id: 'cat-2', nome: 'HUMANOID', produtos: ['SDR Agent', 'Enrichment', 'Scoring'] },
    ],
  },
  Funis: {
    pipelines: ['ALUGUE', 'HUMANOID'],
    stages: ['Discovery', 'Demo', 'Proposta', 'Negociação', 'Ganhou'],
  },
  AcoesAutomaticas: {
    triggers: [
      { id: 'trigger-1', nome: 'Lead Criado', acao: 'Enrich + Assign' },
      { id: 'trigger-2', nome: 'Proposta Enviada', acao: 'Notificar Gestão' },
    ],
  },
};

export async function getSettings(section?: string): Promise<any> {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  if (section && MOCK_SETTINGS[section]) {
    return MOCK_SETTINGS[section];
  }
  
  return MOCK_SETTINGS;
}

export async function saveSettings(section: string, payload: any): Promise<Settings> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  MOCK_SETTINGS[section] = payload;
  
  return {
    id: `setting-${Date.now()}`,
    section,
    payload,
    updated_at: new Date().toISOString(),
  };
}
