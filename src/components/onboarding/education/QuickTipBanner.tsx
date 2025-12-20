import { motion, AnimatePresence } from 'framer-motion';
import { X, Lightbulb, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDismissedTips } from '@/hooks/useDismissedTips';
import { cn } from '@/lib/utils';

interface QuickTipBannerProps {
  tipKey: string;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  variant?: 'info' | 'success' | 'warning';
  className?: string;
}

export function QuickTipBanner({
  tipKey,
  title,
  description,
  actionLabel,
  onAction,
  variant = 'info',
  className,
}: QuickTipBannerProps) {
  const { isTipDismissed, dismissTip, loading } = useDismissedTips();

  if (loading || isTipDismissed(tipKey)) return null;

  const variantStyles = {
    info: 'bg-blue-500/10 border-blue-500/20 text-blue-600',
    success: 'bg-green-500/10 border-green-500/20 text-green-600',
    warning: 'bg-amber-500/10 border-amber-500/20 text-amber-600',
  };

  const iconStyles = {
    info: 'bg-blue-500/20 text-blue-500',
    success: 'bg-green-500/20 text-green-500',
    warning: 'bg-amber-500/20 text-amber-500',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          "flex items-center gap-3 p-3 rounded-lg border",
          variantStyles[variant],
          className
        )}
      >
        <div className={cn("p-2 rounded-lg shrink-0", iconStyles[variant])}>
          <Lightbulb className="h-4 w-4" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {actionLabel && onAction && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onAction}
              className="h-8"
            >
              {actionLabel}
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => dismissTip(tipKey)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Pre-configured tips
export function ProposalsTip() {
  return (
    <QuickTipBanner
      tipKey="proposals_intro"
      title="💡 Dica: Propostas inteligentes"
      description="Propostas aceitas geram contratos automaticamente!"
      variant="info"
    />
  );
}

export function ForecastTip() {
  return (
    <QuickTipBanner
      tipKey="forecast_intro"
      title="💡 Dica: Previsões com IA"
      description="Quanto mais dados históricos, mais precisas são as previsões."
      variant="info"
    />
  );
}

export function StagnantOpportunityTip({ onAction }: { onAction?: () => void }) {
  return (
    <QuickTipBanner
      tipKey="stagnant_opportunity"
      title="⚠️ Oportunidades paradas"
      description="Você tem oportunidades sem interação há mais de 7 dias."
      actionLabel="Ver agora"
      onAction={onAction}
      variant="warning"
    />
  );
}

export function NoGoalTip({ onAction }: { onAction?: () => void }) {
  return (
    <QuickTipBanner
      tipKey="no_goal_set"
      title="🎯 Defina suas metas"
      description="Configure metas para acompanhar o progresso da equipe."
      actionLabel="Configurar"
      onAction={onAction}
      variant="info"
    />
  );
}
