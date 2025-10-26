import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Target, ShoppingCart, Building, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step3Props {
  onNext: (pipelineType: 'b2b' | 'b2c' | 'enterprise' | 'custom') => void;
  onBack: () => void;
}

const PIPELINE_OPTIONS = [
  {
    id: 'b2b' as const,
    name: 'Vendas B2B Consultivas',
    description: 'Ideal para vendas complexas com ciclos longos',
    icon: Target,
    stages: ['Prospecção', 'Qualificação', 'Proposta', 'Negociação', 'Fechamento'],
    recommended: true
  },
  {
    id: 'b2c' as const,
    name: 'Vendas B2C Transacionais',
    description: 'Perfeito para vendas rápidas e alto volume',
    icon: ShoppingCart,
    stages: ['Lead', 'Contato', 'Demonstração', 'Venda', 'Pós-venda'],
    recommended: false
  },
  {
    id: 'enterprise' as const,
    name: 'Vendas Enterprise',
    description: 'Para grandes contas e múltiplos stakeholders',
    icon: Building,
    stages: ['Prospecção', 'Discovery', 'POC', 'Proposta', 'Negociação', 'Fechamento'],
    recommended: false
  },
  {
    id: 'custom' as const,
    name: 'Pipeline Personalizado',
    description: 'Comece simples e personalize depois',
    icon: Settings,
    stages: ['Novo', 'Em andamento', 'Concluído'],
    recommended: false
  }
];

export function Step3Pipeline({ onNext, onBack }: Step3Props) {
  const [selected, setSelected] = useState<string | null>(null);

  const handleSubmit = () => {
    if (selected) {
      onNext(selected as 'b2b' | 'b2c' | 'enterprise' | 'custom');
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold mb-2">Como você vende? 📊</h2>
        <p className="text-lg text-muted-foreground">
          Escolha o modelo que melhor se encaixa no seu processo
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PIPELINE_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <Card
              key={option.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-lg border-2',
                selected === option.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              )}
              onClick={() => setSelected(option.id)}
            >
              <CardContent className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-lg leading-tight">{option.name}</h3>
                      {option.recommended && (
                        <span className="text-xs font-medium bg-primary text-primary-foreground px-2 py-1 rounded-full">
                          Recomendado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{option.description}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1.5">
                  {option.stages.map((stage, idx) => (
                    <span key={idx} className="text-xs bg-muted px-2 py-1 rounded">
                      {stage}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" size="lg" onClick={onBack} className="flex-1 h-12">
          ← Voltar
        </Button>
        <Button size="lg" onClick={handleSubmit} className="flex-1 h-12 text-base" disabled={!selected}>
          Finalizar Setup →
        </Button>
      </div>
    </div>
  );
}
