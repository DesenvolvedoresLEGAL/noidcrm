import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  Zap, 
  ArrowRight, 
  CheckCircle2, 
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { useTrialStatus } from '@/hooks/useTrialStatus';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const FEATURES_ON_UPGRADE = [
  'Acesso ilimitado ao CRM',
  'Insights de IA avançados',
  'Relatórios personalizados',
  'Suporte prioritário',
];

export function TrialCountdown() {
  const navigate = useNavigate();
  const { 
    daysRemaining, 
    trialEndsAt, 
    isTrial, 
    isPaid, 
    status,
    showCriticalWarning 
  } = useTrialStatus();

  // Don't show for paid users
  if (isPaid || !isTrial) {
    return null;
  }

  const progressPercent = daysRemaining !== null 
    ? Math.min(100, Math.max(0, ((14 - daysRemaining) / 14) * 100))
    : 0;

  const endDate = trialEndsAt 
    ? format(new Date(trialEndsAt), "dd 'de' MMMM", { locale: ptBR })
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className={`overflow-hidden ${showCriticalWarning ? 'border-destructive/50' : 'border-primary/30'}`}>
        {/* Gradient header */}
        <div className={`h-1.5 ${showCriticalWarning ? 'bg-gradient-to-r from-destructive to-red-400' : 'bg-gradient-to-r from-primary to-accent'}`} />
        
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Período de Teste
            </CardTitle>
            {showCriticalWarning ? (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="w-3 h-3" />
                Expirando
              </Badge>
            ) : (
              <Badge variant="secondary" className="gap-1">
                <Calendar className="w-3 h-3" />
                Ativo
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Countdown */}
          <div className="text-center py-4">
            <motion.div
              key={daysRemaining}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-5xl font-bold ${showCriticalWarning ? 'text-destructive' : 'text-primary'}`}
            >
              {daysRemaining}
            </motion.div>
            <p className="text-sm text-muted-foreground mt-1">
              {daysRemaining === 1 ? 'dia restante' : 'dias restantes'}
            </p>
            {endDate && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Expira em {endDate}
              </p>
            )}
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Início</span>
              <span>Dia 14</span>
            </div>
            <Progress 
              value={progressPercent} 
              className={`h-2 ${showCriticalWarning ? '[&>div]:bg-destructive' : ''}`}
            />
          </div>

          {/* Features you'll keep */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Com o upgrade você mantém:
            </p>
            <ul className="space-y-1.5">
              {FEATURES_ON_UPGRADE.map((feature, i) => (
                <li key={i} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <Button 
            className="w-full gap-2" 
            size="lg"
            onClick={() => navigate('/app/settings/billing')}
          >
            <Zap className="w-4 h-4" />
            Fazer Upgrade
            <ArrowRight className="w-4 h-4" />
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Não perca seus dados. Faça upgrade antes do término.
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
