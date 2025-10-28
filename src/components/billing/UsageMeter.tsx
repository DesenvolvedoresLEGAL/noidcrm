import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';

interface UsageMeterProps {
  title: string;
  current: number;
  limit: number;
  isLoading?: boolean;
}

export function UsageMeter({ title, current, limit, isLoading }: UsageMeterProps) {
  const percentage = limit > 0 ? Math.min((current / limit) * 100, 100) : 0;
  const isNearLimit = percentage >= 80;
  const isAtLimit = percentage >= 100;

  // Formatar limites "ilimitados"
  const limitDisplay = limit >= 999 ? 'Ilimitado' : limit.toLocaleString('pt-BR');
  const currentDisplay = current.toLocaleString('pt-BR');

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {isNearLimit && !isAtLimit && (
            <Badge variant="outline" className="gap-1 text-warning border-warning">
              <AlertTriangle className="h-3 w-3" />
              Perto do limite
            </Badge>
          )}
          {isAtLimit && (
            <Badge variant="destructive" className="gap-1">
              <AlertTriangle className="h-3 w-3" />
              Limite atingido
            </Badge>
          )}
        </div>
        <CardDescription>
          {currentDisplay} / {limitDisplay}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {limit >= 999 ? (
          <Progress value={0} className="h-2" />
        ) : (
          <Progress 
            value={percentage} 
            className={`h-2 ${isAtLimit ? 'bg-destructive/20' : isNearLimit ? 'bg-warning/20' : ''}`}
          />
        )}
      </CardContent>
    </Card>
  );
}
