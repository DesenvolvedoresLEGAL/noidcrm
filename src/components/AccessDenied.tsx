import { ShieldX, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import type { AccessLevel } from './SettingsGate';

interface AccessDeniedProps {
  requiredLevel?: AccessLevel;
  title?: string;
  description?: string;
}

const levelDescriptions: Record<AccessLevel, string> = {
  full: 'Administrador ou Proprietário',
  partial: 'Gerente ou superior',
  basic: 'Usuário autenticado',
};

export function AccessDenied({ 
  requiredLevel = 'full',
  title = 'Acesso Restrito',
  description,
}: AccessDeniedProps) {
  const navigate = useNavigate();

  const defaultDescription = `Esta área requer permissão de ${levelDescriptions[requiredLevel]}. Entre em contato com o administrador da sua organização para solicitar acesso.`;

  return (
    <div className="flex items-center justify-center min-h-[400px] p-6">
      <Card className="max-w-md w-full border-destructive/20">
        <CardHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
            <ShieldX className="h-8 w-8 text-destructive" />
          </div>
          <CardTitle className="text-xl">{title}</CardTitle>
          <CardDescription className="text-sm mt-2">
            {description || defaultDescription}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button
            variant="default"
            className="w-full"
            onClick={() => navigate('/app/dashboard')}
          >
            Ir para Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
