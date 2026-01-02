import { DiagnosticQuestion, ClassificationInfo } from "@/types/diagnostic";

export const diagnosticQuestions: DiagnosticQuestion[] = [
  {
    id: 1,
    area: "Gestão de Pipeline",
    areaKey: "pipeline",
    question: "Qual é a sua visibilidade atual sobre o pipeline de vendas?",
    weight: 15,
    options: [
      { label: "Não temos pipeline estruturado ou cada vendedor controla o seu", points: 0 },
      { label: "Temos um pipeline básico em planilhas ou CRM simples", points: 5 },
      { label: "Pipeline centralizado no CRM com etapas definidas", points: 10 },
      { label: "Pipeline completo com métricas em tempo real e alertas automáticos", points: 15 },
    ],
  },
  {
    id: 2,
    area: "Follow-up e Cadência",
    areaKey: "followup",
    question: "Como sua equipe gerencia follow-ups com leads e oportunidades?",
    weight: 15,
    options: [
      { label: "Cada vendedor decide quando e como fazer follow-up", points: 0 },
      { label: "Temos lembretes manuais, mas não há cadência definida", points: 5 },
      { label: "Cadências padronizadas com templates e sequências", points: 10 },
      { label: "Follow-ups automatizados com IA que adapta timing e conteúdo", points: 15 },
    ],
  },
  {
    id: 3,
    area: "Priorização de Leads",
    areaKey: "prioritization",
    question: "Como vocês priorizam quais leads ou oportunidades trabalhar primeiro?",
    weight: 15,
    options: [
      { label: "Por ordem de chegada ou intuição do vendedor", points: 0 },
      { label: "Regras simples como tamanho da empresa ou origem", points: 5 },
      { label: "Lead scoring baseado em critérios de fit e engajamento", points: 10 },
      { label: "Scoring preditivo com IA que combina fit + intent + timing", points: 15 },
    ],
  },
  {
    id: 4,
    area: "Uso do CRM",
    areaKey: "crm",
    question: "Qual é o nível de adoção e uso do CRM pela equipe de vendas?",
    weight: 15,
    options: [
      { label: "Não usamos CRM ou uso é muito baixo", points: 0 },
      { label: "Uso parcial, dados incompletos e desatualizados", points: 5 },
      { label: "Boa adoção, mas dependemos de entrada manual", points: 10 },
      { label: "Adoção total com automações que capturam dados automaticamente", points: 15 },
    ],
  },
  {
    id: 5,
    area: "Previsibilidade de Receita",
    areaKey: "forecast",
    question: "Qual a precisão das suas previsões de vendas (forecast)?",
    weight: 15,
    options: [
      { label: "Não fazemos forecast ou é puro chute", points: 0 },
      { label: "Forecast baseado em feeling dos vendedores, erro > 30%", points: 5 },
      { label: "Forecast com metodologia, mas ainda com 15-30% de erro", points: 10 },
      { label: "Forecast preciso (< 15% erro) com análise de probabilidade por deal", points: 15 },
    ],
  },
  {
    id: 6,
    area: "Análise de Perdas",
    areaKey: "lossAnalysis",
    question: "Vocês sabem exatamente por que perdem vendas?",
    weight: 15,
    options: [
      { label: "Não rastreamos motivos de perda", points: 0 },
      { label: "Campo de motivo no CRM, mas pouco preenchido", points: 5 },
      { label: "Motivos categorizados e analisados mensalmente", points: 10 },
      { label: "Análise profunda com padrões identificados e ações corretivas", points: 15 },
    ],
  },
  {
    id: 7,
    area: "Automação e IA",
    areaKey: "automation",
    question: "Qual o nível de automação e uso de IA na sua operação de vendas?",
    weight: 10,
    options: [
      { label: "Tudo é manual, sem automações", points: 0 },
      { label: "Automações básicas (emails agendados, lembretes)", points: 3 },
      { label: "Workflows automatizados para tarefas repetitivas", points: 7 },
      { label: "IA integrada para scoring, insights e recomendações", points: 10 },
    ],
  },
];

export const classificationInfos: ClassificationInfo[] = [
  {
    key: "critical",
    label: "Crítico",
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    borderColor: "border-red-500/30",
    icon: "AlertTriangle",
    title: "Operação em Estado Crítico",
    message: "Sua operação de vendas está vulnerável a vazamentos significativos de receita. Decisões estão sendo tomadas sem dados, e oportunidades estão sendo perdidas diariamente.",
    recommendation: "Você precisa de uma intervenção imediata. Recomendamos um diagnóstico consultivo gratuito para mapear os pontos críticos e criar um plano de ação.",
    cta: "Agendar diagnóstico consultivo gratuito",
    ctaLink: "#contato",
  },
  {
    key: "at_risk",
    label: "Em Risco",
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-500/30",
    icon: "AlertCircle",
    title: "Operação em Risco",
    message: "Você tem processos básicos, mas ainda existem lacunas importantes que estão custando receita. A falta de automação e visibilidade está limitando seu crescimento.",
    recommendation: "Veja como o NOID pode proteger sua operação e eliminar os vazamentos de receita identificados.",
    cta: "Ver como NOID protege operações",
    ctaLink: "#solucao",
  },
  {
    key: "developing",
    label: "Em Desenvolvimento",
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    icon: "TrendingUp",
    title: "Operação em Desenvolvimento",
    message: "Sua operação tem boas bases, mas ainda há espaço para otimização. Com as ferramentas certas, você pode acelerar significativamente seus resultados.",
    recommendation: "Conheça o NOID RevenueOS e veja como podemos levar sua operação para o próximo nível.",
    cta: "Conhecer NOID RevenueOS",
    ctaLink: "#solucao",
  },
  {
    key: "healthy",
    label: "Operação Saudável",
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/30",
    icon: "CheckCircle",
    title: "Operação Saudável",
    message: "Parabéns! Sua operação está madura e bem estruturada. Você está no caminho certo para maximizar sua receita.",
    recommendation: "Explore o plano Autônomo do NOID para automação completa com IA e escalar ainda mais.",
    cta: "Explorar plano Autônomo",
    ctaLink: "#planos",
  },
];

export const getClassificationInfo = (score: number): ClassificationInfo => {
  if (score <= 25) return classificationInfos[0]; // critical
  if (score <= 50) return classificationInfos[1]; // at_risk
  if (score <= 75) return classificationInfos[2]; // developing
  return classificationInfos[3]; // healthy
};
