import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { UseFormReturn } from 'react-hook-form';
import { SIM_CARRIERS } from '@/lib/operations/inventoryEquipmentProfile';

export function RouterFactoryFields({ form }: { form: UseFormReturn<any> }) {
  const errs = (form.formState.errors as any)?.router_factory ?? {};
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados de fábrica do roteador</CardTitle>
        <p className="text-xs text-muted-foreground">
          Obrigatório para itens da categoria com perfil Roteador.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>SSID de fábrica</Label>
          <Input placeholder="Ex: NOID_5G_001" {...form.register('router_factory.ssid_factory')} />
          {errs.ssid_factory?.message && (
            <p className="text-xs text-destructive">{errs.ssid_factory.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Senha Wi-Fi de fábrica</Label>
          <Input
            placeholder="Senha padrão"
            {...form.register('router_factory.wifi_password_factory')}
          />
          {errs.wifi_password_factory?.message && (
            <p className="text-xs text-destructive">{errs.wifi_password_factory.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Usuário admin</Label>
          <Input placeholder="admin" {...form.register('router_factory.admin_user')} />
          {errs.admin_user?.message && (
            <p className="text-xs text-destructive">{errs.admin_user.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Senha admin</Label>
          <Input placeholder="Senha do painel" {...form.register('router_factory.admin_password')} />
          {errs.admin_password?.message && (
            <p className="text-xs text-destructive">{errs.admin_password.message}</p>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>IMEI</Label>
          <Input
            placeholder="15 dígitos"
            {...form.register('router_factory.imei')}
          />
          {errs.imei?.message && (
            <p className="text-xs text-destructive">{errs.imei.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function SimCardFactoryFields({ form }: { form: UseFormReturn<any> }) {
  const errs = (form.formState.errors as any)?.sim_card_factory ?? {};
  const carrier = form.watch('sim_card_factory.carrier');
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados do chip (SIM)</CardTitle>
        <p className="text-xs text-muted-foreground">
          Obrigatório para itens da categoria com perfil Chip.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label>ICCID</Label>
          <Input placeholder="89..." {...form.register('sim_card_factory.iccid')} />
          {errs.iccid?.message && (
            <p className="text-xs text-destructive">{errs.iccid.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Número da linha</Label>
          <Input placeholder="(11) 9..." {...form.register('sim_card_factory.line_number')} />
          {errs.line_number?.message && (
            <p className="text-xs text-destructive">{errs.line_number.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>Operadora</Label>
          <Select
            value={carrier ?? ''}
            onValueChange={(v) =>
              form.setValue('sim_card_factory.carrier', v, { shouldDirty: true, shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {SIM_CARRIERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errs.carrier?.message && (
            <p className="text-xs text-destructive">{errs.carrier.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label>APN</Label>
          <Input placeholder="zap.vivo.com.br" {...form.register('sim_card_factory.apn')} />
          {errs.apn?.message && (
            <p className="text-xs text-destructive">{errs.apn.message}</p>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>PIN (opcional)</Label>
          <Input placeholder="0000" {...form.register('sim_card_factory.pin')} />
          {errs.pin?.message && (
            <p className="text-xs text-destructive">{errs.pin.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
