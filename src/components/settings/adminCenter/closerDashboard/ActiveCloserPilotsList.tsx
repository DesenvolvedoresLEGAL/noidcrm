import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import type { CloserAdoptionRow } from '@/services/crm/closerDashboardObservability';
import { useDisableCloserPilot } from '@/hooks/dashboard/useCloserDashboardPilot';
import { useToast } from '@/hooks/use-toast';

interface Props {
  tenantId: string;
  adoption: CloserAdoptionRow[];
}

const statusLabel: Record<string, string> = {
  adotando: 'Adotando',
  testando: 'Testando',
  resistencia: 'Resistência',
  sem_uso: 'Sem uso',
};

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  adotando: 'default',
  testando: 'secondary',
  resistencia: 'destructive',
  sem_uso: 'outline',
};

export function ActiveCloserPilotsList({ tenantId, adoption }: Props) {
  const disableMut = useDisableCloserPilot();
  const { toast } = useToast();

  const onDisable = (userId: string) => {
    disableMut.mutate(
      { tenantId, targetUserId: userId, reason: 'manual_admin_disable' },
      {
        onSuccess: () => toast({ title: 'Piloto desligado para este Closer.' }),
        onError: (e: any) =>
          toast({ title: 'Falha ao desligar', description: e?.message, variant: 'destructive' }),
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Pilotos ativos</CardTitle>
        <CardDescription>Adoção e status individual nos últimos 7 dias.</CardDescription>
      </CardHeader>
      <CardContent>
        {adoption.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum Closer piloto ativo.</p>
        ) : (
          <div className="space-y-2">
            {adoption.map((row) => (
              <div
                key={row.userId}
                className="flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <div className="min-w-0">
                  <p className="font-medium truncate">{row.fullName ?? row.email ?? row.userId}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {row.email} · acessos {row.allowedCount} · legado {row.choseLegacyCount}
                    {row.usageRate != null && ` · uso ${Math.round(row.usageRate * 100)}%`}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={statusVariant[row.status]}>{statusLabel[row.status]}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onDisable(row.userId)}
                    disabled={disableMut.isPending}
                  >
                    {disableMut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    Desligar
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
