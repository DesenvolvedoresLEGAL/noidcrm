import { ReactNode } from 'react';
import { useEntitlements } from '@/hooks/useEntitlements';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface FeatureGateProps {
  feature: string;
  fallback?: ReactNode;
  children: ReactNode;
}

export function FeatureGate({ feature, fallback, children }: FeatureGateProps) {
  const { can, planId } = useEntitlements();
  const navigate = useNavigate();

  if (can(feature)) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <div>
            <CardTitle>Recurso Bloqueado</CardTitle>
            <CardDescription>
              Este recurso faz parte do NOID Pro
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Você está no plano <strong>{planId.toUpperCase()}</strong>. 
          Faça upgrade para o <strong>PRO</strong> para liberar este recurso.
        </p>
        <Button 
          className="w-full gap-2" 
          onClick={() => navigate('/app/settings/account?tab=plano')}
        >
          <Sparkles className="h-4 w-4" />
          Ver Planos e Fazer Upgrade
        </Button>
      </CardContent>
    </Card>
  );
}
