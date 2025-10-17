// Insights Service - Mock implementation

export interface PredictiveData {
  goalAchievementProbability: number; // 0-100
  trend: 'up' | 'down' | 'stable';
  opportunitiesAtRisk: number;
  hotOpportunities: number;
  suggestedActions: string[];
}

export interface PerformanceData {
  metrics: {
    conversionRate: { user: number; teamAvg: number };
    avgClosingTime: { user: number; teamAvg: number };
    avgTicket: { user: number; teamAvg: number };
    activitiesPerOpp: { user: number; teamAvg: number };
  };
  badge: 'bronze' | 'silver' | 'gold' | 'platinum';
  ranking: number;
  totalUsers: number;
}

export interface SalesTip {
  id: string;
  category: 'closing' | 'objection' | 'prospecting' | 'negotiation';
  title: string;
  description: string;
  example: string;
  learnMoreUrl?: string;
}

export interface EITip {
  id: string;
  pillar: 'self-awareness' | 'self-management' | 'empathy' | 'relationship';
  title: string;
  content: string;
  actionable: string;
  dayNumber: number;
}

export interface GoalStrategyData {
  monthGoal: number;
  closedToDate: number;
  remaining: number;
  businessDaysLeft: number;
  dailyGoalNeeded: number;
  recommendations: string[];
  onTrack: boolean;
}

export interface Pattern {
  id: string;
  type: 'time' | 'source' | 'behavior' | 'segment';
  insight: string;
  impact: 'high' | 'medium' | 'low';
  icon: string;
}

export interface Training {
  id: string;
  title: string;
  duration: number;
  level: 'beginner' | 'intermediate' | 'advanced';
  completed: boolean;
  category: string;
  description: string;
}

export interface RiskOpportunity {
  id: string;
  name: string;
  value: number;
  daysInStage: number;
  lastContactDays: number;
  riskLevel: 'high' | 'medium' | 'low';
  suggestedAction: string;
  stage: string;
}

// Mock data
const MOCK_SALES_TIPS: SalesTip[] = [
  {
    id: '1',
    category: 'closing',
    title: 'Técnica do Fechamento Alternativo',
    description: 'Ao invés de perguntar "Você quer comprar?", ofereça duas opções positivas para o cliente escolher.',
    example: '"Prefere começar na segunda ou na quarta-feira?" ao invés de "Quer começar quando?"',
    learnMoreUrl: '#'
  },
  {
    id: '2',
    category: 'objection',
    title: 'Validação da Objeção',
    description: 'Quando o cliente apresenta uma objeção, valide o sentimento dele antes de responder.',
    example: '"Entendo sua preocupação com o investimento. Muitos clientes pensaram assim no início..."',
    learnMoreUrl: '#'
  },
  {
    id: '3',
    category: 'prospecting',
    title: 'Regra dos 3 Toques',
    description: 'Combine 3 canais diferentes (email, telefone, LinkedIn) nas primeiras 48h de prospecção.',
    example: 'Email manhã → Ligação tarde → LinkedIn mensagem no dia seguinte',
    learnMoreUrl: '#'
  },
  {
    id: '4',
    category: 'negotiation',
    title: 'Ancoragem de Valor',
    description: 'Sempre apresente o valor total antes de discutir condições de pagamento.',
    example: '"O investimento é R$ 50.000. Temos opções de parcelamento que facilitam..."',
    learnMoreUrl: '#'
  }
];

const MOCK_EI_TIPS: EITip[] = [
  {
    id: '1',
    pillar: 'self-awareness',
    title: 'Identifique Seus Gatilhos',
    content: 'Quais situações em vendas te deixam ansioso ou frustrado? Reconhecer seus gatilhos emocionais é o primeiro passo para gerenciá-los.',
    actionable: 'Hoje, anote em um papel 3 situações que te tiraram do centro. Identifique o padrão.',
    dayNumber: 1
  },
  {
    id: '2',
    pillar: 'self-management',
    title: 'Técnica da Respiração 4-7-8',
    content: 'Antes de uma ligação importante, pratique: inspire por 4 segundos, segure por 7, expire por 8.',
    actionable: 'Faça este exercício 3x antes da sua próxima reunião ou call importante.',
    dayNumber: 2
  },
  {
    id: '3',
    pillar: 'empathy',
    title: 'Escuta Ativa com Espelhamento',
    content: 'Nas conversas com clientes, repita as últimas 2-3 palavras que ele disse para demonstrar atenção.',
    actionable: 'Cliente: "Estou preocupado com o prazo." Você: "Preocupado com o prazo... conte mais."',
    dayNumber: 3
  },
  {
    id: '4',
    pillar: 'relationship',
    title: 'Construa Rapport com Similaridades',
    content: 'Pessoas confiam mais em quem é parecido com elas. Identifique pontos em comum logo no início.',
    actionable: 'Pesquise o LinkedIn do cliente antes da reunião. Procure hobbies, formação, conexões em comum.',
    dayNumber: 4
  }
];

const MOCK_PATTERNS: Pattern[] = [
  {
    id: '1',
    type: 'time',
    insight: 'Suas melhores conversões acontecem às terças-feiras, entre 14h-16h',
    impact: 'high',
    icon: 'Clock'
  },
  {
    id: '2',
    type: 'source',
    insight: 'Oportunidades de origem "Indicação" têm 67% mais chance de fechar',
    impact: 'high',
    icon: 'Users'
  },
  {
    id: '3',
    type: 'behavior',
    insight: 'Você fecha 2x mais rápido quando agenda demo na primeira ligação',
    impact: 'high',
    icon: 'Zap'
  },
  {
    id: '4',
    type: 'segment',
    insight: 'Clientes do setor "Saúde" demoram 18 dias a mais que a média para fechar',
    impact: 'medium',
    icon: 'TrendingDown'
  },
  {
    id: '5',
    type: 'behavior',
    insight: 'Follow-ups após 3 dias de silêncio têm taxa de resposta 40% menor',
    impact: 'medium',
    icon: 'AlertCircle'
  }
];

const MOCK_TRAININGS: Training[] = [
  {
    id: '1',
    title: 'Como fazer perguntas poderosas',
    duration: 12,
    level: 'beginner',
    completed: false,
    category: 'Prospecção',
    description: 'Aprenda a fazer perguntas que revelam as verdadeiras necessidades do cliente.'
  },
  {
    id: '2',
    title: 'Técnica SPIN Selling aplicada',
    duration: 18,
    level: 'intermediate',
    completed: false,
    category: 'Descoberta',
    description: 'Domine a técnica de vendas consultiva mais eficaz do mercado.'
  },
  {
    id: '3',
    title: 'Negociação ganha-ganha',
    duration: 15,
    level: 'intermediate',
    completed: true,
    category: 'Negociação',
    description: 'Estratégias para negociar valor sem queimar margem.'
  },
  {
    id: '4',
    title: 'Construindo urgência sem pressão',
    duration: 10,
    level: 'advanced',
    completed: false,
    category: 'Fechamento',
    description: 'Como acelerar o ciclo de vendas de forma natural e consultiva.'
  },
  {
    id: '5',
    title: 'Gestão de objeções complexas',
    duration: 20,
    level: 'advanced',
    completed: false,
    category: 'Objeções',
    description: 'Técnicas avançadas para lidar com as objeções mais difíceis.'
  }
];

// Service functions
export async function getPredictiveAnalysis(userId?: string): Promise<PredictiveData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return {
    goalAchievementProbability: 73,
    trend: 'up',
    opportunitiesAtRisk: 4,
    hotOpportunities: 7,
    suggestedActions: [
      'Priorize contato com Hospital Sírio-Libanês (R$ 145.000)',
      'Agende follow-up com Natura Cosméticos em até 2 dias',
      'Avance Americanas S.A. para proposta - está há 12 dias em negociação'
    ]
  };
}

export async function getPerformanceComparison(userId?: string): Promise<PerformanceData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  return {
    metrics: {
      conversionRate: { user: 35, teamAvg: 28 },
      avgClosingTime: { user: 23, teamAvg: 31 },
      avgTicket: { user: 48500, teamAvg: 42000 },
      activitiesPerOpp: { user: 8.2, teamAvg: 6.5 }
    },
    badge: 'gold',
    ranking: 3,
    totalUsers: 15
  };
}

export async function getSalesTips(): Promise<SalesTip[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_SALES_TIPS;
}

export async function getEmotionalIntelligenceTips(): Promise<EITip[]> {
  await new Promise(resolve => setTimeout(resolve, 200));
  return MOCK_EI_TIPS;
}

export async function getGoalStrategy(userId?: string): Promise<GoalStrategyData> {
  await new Promise(resolve => setTimeout(resolve, 300));
  
  const monthGoal = 150000;
  const closedToDate = 87000;
  const remaining = monthGoal - closedToDate;
  const businessDaysLeft = 12;
  const dailyGoalNeeded = Math.round(remaining / businessDaysLeft);
  
  return {
    monthGoal,
    closedToDate,
    remaining,
    businessDaysLeft,
    dailyGoalNeeded,
    onTrack: closedToDate / monthGoal >= 0.55,
    recommendations: [
      'Com sua taxa de conversão de 35%, você precisa trabalhar 4 oportunidades/dia',
      'Priorize oportunidades acima de R$ 8.000 para otimizar tempo',
      'Agende 2 follow-ups hoje para acelerar pipeline',
      'Foque em avançar as 3 maiores oportunidades em negociação'
    ]
  };
}

export async function getPatternAnalysis(userId?: string): Promise<Pattern[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_PATTERNS;
}

export async function getRecommendedTrainings(userId?: string): Promise<Training[]> {
  await new Promise(resolve => setTimeout(resolve, 300));
  return MOCK_TRAININGS;
}

export async function getRiskOpportunities(userId?: string): Promise<RiskOpportunity[]> {
  await new Promise(resolve => setTimeout(resolve, 400));
  
  return [
    {
      id: 'opp-1',
      name: 'Banco do Brasil - Expansão Regional',
      value: 89000,
      daysInStage: 15,
      lastContactDays: 8,
      riskLevel: 'high',
      suggestedAction: 'Agendar reunião urgente para entender bloqueios',
      stage: 'Negociação'
    },
    {
      id: 'opp-2',
      name: 'Ambev - Projeto Logística',
      value: 125000,
      daysInStage: 9,
      lastContactDays: 5,
      riskLevel: 'medium',
      suggestedAction: 'Enviar proposta atualizada com ajustes discutidos',
      stage: 'Proposta'
    },
    {
      id: 'opp-3',
      name: 'Natura Cosméticos',
      value: 67000,
      daysInStage: 12,
      lastContactDays: 6,
      riskLevel: 'medium',
      suggestedAction: 'Follow-up para definir próximos passos',
      stage: 'Qualificação'
    },
    {
      id: 'opp-4',
      name: 'Magazine Luiza Tech',
      value: 52000,
      daysInStage: 6,
      lastContactDays: 4,
      riskLevel: 'low',
      suggestedAction: 'Manter contato regular, processo dentro do normal',
      stage: 'Descoberta'
    }
  ];
}
