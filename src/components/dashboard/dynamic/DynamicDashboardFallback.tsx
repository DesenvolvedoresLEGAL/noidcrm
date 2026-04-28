import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Info, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { GuardDenyReason } from '@/hooks/dashboard/useDynamicDashboardGuard';

const REASON_LABEL: Record<GuardDenyReason, string> = {
  unauthenticated: 'Você precisa estar autenticado.',
  no_tenant: 'Sua organização ainda não foi resolvida.',
  global_flag_off: 'O modo dashboard dinâmico ainda não foi liberado para esta organização.',
  user_flag_off: 'O dashboard dinâmico ainda não está ativado para o seu usuário.',
  not_a_closer: 'O dashboard dinâmico está disponível atualmente apenas para a função Closer.',
  resolver_denied: 'Não foi possível resolver um profile dinâmico para o seu contexto.',
  no_profile: 'Nenhum profile dinâmico foi encontrado para o seu contexto.',
};

export function DynamicDashboardFallback({ reason }: { reason?: GuardDenyReason }) {
  const navigate = useNavigate();
  const message = reason ? REASON_LABEL[reason] : 'Dashboard dinâmico indisponível.';

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Dashboard dinâmico indisponível.</strong> {message} Você continua com o
            dashboard atual sem qualquer mudança.
          </AlertDescription>
        </Alert>
        <Button onClick={() => navigate('/app/dashboard')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar ao dashboard atual
        </Button>
      </CardContent>
    </Card>
  );
}
