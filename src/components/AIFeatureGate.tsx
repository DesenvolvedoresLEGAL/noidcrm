import { ReactNode } from 'react';
import { usePlanType, PlanCapabilities } from '@/hooks/usePlanType';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type CapabilityKey = keyof PlanCapabilities;

interface AIFeatureGateProps {
  children: ReactNode;
  /** The capability required to access this feature */
  requires: CapabilityKey;
  /** Optional custom fallback when feature is blocked */
  fallback?: ReactNode;
  /** Show upgrade CTA (default: true) */
  showUpgrade?: boolean;
  /** Feature name for display */
  featureName?: string;
  /** Feature description for locked state */
  featureDescription?: string;
}

const FEATURE_INFO: Record<CapabilityKey, { name: string; description: string; icon: string }> = {
  canUseAgents: {
    name: 'Agentes de IA',
    description: 'Agentes autônomos que executam tarefas de vendas automaticamente',
    icon: '🤖',
  },
  canExecuteAutonomously: {
    name: 'Execução Autônoma',
    description: 'IA que age de forma independente baseada em triggers e regras',
    icon: '⚡',
  },
  hasMemoryEngine: {
    name: 'Memory Engine',
    description: 'Aprendizado contínuo que adapta a IA ao seu processo de vendas',
    icon: '🧠',
  },
  consumesVolts: {
    name: 'Sistema VOLTS',
    description: 'Consumo de créditos para ações autônomas de IA',
    icon: '🔋',
  },
  hasAdvancedReports: {
    name: 'Relatórios Avançados',
    description: 'Analytics avançados com insights de IA',
    icon: '📊',
  },
  hasSequences: {
    name: 'Sequences',
    description: 'Automação de cadências de follow-up',
    icon: '🔄',
  },
  hasAutomations: {
    name: 'Automações',
    description: 'Workflows automatizados para seu pipeline',
    icon: '⚙️',
  },
  hasApiAccess: {
    name: 'Acesso à API',
    description: 'Integração via API para sistemas externos',
    icon: '🔗',
  },
  hasPrioritySupport: {
    name: 'Suporte Prioritário',
    description: 'Atendimento prioritário com SLA reduzido',
    icon: '🎯',
  },
};

export function AIFeatureGate({
  children,
  requires,
  fallback,
  showUpgrade = true,
  featureName,
  featureDescription,
}: AIFeatureGateProps) {
  const navigate = useNavigate();
  const { capabilities, isNeural, planDisplayName, isLoading } = usePlanType();

  // Get feature info
  const info = FEATURE_INFO[requires];
  const displayName = featureName || info.name;
  const displayDescription = featureDescription || info.description;

  // Check if has capability
  const hasCapability = capabilities[requires];

  // Loading state
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-muted/30 rounded-lg" />
      </div>
    );
  }

  // Has access - render children
  if (hasCapability) {
    return <>{children}</>;
  }

  // Custom fallback
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default locked state
  return (
    <Card className="border-dashed border-2 border-muted-foreground/20 bg-muted/5">
      <CardContent className="flex flex-col items-center justify-center py-8 px-6 text-center">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 flex items-center justify-center text-3xl">
            {info.icon}
          </div>
          <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-muted-foreground/20 flex items-center justify-center">
            <Lock className="w-3 h-3 text-muted-foreground" />
          </div>
        </div>

        <Badge variant="outline" className="mb-3 gap-1">
          <Zap className="w-3 h-3" />
          Exclusivo Autonomous
        </Badge>

        <h3 className="font-semibold text-lg mb-1">{displayName}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">
          {displayDescription}
        </p>

        {isNeural && (
          <p className="text-xs text-muted-foreground mb-4">
            Você está no plano <span className="font-medium">{planDisplayName}</span>. 
            Faça upgrade para acessar esta funcionalidade.
          </p>
        )}

        {showUpgrade && (
          <Button 
            onClick={() => navigate('/app/settings/billing')}
            className="gap-2"
            variant="default"
          >
            <span>Fazer Upgrade</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Hook version for conditional rendering in code
 */
export function useAIFeatureAccess(capability: CapabilityKey) {
  const { capabilities, isLoading } = usePlanType();
  
  return {
    hasAccess: capabilities[capability],
    isLoading,
  };
}
