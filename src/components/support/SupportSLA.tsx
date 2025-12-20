import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';

const slaLevels = [
  {
    urgency: 'Crítica',
    time: '4 horas',
    color: 'bg-red-500',
    description: 'Bloqueio total do sistema',
  },
  {
    urgency: 'Alta',
    time: '24 horas',
    color: 'bg-orange-500',
    description: 'Impacto significativo',
  },
  {
    urgency: 'Média',
    time: '48 horas',
    color: 'bg-yellow-500',
    description: 'Impacto moderado',
  },
  {
    urgency: 'Baixa',
    time: '72 horas',
    color: 'bg-green-500',
    description: 'Sem impacto crítico',
  },
];

export function SupportSLA() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="h-5 w-5 text-primary" />
          SLA e Garantias
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {slaLevels.map((level) => (
            <div
              key={level.urgency}
              className="text-center p-4 rounded-lg bg-muted/50 border"
            >
              <div className={`w-3 h-3 rounded-full ${level.color} mx-auto mb-2`} />
              <p className="font-semibold text-foreground">{level.urgency}</p>
              <p className="text-lg font-bold text-primary">{level.time}</p>
              <p className="text-xs text-muted-foreground mt-1">{level.description}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground text-center mt-4">
          * SLA calculado em horário comercial (seg-sex, 9h-18h BRT)
        </p>
      </CardContent>
    </Card>
  );
}
