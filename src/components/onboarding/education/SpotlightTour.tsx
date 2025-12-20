import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFirstVisit } from '@/hooks/useFirstVisit';
import { cn } from '@/lib/utils';

interface SpotlightContent {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface SpotlightTourProps {
  pageKey: string;
  content: SpotlightContent;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  className?: string;
}

const SPOTLIGHT_CONTENT: Record<string, SpotlightContent> = {
  pipeline: {
    title: '🎯 Este é seu Pipeline!',
    description: 'Arraste e solte os cards entre as colunas para mover suas oportunidades de vendas.',
  },
  dashboard: {
    title: '📊 Seu painel de controle',
    description: 'Aqui você acompanha os principais KPIs da sua operação em tempo real.',
  },
  proposals: {
    title: '📄 Central de Propostas',
    description: 'Crie, envie e acompanhe propostas comerciais. Propostas aceitas viram contratos automaticamente!',
  },
  forecast: {
    title: '🔮 Previsão Inteligente',
    description: 'Nossa IA analisa seu histórico e oportunidades para prever suas vendas futuras.',
  },
  insights: {
    title: '🧠 Insights de IA',
    description: 'Análises automáticas, recomendações e coaching personalizado para você e sua equipe.',
  },
  accounts: {
    title: '🏢 Gestão de Contas',
    description: 'Visualize e gerencie todas as suas contas e contatos em um só lugar.',
  },
  activities: {
    title: '📅 Suas Atividades',
    description: 'Organize reuniões, calls e tarefas. Nunca perca um follow-up importante!',
  },
};

export function SpotlightTour({ 
  pageKey, 
  content, 
  position = 'center',
  className 
}: SpotlightTourProps) {
  const { isFirstVisit, loading, markAsVisited } = useFirstVisit(pageKey);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!loading && isFirstVisit) {
      // Small delay for better UX
      const timer = setTimeout(() => setShow(true), 500);
      return () => clearTimeout(timer);
    }
  }, [loading, isFirstVisit]);

  const handleDismiss = () => {
    setShow(false);
    markAsVisited();
  };

  if (!show) return null;

  const spotlightContent = SPOTLIGHT_CONTENT[pageKey] || content;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        {/* Backdrop */}
        <div 
          className="absolute inset-0 bg-background/80 backdrop-blur-sm"
          onClick={handleDismiss}
        />

        {/* Spotlight Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', damping: 20 }}
          className={cn(
            "relative z-10 max-w-md mx-4 p-6 rounded-xl",
            "bg-card border shadow-2xl",
            className
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 h-8 w-8"
            onClick={handleDismiss}
          >
            <X className="h-4 w-4" />
          </Button>

          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Lightbulb className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-2">
                {spotlightContent.title}
              </h3>
              <p className="text-muted-foreground">
                {spotlightContent.description}
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleDismiss}>
              Entendi!
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Pre-configured spotlights for each page
export function PipelineSpotlight() {
  return <SpotlightTour pageKey="pipeline" content={SPOTLIGHT_CONTENT.pipeline} />;
}

export function DashboardSpotlight() {
  return <SpotlightTour pageKey="dashboard" content={SPOTLIGHT_CONTENT.dashboard} />;
}

export function ProposalsSpotlight() {
  return <SpotlightTour pageKey="proposals" content={SPOTLIGHT_CONTENT.proposals} />;
}

export function ForecastSpotlight() {
  return <SpotlightTour pageKey="forecast" content={SPOTLIGHT_CONTENT.forecast} />;
}

export function InsightsSpotlight() {
  return <SpotlightTour pageKey="insights" content={SPOTLIGHT_CONTENT.insights} />;
}

export function AccountsSpotlight() {
  return <SpotlightTour pageKey="accounts" content={SPOTLIGHT_CONTENT.accounts} />;
}

export function ActivitiesSpotlight() {
  return <SpotlightTour pageKey="activities" content={SPOTLIGHT_CONTENT.activities} />;
}
