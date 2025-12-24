import { useState, useEffect } from 'react';
import { useSupabaseAuth } from './useSupabaseAuth';

const TOUR_STORAGE_KEY = 'noid_sidebar_tour_completed';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  target: string; // data-tour attribute value
  position: 'top' | 'bottom' | 'left' | 'right';
}

export const SIDEBAR_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Bem-vindo ao NOID CRM! 🎉',
    description: 'Vamos fazer um tour rápido pelo menu para você conhecer todas as funcionalidades disponíveis.',
    target: 'sidebar-header',
    position: 'right',
  },
  {
    id: 'principal',
    title: 'Navegação Principal',
    description: 'Dashboard é sua visão geral e Pipeline mostra todas as oportunidades de vendas em andamento.',
    target: 'section-principal',
    position: 'right',
  },
  {
    id: 'gestao',
    title: 'Gestão',
    description: 'Gerencie suas Atividades, Contas de clientes, Contratos, Forecast e Relatórios do dia-a-dia.',
    target: 'section-gestao',
    position: 'right',
  },
  {
    id: 'inteligencia',
    title: 'Inteligência',
    description: 'Ferramentas de IA: Insights automáticos, Knowledge Graph, Memórias, Playbooks, Scoring inteligente, Vibe Selling e análise Win/Loss.',
    target: 'section-inteligencia',
    position: 'right',
  },
  {
    id: 'objetivos',
    title: 'Objetivos',
    description: 'Configure metas de vendas, acompanhe Resultados e pratique com Roleplay de IA para aprimorar suas habilidades.',
    target: 'section-objetivos',
    position: 'right',
  },
  {
    id: 'gtm',
    title: 'GTM (Go-to-Market)',
    description: 'Dashboards especializados por função: SDR, AE, CS, RevOps, Manager e CEO. Cada um com métricas relevantes.',
    target: 'section-gtm',
    position: 'right',
  },
  {
    id: 'profile',
    title: 'Seu Perfil',
    description: 'Acesse configurações, troque de organização e faça logout pelo menu do seu perfil.',
    target: 'sidebar-footer',
    position: 'top',
  },
];

export function useOnboardingTour() {
  const { user } = useSupabaseAuth();
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompleted, setHasCompleted] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    // Check localStorage for tour completion
    const storageKey = `${TOUR_STORAGE_KEY}_${user.id}`;
    const completed = localStorage.getItem(storageKey) === 'true';
    setHasCompleted(completed);
  }, [user]);

  const startTour = () => {
    setCurrentStep(0);
    setIsActive(true);
  };

  const nextStep = () => {
    if (currentStep < SIDEBAR_TOUR_STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      completeTour();
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const skipTour = () => {
    completeTour();
  };

  const completeTour = () => {
    setIsActive(false);
    setHasCompleted(true);
    
    if (user) {
      localStorage.setItem(`${TOUR_STORAGE_KEY}_${user.id}`, 'true');
    }
  };

  const resetTour = () => {
    setHasCompleted(false);
    
    if (user) {
      localStorage.removeItem(`${TOUR_STORAGE_KEY}_${user.id}`);
    }
  };

  return {
    isActive,
    currentStep,
    totalSteps: SIDEBAR_TOUR_STEPS.length,
    currentStepData: SIDEBAR_TOUR_STEPS[currentStep],
    hasCompleted,
    startTour,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    resetTour,
  };
}
