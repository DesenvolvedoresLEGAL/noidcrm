import { Activity } from './types';

const MOCK_ACTIVITIES: Activity[] = [
  {
    id: 'act-1',
    opportunity_id: '1',
    type: 'call',
    channel: 'phone',
    direction: 'outbound',
    duration_seconds: 420,
    sentiment: 'positive',
    resumo: 'Cliente demonstrou interesse no produto ALUGUE para evento corporativo.',
    next_step: 'Enviar proposta comercial',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'act-2',
    opportunity_id: '2',
    type: 'email',
    channel: 'email',
    direction: 'outbound',
    resumo: 'Enviada proposta técnica com detalhamento de funcionalidades.',
    next_step: 'Agendar reunião de apresentação',
    created_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'act-3',
    opportunity_id: '2',
    type: 'meeting',
    channel: 'video',
    duration_seconds: 1800,
    sentiment: 'very_positive',
    resumo: 'Reunião de apresentação do Lollapalooza. Equipe muito engajada.',
    next_step: 'Negociar condições comerciais',
    created_at: new Date(Date.now() - 259200000).toISOString(),
  },
  {
    id: 'act-4',
    opportunity_id: '3',
    type: 'whatsapp',
    channel: 'whatsapp',
    direction: 'inbound',
    resumo: 'Cliente solicitou informações sobre cronograma de entrega dos robôs.',
    next_step: 'Enviar cronograma detalhado',
    created_at: new Date(Date.now() - 43200000).toISOString(),
  },
  {
    id: 'act-5',
    opportunity_id: '4',
    type: 'call',
    channel: 'phone',
    direction: 'outbound',
    duration_seconds: 600,
    sentiment: 'neutral',
    resumo: 'Follow-up sobre proposta enviada. Cliente precisa alinhar internamente.',
    next_step: 'Ligar novamente em 3 dias',
    created_at: new Date(Date.now() - 345600000).toISOString(),
  },
  {
    id: 'act-6',
    opportunity_id: '5',
    type: 'meeting',
    channel: 'in_person',
    duration_seconds: 3600,
    sentiment: 'very_positive',
    resumo: 'Visita técnica ao site da Tecnisa. Apresentação do HUMANOID in loco.',
    next_step: 'Enviar proposta final com valores negociados',
    created_at: new Date(Date.now() - 518400000).toISOString(),
  },
  {
    id: 'act-7',
    opportunity_id: '1',
    type: 'email',
    channel: 'email',
    direction: 'inbound',
    resumo: 'Cliente solicitou ajustes na proposta comercial.',
    next_step: 'Revisar proposta e reenviar',
    created_at: new Date(Date.now() - 21600000).toISOString(),
  },
  {
    id: 'act-8',
    opportunity_id: '6',
    type: 'meeting',
    channel: 'video',
    duration_seconds: 2400,
    sentiment: 'positive',
    resumo: 'Demo do produto ALUGUE para equipe do Congresso Nacional de Tecnologia.',
    next_step: 'Aguardar feedback da equipe',
    created_at: new Date(Date.now() - 691200000).toISOString(),
  },
];

export async function listActivities(opportunityId?: string): Promise<Activity[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  if (opportunityId) {
    return MOCK_ACTIVITIES.filter(a => a.opportunity_id === opportunityId);
  }
  
  return MOCK_ACTIVITIES;
}

export async function getActivity(id: string): Promise<Activity | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_ACTIVITIES.find(a => a.id === id) || null;
}

export async function createActivity(dto: Partial<Activity>): Promise<Activity> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newActivity: Activity = {
    id: `act-${Date.now()}`,
    type: dto.type || 'note',
    created_at: new Date().toISOString(),
    ...dto,
  };
  
  MOCK_ACTIVITIES.push(newActivity);
  return newActivity;
}
