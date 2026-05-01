import { ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldQuestion } from 'lucide-react';

interface Props {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: typeof ShieldQuestion;
}

export function ForecastEmptyState({ title, description, action, icon: Icon = ShieldQuestion }: Props) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground space-y-3">
        <p>{description}</p>
        {action}
      </CardContent>
    </Card>
  );
}

export const FORECAST_RPC_FAILURE_MESSAGE =
  'Não foi possível carregar este painel agora. A visualização legada continua disponível.';
