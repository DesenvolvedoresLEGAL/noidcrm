export interface ReleaseNote {
  id: string;
  version: string;
  title: string;
  description: string;
  type: 'feature' | 'improvement' | 'fix';
  date: string;
  imageUrl?: string;
}

export const releaseNotes: ReleaseNote[] = [
  {
    id: 'rn-001',
    version: '2.5.0',
    title: 'Centro de Notificações Redesenhado',
    description: 'Novo centro de notificações com abas separadas para alertas do sistema e novidades do produto.',
    type: 'feature',
    date: '2024-12-05',
  },
  {
    id: 'rn-002',
    version: '2.4.2',
    title: 'AI Deal Score Aprimorado',
    description: 'Insights de IA agora incluem análise de fatores positivos e negativos com recomendações personalizadas.',
    type: 'improvement',
    date: '2024-12-03',
  },
  {
    id: 'rn-003',
    version: '2.4.1',
    title: 'Sincronização de Propostas',
    description: 'Valores de propostas agora sincronizam automaticamente com oportunidades vinculadas.',
    type: 'fix',
    date: '2024-12-01',
  },
  {
    id: 'rn-004',
    version: '2.4.0',
    title: 'Missões Diárias e Semanais',
    description: 'Sistema de gamificação com missões que recompensam atividades diárias e conquistas semanais.',
    type: 'feature',
    date: '2024-11-28',
  },
  {
    id: 'rn-005',
    version: '2.3.5',
    title: 'Gestão de Times',
    description: 'Gestores agora podem visualizar e gerenciar apenas dados da sua equipe com dashboard exclusivo.',
    type: 'feature',
    date: '2024-11-25',
  },
];
