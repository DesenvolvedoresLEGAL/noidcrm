import { Activity, ActivityListParams } from './types';
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth, isAfter, isBefore, isToday, parseISO } from 'date-fns';

const MOCK_ACTIVITIES: Activity[] = [
  // Atividades atrasadas
  {
    id: 'act-1',
    title: 'Follow-up ALUGUE - Evento Corporativo',
    description: 'Cliente demonstrou interesse no produto ALUGUE para evento corporativo.',
    type: 'call',
    status: 'pending',
    scheduled_date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
    scheduled_time: '14:00',
    duration_minutes: 30,
    opportunity_id: '1',
    account_id: 'acc-1',
    contact_id: 'cnt-1',
    assigned_to: 'user-1',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'act-2',
    title: 'Reunião de alinhamento - Lollapalooza',
    description: 'Agendar reunião de apresentação após envio da proposta.',
    type: 'meeting',
    status: 'pending',
    scheduled_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    scheduled_time: '10:00',
    duration_minutes: 60,
    opportunity_id: '2',
    account_id: 'acc-2',
    assigned_to: 'user-2',
    reminder_enabled: true,
    reminder_minutes_before: 15,
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  // Atividades de hoje
  {
    id: 'act-3',
    title: 'Enviar proposta técnica - HUMANOID',
    description: 'Enviar proposta com detalhamento técnico dos robôs.',
    type: 'email',
    status: 'pending',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '09:00',
    duration_minutes: 15,
    opportunity_id: '3',
    account_id: 'acc-3',
    assigned_to: 'user-1',
    created_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'act-4',
    title: 'Demo produto - Tecnisa',
    description: 'Demonstração do HUMANOID in loco no escritório da Tecnisa.',
    type: 'meeting',
    status: 'pending',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '15:00',
    duration_minutes: 90,
    opportunity_id: '5',
    account_id: 'acc-5',
    contact_id: 'cnt-5',
    assigned_to: 'user-1',
    participants: ['user-2', 'user-3'],
    reminder_enabled: true,
    reminder_minutes_before: 30,
    created_at: new Date().toISOString(),
  },
  {
    id: 'act-5',
    title: 'WhatsApp follow-up - Cronograma de entrega',
    description: 'Cliente solicitou informações sobre cronograma de entrega dos robôs.',
    type: 'whatsapp',
    status: 'pending',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '16:30',
    duration_minutes: 10,
    opportunity_id: '3',
    assigned_to: 'user-2',
    created_at: new Date().toISOString(),
  },
  // Atividades dessa semana
  {
    id: 'act-6',
    title: 'Ligação de prospecção - Novo lead',
    description: 'Primeira ligação de qualificação com novo lead.',
    type: 'call',
    status: 'pending',
    scheduled_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    scheduled_time: '11:00',
    duration_minutes: 20,
    assigned_to: 'user-2',
    created_at: new Date().toISOString(),
  },
  {
    id: 'act-7',
    title: 'Revisar proposta comercial - Ajustes solicitados',
    description: 'Cliente solicitou ajustes na proposta comercial.',
    type: 'task',
    status: 'pending',
    scheduled_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    scheduled_time: '09:00',
    duration_minutes: 45,
    opportunity_id: '1',
    assigned_to: 'user-1',
    created_at: new Date().toISOString(),
  },
  {
    id: 'act-8',
    title: 'Reunião de negociação - Condições comerciais',
    description: 'Negociar condições comerciais após feedback positivo da demo.',
    type: 'meeting',
    status: 'pending',
    scheduled_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    scheduled_time: '14:00',
    duration_minutes: 60,
    opportunity_id: '2',
    account_id: 'acc-2',
    contact_id: 'cnt-2',
    assigned_to: 'user-1',
    created_at: new Date().toISOString(),
  },
  // Atividades desse mês
  {
    id: 'act-9',
    title: 'Apresentação final - Congresso Nacional',
    description: 'Apresentação do produto ALUGUE para equipe do evento.',
    type: 'meeting',
    status: 'pending',
    scheduled_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    scheduled_time: '10:00',
    duration_minutes: 120,
    opportunity_id: '6',
    account_id: 'acc-6',
    assigned_to: 'user-3',
    participants: ['user-1'],
    created_at: new Date().toISOString(),
  },
  {
    id: 'act-10',
    title: 'Email de follow-up - Aguardando resposta',
    description: 'Cliente precisa alinhar internamente antes de dar retorno.',
    type: 'email',
    status: 'pending',
    scheduled_date: new Date(Date.now() + 10 * 86400000).toISOString().split('T')[0],
    scheduled_time: '08:00',
    duration_minutes: 10,
    opportunity_id: '4',
    assigned_to: 'user-2',
    created_at: new Date().toISOString(),
  },
  // Atividades concluídas
  {
    id: 'act-11',
    title: 'Primeira ligação - Qualificação de lead',
    description: 'Ligação inicial bem-sucedida, lead qualificado.',
    type: 'call',
    status: 'completed',
    scheduled_date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
    scheduled_time: '15:00',
    duration_minutes: 25,
    completed_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    assigned_to: 'user-1',
    sentiment: 'positive',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
  {
    id: 'act-12',
    title: 'Visita técnica - Site Tecnisa',
    description: 'Visita técnica ao site da Tecnisa. Apresentação do HUMANOID in loco.',
    type: 'meeting',
    status: 'completed',
    scheduled_date: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
    scheduled_time: '14:00',
    duration_minutes: 120,
    completed_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    opportunity_id: '5',
    account_id: 'acc-5',
    assigned_to: 'user-1',
    sentiment: 'very_positive',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  // Atividades no-show
  {
    id: 'act-13',
    title: 'Reunião de apresentação - Cliente não compareceu',
    description: 'Reunião agendada mas cliente não compareceu.',
    type: 'meeting',
    status: 'no_show',
    scheduled_date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
    scheduled_time: '11:00',
    duration_minutes: 60,
    opportunity_id: '4',
    assigned_to: 'user-2',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

export async function listActivities(params?: ActivityListParams): Promise<{
  activities: Activity[];
  total: number;
  page: number;
  page_size: number;
}> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  let filtered = [...MOCK_ACTIVITIES];
  
  // Filtro de busca
  if (params?.q) {
    const q = params.q.toLowerCase();
    filtered = filtered.filter(a => 
      a.title.toLowerCase().includes(q) ||
      a.description?.toLowerCase().includes(q)
    );
  }
  
  // Filtro por status
  if (params?.status) {
    filtered = filtered.filter(a => a.status === params.status);
  }
  
  // Filtro por tipo
  if (params?.type) {
    filtered = filtered.filter(a => a.type === params.type);
  }
  
  // Filtro por responsável
  if (params?.assigned_to) {
    filtered = filtered.filter(a => a.assigned_to === params.assigned_to);
  }
  
  // Filtro por oportunidade
  if (params?.opportunity_id) {
    filtered = filtered.filter(a => a.opportunity_id === params.opportunity_id);
  }
  
  // Filtros de data
  if (params?.filter) {
    const now = new Date();
    filtered = filtered.filter(a => {
      if (!a.scheduled_date) return false;
      const activityDate = parseISO(a.scheduled_date);
      
      switch (params.filter) {
        case 'overdue':
          return isBefore(activityDate, now) && a.status === 'pending';
        case 'today':
          return isToday(activityDate);
        case 'this_week':
          return activityDate >= startOfWeek(now) && activityDate <= endOfWeek(now);
        case 'this_month':
          return activityDate >= startOfMonth(now) && activityDate <= endOfMonth(now);
        case 'scheduled':
          return isAfter(activityDate, now) && a.status === 'pending';
        default:
          return true;
      }
    });
  }
  
  // Ordenar por data (mais recente primeiro para atrasadas, depois por data agendada)
  filtered.sort((a, b) => {
    if (!a.scheduled_date) return 1;
    if (!b.scheduled_date) return -1;
    return new Date(a.scheduled_date + ' ' + (a.scheduled_time || '00:00')).getTime() - 
           new Date(b.scheduled_date + ' ' + (b.scheduled_time || '00:00')).getTime();
  });
  
  const total = filtered.length;
  const page = params?.page || 1;
  const page_size = params?.page_size || 20;
  const start = (page - 1) * page_size;
  const end = start + page_size;
  
  return {
    activities: filtered.slice(start, end),
    total,
    page,
    page_size,
  };
}

export async function getActivity(id: string): Promise<Activity | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_ACTIVITIES.find(a => a.id === id) || null;
}

export async function createActivity(dto: Partial<Activity>): Promise<Activity> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newActivity: Activity = {
    id: `act-${Date.now()}`,
    title: dto.title || 'Nova atividade',
    type: dto.type || 'task',
    status: dto.status || 'pending',
    created_at: new Date().toISOString(),
    ...dto,
  };
  
  MOCK_ACTIVITIES.push(newActivity);
  return newActivity;
}

export async function updateActivity(id: string, dto: Partial<Activity>): Promise<Activity> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const index = MOCK_ACTIVITIES.findIndex(a => a.id === id);
  if (index === -1) throw new Error('Activity not found');
  
  MOCK_ACTIVITIES[index] = {
    ...MOCK_ACTIVITIES[index],
    ...dto,
    updated_at: new Date().toISOString(),
  };
  
  return MOCK_ACTIVITIES[index];
}

export async function deleteActivity(id: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 200));
  const index = MOCK_ACTIVITIES.findIndex(a => a.id === id);
  if (index !== -1) {
    MOCK_ACTIVITIES.splice(index, 1);
  }
}

export async function completeActivity(id: string): Promise<Activity> {
  return updateActivity(id, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });
}

export async function markActivityAsNoShow(id: string): Promise<Activity> {
  return updateActivity(id, {
    status: 'no_show',
  });
}

export async function getActivityStats(): Promise<{
  overdue: number;
  today: number;
  thisWeek: number;
  thisMonth: number;
  scheduled: number;
}> {
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const now = new Date();
  
  return {
    overdue: MOCK_ACTIVITIES.filter(a => 
      a.scheduled_date && 
      isBefore(parseISO(a.scheduled_date), now) && 
      a.status === 'pending'
    ).length,
    today: MOCK_ACTIVITIES.filter(a => 
      a.scheduled_date && isToday(parseISO(a.scheduled_date))
    ).length,
    thisWeek: MOCK_ACTIVITIES.filter(a => 
      a.scheduled_date && 
      parseISO(a.scheduled_date) >= startOfWeek(now) && 
      parseISO(a.scheduled_date) <= endOfWeek(now)
    ).length,
    thisMonth: MOCK_ACTIVITIES.filter(a => 
      a.scheduled_date && 
      parseISO(a.scheduled_date) >= startOfMonth(now) && 
      parseISO(a.scheduled_date) <= endOfMonth(now)
    ).length,
    scheduled: MOCK_ACTIVITIES.filter(a => 
      a.scheduled_date && 
      isAfter(parseISO(a.scheduled_date), now) && 
      a.status === 'pending'
    ).length,
  };
}
