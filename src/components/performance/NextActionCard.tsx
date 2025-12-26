import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, Target, GraduationCap, Activity, Gauge, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScoreBreakdown } from '@/services/performance/performanceScores';
import { useNavigate } from 'react-router-dom';

interface NextActionCardProps {
  breakdowns: ScoreBreakdown[];
  rasStatus?: string | null;
}

interface RecommendedAction {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  icon: React.ComponentType<{ className?: string }>;
  route?: string;
  buttonText: string;
}

export function NextActionCard({ breakdowns, rasStatus }: NextActionCardProps) {
  const navigate = useNavigate();
  
  const getRecommendedAction = (): RecommendedAction => {
    // Check for critical RAS status
    if (rasStatus === 'CRÍTICO') {
      return {
        title: 'Atenção Urgente Necessária',
        description: 'Seu RAS está em status crítico. Recomendamos falar com seu gestor e focar em melhorar suas métricas prioritárias.',
        priority: 'high',
        icon: AlertTriangle,
        buttonText: 'Ver Detalhes'
      };
    }
    
    // Find lowest score
    const validBreakdowns = breakdowns.filter(b => b.value !== null);
    if (validBreakdowns.length === 0) {
      return {
        title: 'Complete seu primeiro treinamento',
        description: 'Faça uma sessão de roleplay para começar a construir seu score de capacitação.',
        priority: 'medium',
        icon: GraduationCap,
        route: '/app/roleplay',
        buttonText: 'Iniciar Roleplay'
      };
    }
    
    const lowestScore = validBreakdowns.reduce((min, b) => 
      (b.value || 0) < (min.value || 0) ? b : min
    );
    
    switch (lowestScore.score) {
      case 'CS':
        return {
          title: 'Melhore sua Capacitação',
          description: `Seu CS está em ${lowestScore.value?.toFixed(1)}. Complete sessões de roleplay para melhorar suas técnicas de vendas.`,
          priority: lowestScore.value! < 50 ? 'high' : 'medium',
          icon: GraduationCap,
          route: '/app/roleplay',
          buttonText: 'Fazer Roleplay'
        };
      case 'BS':
        return {
          title: 'Aumente sua Atividade',
          description: `Seu BS está em ${lowestScore.value?.toFixed(1)}. Registre mais atividades e mantenha uma rotina consistente.`,
          priority: lowestScore.value! < 50 ? 'high' : 'medium',
          icon: Activity,
          route: '/app/activities',
          buttonText: 'Ver Atividades'
        };
      case 'DS':
        return {
          title: 'Melhore seu Pipeline',
          description: `Seu DS está em ${lowestScore.value?.toFixed(1)}. Foque em reduzir o aging das suas oportunidades.`,
          priority: lowestScore.value! < 50 ? 'high' : 'medium',
          icon: Target,
          route: '/app/opportunities',
          buttonText: 'Ver Pipeline'
        };
      default:
        return {
          title: 'Continue assim!',
          description: 'Seus scores estão equilibrados. Mantenha sua rotina de atividades e treinamentos.',
          priority: 'low',
          icon: Sparkles,
          buttonText: 'Ver Dashboard'
        };
    }
  };
  
  const action = getRecommendedAction();
  const Icon = action.icon;
  
  const priorityColors = {
    high: 'border-red-500/30 bg-gradient-to-br from-red-500/10 to-orange-500/5',
    medium: 'border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 to-amber-500/5',
    low: 'border-green-500/30 bg-gradient-to-br from-green-500/10 to-emerald-500/5'
  };
  
  const priorityLabels = {
    high: 'Alta Prioridade',
    medium: 'Média Prioridade',
    low: 'Baixa Prioridade'
  };
  
  const priorityBadgeColors = {
    high: 'bg-red-500/10 text-red-600 border-red-500/30',
    medium: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30',
    low: 'bg-green-500/10 text-green-600 border-green-500/30'
  };

  return (
    <Card className={cn('overflow-hidden', priorityColors[action.priority])}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Próxima Ação Recomendada
          </CardTitle>
          <Badge variant="outline" className={priorityBadgeColors[action.priority]}>
            {priorityLabels[action.priority]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <div className={cn(
            'p-3 rounded-xl shrink-0',
            action.priority === 'high' ? 'bg-red-500/20' : 
            action.priority === 'medium' ? 'bg-yellow-500/20' : 'bg-green-500/20'
          )}>
            <Icon className={cn(
              'h-6 w-6',
              action.priority === 'high' ? 'text-red-600' : 
              action.priority === 'medium' ? 'text-yellow-600' : 'text-green-600'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-lg mb-1">{action.title}</h3>
            <p className="text-sm text-muted-foreground mb-4">{action.description}</p>
            {action.route && (
              <Button 
                onClick={() => navigate(action.route!)}
                className="group"
              >
                {action.buttonText}
                <ArrowRight className="h-4 w-4 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
