import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useQueryClient } from '@tanstack/react-query';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { updateAllocationCustomConfig } from '@/services/operations/inventoryAllocations';
import {
  routerCustomSchema,
  simCardCustomSchema,
  getRouterCustom,
  getSimCardCustom,
  mergeRouterCustomConfig,
  mergeSimCardCustomConfig,
  type ConnectivityEquipmentProfile,
} from '@/vertical-packs/connectivity/inventory';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocationId: string | null;
  profile: ConnectivityEquipmentProfile;
  itemName?: string | null;
  currentConfig?: Record<string, unknown> | null;
  onSaved?: () => void;
}


export function AllocationCustomConfigDialog({
  open,
  onOpenChange,
  allocationId,
  profile,
  itemName,
  currentConfig,
  onSaved,
}: Props) {
  const { user } = useSupabaseAuth();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const isRouter = profile === 'router';
  const schema = isRouter ? routerCustomSchema : simCardCustomSchema;
  const form = useForm<any>({ resolver: zodResolver(schema) as any });

  useEffect(() => {
    if (!open) return;
    if (isRouter) {
      const r = getRouterCustom(currentConfig) ?? { ssid_custom: '', wifi_password_custom: '', notes: '' };
      form.reset(r);
    } else {
      const s = getSimCardCustom(currentConfig) ?? { apn_operational: '', notes: '' };
      form.reset(s);
    }
  }, [open, currentConfig, isRouter, form]);

  const onSubmit = async (data: any) => {
    if (!allocationId) return;
    setSaving(true);
    try {
      let merged: Record<string, unknown>;
      if (profile === 'router') {
        merged = mergeRouterCustomConfig(currentConfig ?? {}, {
          ssid_custom: data.ssid_custom,
          wifi_password_custom: data.wifi_password_custom,
          notes: data.notes || null,
        });
      } else if (profile === 'sim_card') {
        merged = mergeSimCardCustomConfig(currentConfig ?? {}, {
          apn_operational: data.apn_operational,
          notes: data.notes || null,
        });
      } else {
        throw new Error('Perfil de conectividade não suportado.');
      }
      await updateAllocationCustomConfig(allocationId, merged, user?.id);
      toast.success('Configuração salva.');
      qc.invalidateQueries({ queryKey: ['inventory-pre-reservation-allocations'] });
      onSaved?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Não foi possível salvar a configuração.');
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isRouter ? 'Configurar rede personalizada' : 'Configurar chip operacional'}</DialogTitle>
          <DialogDescription>
            {itemName ? `Item: ${itemName}` : null}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {isRouter ? (
            <>
              <div className="space-y-1">
                <Label>SSID personalizado</Label>
                <Input placeholder="Ex: EVENTO_CLIENTE_X" {...form.register('ssid_custom')} />
                {(form.formState.errors as any)?.ssid_custom?.message && (
                  <p className="text-xs text-destructive">{(form.formState.errors as any).ssid_custom.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Senha Wi-Fi personalizada</Label>
                <Input placeholder="Mínimo 8 caracteres" {...form.register('wifi_password_custom')} />
                {(form.formState.errors as any)?.wifi_password_custom?.message && (
                  <p className="text-xs text-destructive">{(form.formState.errors as any).wifi_password_custom.message}</p>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <Label>APN operacional</Label>
              <Input placeholder="Ex: zap.vivo.com.br" {...form.register('apn_operational')} />
              {(form.formState.errors as any)?.apn_operational?.message && (
                <p className="text-xs text-destructive">{(form.formState.errors as any).apn_operational.message}</p>
              )}
            </div>
          )}
          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea rows={2} placeholder="Opcional" {...form.register('notes')} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
