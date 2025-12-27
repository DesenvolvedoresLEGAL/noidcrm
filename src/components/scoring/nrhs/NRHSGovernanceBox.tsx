// NRHS Governance Box - Regras ativas (read-only)

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollText, Target, Zap, AlertTriangle, Clock } from 'lucide-react';

interface NRHSGovernanceBoxProps {
  className?: string;
}

export function NRHSGovernanceBox({ className }: NRHSGovernanceBoxProps) {
  const rules = [
    {
      icon: Target,
      label: 'NRHS mínimo para Forecast',
      value: '70',
      description: 'Deals abaixo não entram no forecast',
    },
    {
      icon: Zap,
      label: 'NRHS mínimo para OTE',
      value: '75',
      description: 'Comissões calculadas apenas com higiene alta',
    },
    {
      icon: AlertTriangle,
      label: 'Blockers ativos',
      value: '12 tipos',
      description: 'Verificações automáticas de qualidade',
    },
    {
      icon: Clock,
      label: 'Frequência de cálculo',
      value: 'Tempo real',
      description: 'Atualizado a cada alteração do deal',
    },
  ];

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <ScrollText className="h-5 w-5 text-muted-foreground" />
          Regras Ativas de Higiene
          <Badge variant="outline" className="text-xs ml-auto font-normal">
            Somente leitura
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {rules.map((rule, index) => {
            const Icon = rule.icon;
            return (
              <div 
                key={index}
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{rule.label}</span>
                    <Badge variant="secondary" className="text-xs font-bold">
                      {rule.value}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rule.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
