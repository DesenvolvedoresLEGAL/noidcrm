export interface DiagnosticOption {
  label: string;
  points: number;
}

export interface DiagnosticQuestion {
  id: number;
  area: string;
  areaKey: string;
  question: string;
  options: DiagnosticOption[];
  weight: number;
}

export interface DiagnosticAnswer {
  questionId: number;
  areaKey: string;
  selectedOption: number;
  points: number;
}

export interface DiagnosticScores {
  pipeline: number;
  followup: number;
  prioritization: number;
  crm: number;
  forecast: number;
  lossAnalysis: number;
  automation: number;
}

export type DiagnosticClassification = 'critical' | 'at_risk' | 'developing' | 'healthy';

export interface DiagnosticResult {
  totalScore: number;
  classification: DiagnosticClassification;
  scores: DiagnosticScores;
  answers: DiagnosticAnswer[];
}

export interface ClassificationInfo {
  key: DiagnosticClassification;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  title: string;
  message: string;
  recommendation: string;
  cta: string;
  ctaLink: string;
}
