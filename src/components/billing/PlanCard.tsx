import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';

interface PlanCardProps {
  id: string;
  name: string;
  priceMonthCents: number;
  priceYearCents: number;
  features: string[];
  isCurrentPlan: boolean;
  isRecommended?: boolean;
  onSelectPlan: (planId: string) => void;
  disabled?: boolean;
}

export function PlanCard({
  id,
  name,
  priceMonthCents,
  priceYearCents,
  features,
  isCurrentPlan,
  isRecommended,
  onSelectPlan,
  disabled,
}: PlanCardProps) {
  const monthlyPrice = (priceMonthCents / 100).toFixed(2);
  const yearlyPrice = (priceYearCents / 100).toFixed(2);
  const yearlyMonthly = priceYearCents > 0 ? (priceYearCents / 12 / 100).toFixed(2) : '0.00';

  return (
    <Card className={`relative ${isRecommended ? 'border-primary shadow-lg' : ''}`}>
      {isRecommended && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary">Recomendado</Badge>
        </div>
      )}
      
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{name}</CardTitle>
          {isCurrentPlan && (
            <Badge variant="secondary">Plano Atual</Badge>
          )}
        </div>
        <CardDescription>
          {priceMonthCents === 0 ? (
            <span className="text-3xl font-bold">Grátis</span>
          ) : id === 'enterprise' ? (
            <span className="text-3xl font-bold">Sob consulta</span>
          ) : (
            <div>
              <div className="text-3xl font-bold">
                R$ {monthlyPrice}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </div>
              {priceYearCents > 0 && (
                <div className="text-sm text-muted-foreground mt-1">
                  ou R$ {yearlyMonthly}/mês no anual
                </div>
              )}
            </div>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <ul className="space-y-2">
          {features.map((feature, index) => (
            <li key={index} className="flex items-start gap-2">
              <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
              <span className="text-sm">{feature}</span>
            </li>
          ))}
        </ul>

        <Button
          className="w-full"
          variant={isCurrentPlan ? 'outline' : 'default'}
          onClick={() => onSelectPlan(id)}
          disabled={disabled || isCurrentPlan}
        >
          {isCurrentPlan ? 'Plano Atual' : id === 'enterprise' ? 'Falar com Vendas' : 'Selecionar Plano'}
        </Button>
      </CardContent>
    </Card>
  );
}
