import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSetUserDynamicDashboard } from '@/hooks/dashboard/useCloserDashboardViews';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface Props {
  tenantId: string;
  userId: string;
  enabled: boolean;
  disabled?: boolean;
}

export function UserDynamicDashboardToggle({ tenantId, userId, enabled, disabled }: Props) {
  const [optimistic, setOptimistic] = useState(enabled);
  const mut = useSetUserDynamicDashboard();
  const { toast } = useToast();

  const handle = async (next: boolean) => {
    setOptimistic(next);
    try {
      await mut.mutateAsync({ tenantId, userId, enabled: next });
      toast({
        title: next ? 'Dashboard dinâmico ativado' : 'Dashboard dinâmico desativado',
        description: 'A flag global continua desligada — esta ativação é apenas individual.',
      });
    } catch (err: any) {
      setOptimistic(!next);
      toast({
        title: 'Não foi possível atualizar',
        description: err?.message ?? 'Erro desconhecido.',
        variant: 'destructive',
      });
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="inline-flex items-center">
            <Switch
              checked={optimistic}
              onCheckedChange={handle}
              disabled={disabled || mut.isPending}
              aria-label="Habilitar dashboard dinâmico"
            />
          </div>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs">
          Ativa o dashboard dinâmico apenas para este usuário. A flag global da organização
          continua desligada — nenhum outro usuário é afetado.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
