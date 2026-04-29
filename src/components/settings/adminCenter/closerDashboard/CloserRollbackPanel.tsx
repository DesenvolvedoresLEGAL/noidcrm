import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  useDisableAllCloserPilots,
  useDisableTenantDynamicDashboards,
} from '@/hooks/dashboard/useCloserDashboardPilot';
import { useToast } from '@/hooks/use-toast';

interface Props {
  tenantId: string;
}

export function CloserRollbackPanel({ tenantId }: Props) {
  const disableAll = useDisableAllCloserPilots();
  const disableTenant = useDisableTenantDynamicDashboards();
  const { toast } = useToast();

  const runDisableAll = () =>
    disableAll.mutate(
      { tenantId, reason: 'admin_bulk_rollback' },
      {
        onSuccess: (r: any) =>
          toast({ title: `Closers desligados: ${r?.disabled_count ?? 0}` }),
        onError: (e: any) =>
          toast({ title: 'Falha no rollback', description: e?.message, variant: 'destructive' }),
      },
    );

  const runDisableTenant = () =>
    disableTenant.mutate(
      { tenantId, reason: 'admin_tenant_rollback' },
      {
        onSuccess: () => toast({ title: 'Dashboard dinâmico desligado neste tenant.' }),
        onError: (e: any) =>
          toast({ title: 'Falha', description: e?.message, variant: 'destructive' }),
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rollback rápido</CardTitle>
        <CardDescription>Desligue pilotos individuais, todos os Closers ou o tenant inteiro.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col md:flex-row gap-2">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" disabled={disableAll.isPending}>
              Desligar todos os Closers pilotos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desligar todos os Closers pilotos?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso remove o novo dashboard de todos os Closers pilotos deste tenant. O dashboard atual volta imediatamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={runDisableAll}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" disabled={disableTenant.isPending}>
              Desligar dashboard dinâmico no tenant
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Desligar dashboard dinâmico no tenant?</AlertDialogTitle>
              <AlertDialogDescription>
                Isso desliga a flag global e devolve todos os usuários ao dashboard atual.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={runDisableTenant}>Confirmar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
