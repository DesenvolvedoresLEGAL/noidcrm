import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Brain, 
  Bot, 
  Check, 
  Sparkles, 
  Zap, 
  Shield, 
  Clock,
  ArrowRight
} from 'lucide-react';

interface StepSelectPlanProps {
  onNext: (data: PlanSelectionData) => void;
  onBack: () => void;
}

export interface PlanSelectionData {
  selectedPlanId: 'neural' | 'autonomous';
  trialDays: number;
}

const PLANS = [
  {
    id: 'neural' as const,
    name: 'Neural',
    tagline: 'IA como Copilot',
    icon: Brain,
    price: 199.90,
    trialDays: 30,
    color: 'from-blue-500 to-cyan-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    textColor: 'text-blue-500',
    features: [
      'Insights e recomendações de IA',
      'Análise de pipeline inteligente',
      'Sugestões de próximas ações',
      'Lead scoring automático',
      'Relatórios avançados',
      'Integrações via API',
    ],
    description: 'Perfeito para times que querem potencializar suas vendas com IA assistiva. Você toma as decisões, a IA te guia.',
  },
  {
    id: 'autonomous' as const,
    name: 'Autonomous',
    tagline: 'IA como Agente',
    icon: Bot,
    price: 299.90,
    trialDays: 14,
    color: 'from-purple-500 to-pink-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    textColor: 'text-purple-500',
    recommended: true,
    features: [
      'Tudo do Neural +',
      'Agentes de IA autônomos',
      'Execução automática de tarefas',
      'Memory Engine (aprendizado contínuo)',
      'Sistema VOLTS para ações de IA',
      'Suporte prioritário',
    ],
    description: 'Para times que querem que a IA execute. Agentes autônomos que vendem enquanto você dorme.',
  },
];

export function StepSelectPlan({ onNext, onBack }: StepSelectPlanProps) {
  const [selectedPlan, setSelectedPlan] = useState<'neural' | 'autonomous' | null>(null);

  const handleSubmit = () => {
    if (!selectedPlan) return;
    
    const plan = PLANS.find(p => p.id === selectedPlan);
    onNext({
      selectedPlanId: selectedPlan,
      trialDays: plan?.trialDays || 14,
    });
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mx-auto mb-4"
        >
          <Sparkles className="w-8 h-8 text-primary" />
        </motion.div>
        <h2 className="text-3xl font-bold mb-2">Escolha seu plano 🚀</h2>
        <p className="text-lg text-muted-foreground">
          Comece com um teste gratuito. Sem compromisso.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {PLANS.map((plan, index) => {
          const Icon = plan.icon;
          const isSelected = selectedPlan === plan.id;

          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card
                onClick={() => setSelectedPlan(plan.id)}
                className={`relative cursor-pointer transition-all duration-300 h-full ${
                  isSelected 
                    ? `ring-2 ring-primary shadow-lg scale-[1.02] ${plan.borderColor}` 
                    : 'hover:shadow-md hover:scale-[1.01] border-border/50'
                }`}
              >
                {plan.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0 shadow-lg">
                      <Zap className="w-3 h-3 mr-1" />
                      Recomendado
                    </Badge>
                  </div>
                )}

                <CardContent className="pt-8 pb-6 px-6">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${plan.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="w-4 h-4 text-primary-foreground" />
                      </motion.div>
                    )}
                  </div>

                  {/* Plan name & tagline */}
                  <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                  <p className={`text-sm font-medium ${plan.textColor} mb-2`}>{plan.tagline}</p>

                  {/* Price */}
                  <div className="mb-4">
                    <span className="text-3xl font-bold">R${plan.price.toFixed(2).replace('.', ',')}</span>
                    <span className="text-muted-foreground">/usuário/mês</span>
                  </div>

                  {/* Trial badge */}
                  <Badge variant="outline" className="mb-4 gap-1">
                    <Clock className="w-3 h-3" />
                    {plan.trialDays} dias grátis
                  </Badge>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground mb-4">
                    {plan.description}
                  </p>

                  {/* Features */}
                  <ul className="space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.textColor}`} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-6 mb-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Shield className="w-4 h-4" />
          <span>Cancele quando quiser</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Zap className="w-4 h-4" />
          <span>Setup em 2 minutos</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 max-w-md mx-auto">
        <Button 
          type="button" 
          variant="outline" 
          size="lg" 
          onClick={onBack} 
          className="flex-1 h-12"
        >
          ← Voltar
        </Button>
        <Button 
          type="button" 
          size="lg" 
          onClick={handleSubmit}
          disabled={!selectedPlan}
          className="flex-1 h-12 gap-2"
        >
          Continuar
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
