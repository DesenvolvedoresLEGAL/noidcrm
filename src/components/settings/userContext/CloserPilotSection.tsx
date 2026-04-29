import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ShieldAlert, Power, PlayCircle, RefreshCw } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useUserContexts } from '@/hooks/userContext/useUserContextData';
import {
  useEnableCloserPilot,
  useDisableCloserPilot,
  useDisableTenantDynamicDashboards,
  useTenantDynamicFlag,
} from '@/hooks/dashboard/useCloserDashboardPilot';
import { useToast } from '@/hooks/use-toast';
import { getReviewStatus } from '@/hooks/userContext/useUserContextData';

interface Props {
  tenantId: string;
  organizationId: string;
}

export function CloserPilotSection({ tenantId, organizationId }: Props) {
  const { data: rows } = useUserContexts(tenantId, organizationId);
  const { data: globalEnabled } = useTenantDynamicFlag(tenantId);
  const enableMut = useEnableCloserPilot();
  const disableUserMut = useDisableCloserPilot();
  const disableTenantMut = useDisableTenantDynamicDashboards();
  const { toast } = useToast();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const eligible = useMemo(
    () =>
      (rows ?? []).filter(
        (r) =>
          r.business_function_key === 'closer' && r.member_status === 'active',
      ),
    [rows],
  );

  const selected = eligible.find((r) => r.user_id === selectedUserId) ?? null;
  const reviewStatus = selected ? getReviewStatus(selected) : null;
  const requiresReview = reviewStatus === 'needs_review' || reviewStatus === 'incomplete' || reviewStatus === 'no_context';

  const handleEnable = async () => {
    if (!selected) return;
    try {
      await enableMut.mutateAsync({
        tenantId,
        targetUserId: selected.user_id,
        reason: `Pilot enabled via Admin UI for ${selected.full_name ?? selected.email}`,
      });
      toast({
        title: 'Piloto habilitado',
        description: 'Dashboard dinâmico ativado apenas para este Closer neste tenant.',
      });
    } catch (err: any) {
      toast({ title: 'Falha ao habilitar piloto', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDisableUser = async () => {
    if (!selected) return;
    try {
      await disableUserMut.mutateAsync({
        tenantId,
        targetUserId: selected.user_id,
        reason: 'Rollback individual via Admin UI',
      });
      toast({ title: 'Piloto desligado para o usuário' });
    } catch (err: any) {
      toast({ title: 'Falha', description: err?.message, variant: 'destructive' });
    }
  };

  const handleDisableTenant = async () => {
    try {
      await disableTenantMut.mutateAsync({
        tenantId,
        reason: 'Rollback de tenant via Admin UI',
      });
      toast({
        title: 'Dashboard dinâmico desativado no tenant',
        description: 'Todos os usuários voltam ao dashboard atual imediatamente.',
      });
    } catch (err: any) {
      toast({ title: 'Falha', description: err?.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" />
          Piloto do Dashboard Comercial
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Escolha 1 usuário comercial para testar o novo Dashboard Comercial. Rollback imediato a
          qualquer momento por usuário ou pelo tenant inteiro.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Tenant atual</div>
            <div className="font-mono text-xs mt-1">{tenantId}</div>
          </div>
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground">Flag global do tenant</div>
            <div className="mt-1">
              <Badge variant={globalEnabled ? 'default' : 'outline'}>
                dynamic_dashboards_enabled = {String(!!globalEnabled)}
              </Badge>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Usuário comercial piloto (função técnica Closer)</label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                {selected
                  ? `${selected.full_name ?? selected.email ?? 'Sem nome'}`
                  : 'Selecionar usuário comercial...'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
              <Command>
                <CommandInput placeholder="Buscar usuário comercial..." />
                <CommandList>
                  <CommandEmpty>Nenhum usuário comercial elegível encontrado.</CommandEmpty>
                  <CommandGroup>
                    {eligible.map((r) => {
                      const rs = getReviewStatus(r);
                      return (
                        <CommandItem
                          key={r.user_id}
                          value={`${r.full_name} ${r.email}`}
                          onSelect={() => {
                            setSelectedUserId(r.user_id);
                            setOpen(false);
                          }}
                        >
                          <div className="flex flex-col flex-1">
                            <span>{r.full_name ?? r.email}</span>
                            <span className="text-xs text-muted-foreground">{r.email}</span>
                          </div>
                          <Badge
                            variant={rs === 'validated' ? 'secondary' : 'outline'}
                            className="ml-2 text-[10px]"
                          >
                            {rs === 'validated'
                              ? 'Validado'
                              : rs === 'needs_review'
                              ? 'Revisar'
                              : 'Incompleto'}
                          </Badge>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {selected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Status de revisão</div>
              <div className="mt-1">
                <Badge variant={reviewStatus === 'validated' ? 'secondary' : 'destructive'}>
                  {reviewStatus === 'validated'
                    ? 'Validado'
                    : reviewStatus === 'needs_review'
                    ? 'Revisar'
                    : 'Incompleto'}
                </Badge>
              </div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-muted-foreground">Flag individual do usuário</div>
              <div className="mt-1">
                <Badge variant={selected.is_dashboard_dynamic_enabled ? 'default' : 'outline'}>
                  is_dashboard_dynamic_enabled = {String(selected.is_dashboard_dynamic_enabled)}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {requiresReview && selected && (
          <Alert variant="destructive">
            <AlertDescription>
              Este usuário precisa ter o contexto validado antes de habilitar o piloto.
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            onClick={handleEnable}
            disabled={!selected || requiresReview || enableMut.isPending}
            className="gap-1"
          >
            <PlayCircle className="h-4 w-4" />
            Habilitar piloto para este usuário
          </Button>
          <Button
            variant="outline"
            onClick={handleDisableUser}
            disabled={!selected || disableUserMut.isPending}
            className="gap-1"
          >
            <RefreshCw className="h-4 w-4" />
            Desligar piloto deste usuário
          </Button>
          <Button
            variant="destructive"
            onClick={handleDisableTenant}
            disabled={disableTenantMut.isPending}
            className="gap-1"
          >
            <Power className="h-4 w-4" />
            Desligar dashboard dinâmico neste tenant
          </Button>
        </div>

        <Alert>
          <AlertDescription className="text-xs">
            <strong>Rollback imediato:</strong> Desligue o piloto individual ou desative dashboards
            dinâmicos no tenant. O usuário volta ao dashboard atual imediatamente.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
