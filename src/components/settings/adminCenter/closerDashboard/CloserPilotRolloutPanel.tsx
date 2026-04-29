import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { MAX_CLOSER_PILOTS } from '@/hooks/dashboard/useCloserDashboardObservability';
import type { ActiveCloserPilot, EligibleCloser } from '@/services/crm/closerDashboardObservability';
import { useEnableCloserPilot as useEnableMut } from '@/hooks/dashboard/useCloserDashboardPilot';
import { useToast } from '@/hooks/use-toast';

interface Props {
  tenantId: string;
  activePilots: ActiveCloserPilot[];
  eligibleClosers: EligibleCloser[];
  canEnableMore: boolean;
}

export function CloserPilotRolloutPanel({ tenantId, activePilots, eligibleClosers, canEnableMore }: Props) {
  const [selectedId, setSelectedId] = useState<string>('');
  const enableMut = useEnableMut();
  const { toast } = useToast();

  const eligible = eligibleClosers.filter((c) => !c.requiresReview && c.status === 'active');

  const onEnable = () => {
    if (!selectedId) return;
    if (!canEnableMore) {
      toast({
        title: 'Não foi possível habilitar',
        description: 'Já existe um piloto ativo. Desligue o piloto atual antes de habilitar outro.',
        variant: 'destructive',
      });
      return;
    }
    enableMut.mutate(
      { tenantId, targetUserId: selectedId, reason: 'sprint_6_6_rollout' },
      {
        onSuccess: () => {
          toast({ title: 'Piloto do Dashboard Comercial habilitado.' });
          setSelectedId('');
        },
        onError: (e: any) => {
          const msg = String(e?.message ?? '');
          const friendly = msg.includes('pilot_limit_reached')
            ? `Já existe um piloto ativo nesta fase. Desligue um usuário antes de habilitar outro. (limite técnico: ${MAX_CLOSER_PILOTS})`
            : msg.includes('requires_review')
              ? 'Este usuário precisa de revisão de Contexto CRM antes de virar piloto.'
              : msg;
          toast({ title: 'Falha ao habilitar', description: friendly, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ativação controlada do Dashboard Comercial</CardTitle>
        <CardDescription>
          Habilite o Dashboard Comercial para um usuário comercial validado por vez. O dashboard
          atual continua disponível como fallback.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="md:flex-1">
              <SelectValue placeholder="Selecione um usuário comercial elegível" />
            </SelectTrigger>
            <SelectContent>
              {eligible.length === 0 && (
                <SelectItem value="__none__" disabled>
                  Nenhum usuário comercial elegível
                </SelectItem>
              )}
              {eligible.map((c) => (
                <SelectItem key={c.userId} value={c.userId}>
                  {c.fullName ?? c.email ?? c.userId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={onEnable} disabled={!selectedId || !canEnableMore || enableMut.isPending}>
            {enableMut.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Habilitar piloto
          </Button>
        </div>
        {activePilots.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {activePilots.length === 1
              ? '1 usuário comercial está com o piloto ativo no momento.'
              : `${activePilots.length} usuários estão com o piloto ativo no momento.`}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Desligar o piloto faz o usuário voltar imediatamente ao dashboard atual.
        </p>
      </CardContent>
    </Card>
  );
}
