import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useEnableCloserPilot, MAX_CLOSER_PILOTS } from '@/hooks/dashboard/useCloserDashboardObservability';
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
        title: 'Limite atingido',
        description: `Limite de ${MAX_CLOSER_PILOTS} Closers pilotos nesta fase. Desligue um piloto antes de adicionar outro.`,
        variant: 'destructive',
      });
      return;
    }
    enableMut.mutate(
      { tenantId, targetUserId: selectedId, reason: 'sprint_6_5_rollout' },
      {
        onSuccess: () => {
          toast({ title: 'Closer piloto habilitado.' });
          setSelectedId('');
        },
        onError: (e: any) => {
          const msg = String(e?.message ?? '');
          const friendly = msg.includes('pilot_limit_reached')
            ? `Limite de ${MAX_CLOSER_PILOTS} Closers pilotos nesta fase. Desligue um piloto antes de adicionar outro.`
            : msg.includes('requires_review')
              ? 'Este usuário precisa de revisão de contexto antes de virar piloto.'
              : msg;
          toast({ title: 'Falha ao habilitar', description: friendly, variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Rollout controlado do Dashboard Closer</CardTitle>
            <CardDescription>
              Nesta fase, libere no máximo {MAX_CLOSER_PILOTS} Closers por tenant.
            </CardDescription>
          </div>
          <Badge variant={canEnableMore ? 'default' : 'destructive'}>
            {activePilots.length} / {MAX_CLOSER_PILOTS}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col md:flex-row gap-2">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="md:flex-1">
              <SelectValue placeholder="Selecione um Closer elegível" />
            </SelectTrigger>
            <SelectContent>
              {eligible.length === 0 && (
                <SelectItem value="__none__" disabled>
                  Nenhum Closer elegível
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
        {!canEnableMore && (
          <p className="text-xs text-muted-foreground">
            Limite de {MAX_CLOSER_PILOTS} Closers pilotos nesta fase. Desligue um piloto antes de adicionar outro.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
