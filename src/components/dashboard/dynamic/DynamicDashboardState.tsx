import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertTriangle,
  Info,
  Loader2,
  Lock,
  Layers,
  ShieldAlert,
} from 'lucide-react';

export type ShellState =
  | 'loading'
  | 'empty'
  | 'error'
  | 'legacy'
  | 'unsupported'
  | 'forbidden';

const COPY: Record<ShellState, { title: string; message: string }> = {
  loading: {
    title: 'Carregando preview do dashboard...',
    message: 'Buscando o profile resolvido para este contexto.',
  },
  empty: {
    title: 'Nenhum dashboard dinâmico encontrado para este contexto.',
    message: 'O dashboard padrão atual continuará sendo usado.',
  },
  error: {
    title: 'Não foi possível carregar o preview do dashboard.',
    message: 'O dashboard atual permanece seguro. Tente novamente em instantes.',
  },
  legacy: {
    title: 'Dashboard legado ativo',
    message: 'Este usuário continuará usando o dashboard atual do CRM.',
  },
  unsupported: {
    title: 'Tipo de layout ainda não suportado',
    message: 'O dashboard atual permanece seguro. Esse profile será renderizado em uma sprint futura.',
  },
  forbidden: {
    title: 'Acesso restrito',
    message: 'Você não tem permissão para visualizar este preview.',
  },
};

const ICONS: Record<ShellState, React.ComponentType<{ className?: string }>> = {
  loading: Loader2,
  empty: Info,
  error: AlertTriangle,
  legacy: Layers,
  unsupported: ShieldAlert,
  forbidden: Lock,
};

export function DynamicDashboardState({
  state,
  detail,
}: {
  state: ShellState;
  detail?: string;
}) {
  const Icon = ICONS[state];
  const { title, message } = COPY[state];

  if (state === 'loading') {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center gap-3 p-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{title}</p>
        </CardContent>
      </Card>
    );
  }

  const variant = state === 'error' ? 'destructive' : 'default';
  return (
    <Alert variant={variant}>
      <Icon className="h-4 w-4" />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {detail || message}
      </AlertDescription>
    </Alert>
  );
}
