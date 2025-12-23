import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { X, Clock, AlertTriangle, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useState } from 'react';

export function TrialWarningBanner() {
  const navigate = useNavigate();
  const { daysRemaining, hoursRemaining, showWarning, showCriticalWarning, isTrial, status } = useTrialStatus();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if not in trial, already dismissed, or no warning needed
  if (!isTrial || isDismissed || (!showWarning && !showCriticalWarning)) {
    return null;
  }

  const isCritical = showCriticalWarning;
  const timeText = daysRemaining === 1 
    ? `${hoursRemaining} horas` 
    : `${daysRemaining} dias`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className={`w-full ${
          isCritical 
            ? 'bg-gradient-to-r from-destructive/90 to-red-600/90' 
            : 'bg-gradient-to-r from-amber-500/90 to-orange-500/90'
        }`}
      >
        <div className="container mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Icon + Message */}
            <div className="flex items-center gap-3 text-white">
              <div className={`p-1.5 rounded-full ${isCritical ? 'bg-white/20' : 'bg-white/20'}`}>
                {isCritical ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Clock className="w-4 h-4" />
                )}
              </div>
              
              <div className="flex items-center gap-2 text-sm font-medium">
                {isCritical ? (
                  <>
                    <span className="hidden sm:inline">⚠️ Atenção!</span>
                    <span>Seu trial expira em <strong>{timeText}</strong></span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">⏰</span>
                    <span>Restam <strong>{timeText}</strong> no seu período de teste</span>
                  </>
                )}
              </div>
            </div>

            {/* Center: Countdown (desktop only) */}
            {isCritical && daysRemaining !== null && daysRemaining <= 1 && (
              <div className="hidden md:flex items-center gap-1.5 text-white/90">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="text-2xl font-bold"
                >
                  {hoursRemaining}h
                </motion.div>
                <span className="text-xs">restantes</span>
              </div>
            )}

            {/* Right: CTA + Dismiss */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                className="h-8 px-3 gap-1.5 bg-white text-foreground hover:bg-white/90"
                onClick={() => navigate('/app/settings/billing')}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Fazer Upgrade</span>
                <span className="sm:hidden">Upgrade</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              {!isCritical && (
                <button
                  onClick={() => setIsDismissed(true)}
                  className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Fechar aviso"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Progress bar */}
          {daysRemaining !== null && (
            <div className="mt-2 h-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, (14 - daysRemaining) / 14 * 100)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-white/60 rounded-full"
              />
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
