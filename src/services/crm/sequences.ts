import { Sequence } from './types';

const MOCK_SEQUENCES: Sequence[] = [
  {
    id: 'seq-1',
    name: 'Follow-up Pós-Demo ALUGUE',
    audience: 'Leads que realizaram demo do ALUGUE',
    objective: 'Qualificação de Leads',
    steps: {
      steps: [
        {
          id: 'step-1',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Obrigado por conhecer o ALUGUE!',
            body: 'Olá! Foi um prazer apresentar nossa solução...',
          },
        },
        {
          id: 'step-2',
          type: 'wait',
          delay: 2,
          content: { days: 2 },
        },
        {
          id: 'step-3',
          type: 'whatsapp',
          delay: 2,
          content: {
            message: 'Oi! Tudo bem? Gostaria de tirar alguma dúvida sobre o ALUGUE?',
          },
        },
        {
          id: 'step-4',
          type: 'wait',
          delay: 3,
          content: { days: 3 },
        },
        {
          id: 'step-5',
          type: 'task',
          delay: 5,
          content: {
            title: 'Ligação de follow-up',
            description: 'Realizar ligação para entender interesse',
          },
        },
      ],
    },
    created_by: 'user-demo',
    created_at: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'seq-2',
    name: 'Nutrição de Leads HUMANOID',
    audience: 'Leads interessados em robôs',
    objective: 'Educação e Engajamento',
    steps: {
      steps: [
        {
          id: 'step-1',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Conheça os benefícios do HUMANOID',
            body: 'Descubra como nossos robôs podem transformar seu negócio...',
          },
        },
        {
          id: 'step-2',
          type: 'wait',
          delay: 3,
          content: { days: 3 },
        },
        {
          id: 'step-3',
          type: 'email',
          delay: 3,
          content: {
            subject: 'Cases de sucesso HUMANOID',
            body: 'Veja como empresas líderes estão usando nossos robôs...',
          },
        },
        {
          id: 'step-4',
          type: 'wait',
          delay: 5,
          content: { days: 5 },
        },
        {
          id: 'step-5',
          type: 'task',
          delay: 8,
          content: {
            title: 'Propor demonstração',
            description: 'Enviar convite para demo presencial',
          },
        },
      ],
    },
    created_by: 'user-demo',
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'seq-3',
    name: 'Reativação de Leads Inativos',
    audience: 'Leads sem interação há 30+ dias',
    objective: 'Reengajamento',
    steps: {
      steps: [
        {
          id: 'step-1',
          type: 'email',
          delay: 0,
          content: {
            subject: 'Sentimos sua falta!',
            body: 'Notamos que faz um tempo desde nosso último contato...',
          },
        },
        {
          id: 'step-2',
          type: 'wait',
          delay: 4,
          content: { days: 4 },
        },
        {
          id: 'step-3',
          type: 'whatsapp',
          delay: 4,
          content: {
            message: 'Olá! Podemos ajudar com algo? Temos novidades!',
          },
        },
      ],
    },
    created_by: 'user-demo',
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
];

export async function listSequences(): Promise<Sequence[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_SEQUENCES;
}

export async function getSequence(id: string): Promise<Sequence | null> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_SEQUENCES.find(s => s.id === id) || null;
}

export async function createSequence(dto: Partial<Sequence>): Promise<Sequence> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const newSequence: Sequence = {
    id: `seq-${Date.now()}`,
    name: dto.name || 'Nova Cadência',
    audience: dto.audience,
    objective: dto.objective,
    steps: dto.steps || { steps: [] },
    created_by: 'user-demo',
    created_at: new Date().toISOString(),
  };
  
  MOCK_SEQUENCES.push(newSequence);
  return newSequence;
}

export async function updateSequence(id: string, dto: Partial<Sequence>): Promise<Sequence> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const seq = MOCK_SEQUENCES.find(s => s.id === id);
  if (!seq) throw new Error('Sequence not found');
  
  Object.assign(seq, dto);
  return seq;
}

export async function deleteSequence(id: string): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const index = MOCK_SEQUENCES.findIndex(s => s.id === id);
  if (index !== -1) {
    MOCK_SEQUENCES.splice(index, 1);
  }
}
