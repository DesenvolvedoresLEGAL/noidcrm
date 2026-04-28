import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck } from 'lucide-react';

export function AdminCenterExplainer() {
  return (
    <Card className="border-primary/30">
      <CardContent className="p-5 space-y-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">Admin não é cargo. É permissão.</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Usuários Admin podem gerenciar configurações do CRM, mas o dashboard
          principal continua seguindo a função operacional da pessoa.
        </p>
        <p className="text-sm text-muted-foreground">
          Exemplo: alguém do Financeiro com permissão Admin continuará vendo o
          dashboard financeiro quando os dashboards dinâmicos forem ativados. O Admin
          Center fica disponível dentro de Configurações para tarefas administrativas.
        </p>
      </CardContent>
    </Card>
  );
}
