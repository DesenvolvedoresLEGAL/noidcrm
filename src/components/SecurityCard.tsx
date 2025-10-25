import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { ChangePasswordModal } from './ChangePasswordModal';
import { Shield, Mail, CheckCircle, Clock } from 'lucide-react';

export function SecurityCard() {
  const { user } = useSupabaseAuth();

  return (
    <Card className="shadow-card hover:shadow-card-hover transition-shadow">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Segurança
        </CardTitle>
        <CardDescription>
          Gerencie a segurança da sua conta
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Verification Status */}
        <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Verificação de Email</p>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          {user?.email_confirmed_at ? (
            <Badge variant="default" className="gap-1">
              <CheckCircle className="h-3 w-3" />
              Verificado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Clock className="h-3 w-3" />
              Pendente
            </Badge>
          )}
        </div>

        {/* Password Section */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Senha</p>
              <p className="text-xs text-muted-foreground">
                Última alteração: Nunca
              </p>
            </div>
          </div>
          <ChangePasswordModal />
        </div>

        {/* Two-Factor Authentication (Future) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Autenticação de Dois Fatores</p>
              <p className="text-xs text-muted-foreground">
                Adicione uma camada extra de segurança
              </p>
            </div>
            <Badge variant="outline">Em breve</Badge>
          </div>
        </div>

        {/* Sessions (Future) */}
        <div className="pt-4 border-t">
          <Button variant="outline" className="w-full" disabled>
            Ver Sessões Ativas
          </Button>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Gerencie dispositivos conectados à sua conta
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
