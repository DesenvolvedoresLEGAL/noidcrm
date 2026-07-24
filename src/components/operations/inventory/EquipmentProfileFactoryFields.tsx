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
import { SIM_CARRIERS } from '@/vertical-packs/connectivity/inventory';

export function RouterFactoryFields({ form }: { form: UseFormReturn<any> }) {
  const errs = (form.formState.errors as any)?.router_factory ?? {};
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Dados de fábrica do roteador</CardTitle>
        <p className="text-xs text-muted-foreground">
          Cadastro do roteador apenas. A associação com chip(s) acontece depois, na separação do estoque após a venda.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="router_factory.ssid_factory">SSID de fábrica</Label>
          <Input
            id="router_factory.ssid_factory"
            placeholder="Ex: NOID_5G_001"
            {...form.register('router_factory.ssid_factory')}
          />
          {errs.ssid_factory?.message && (
            <p className="text-xs text-destructive">{errs.ssid_factory.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="router_factory.wifi_password_factory">Senha Wi-Fi de fábrica</Label>
          <Input
            id="router_factory.wifi_password_factory"
            placeholder="Senha padrão"
            {...form.register('router_factory.wifi_password_factory')}
          />
          {errs.wifi_password_factory?.message && (
            <p className="text-xs text-destructive">{errs.wifi_password_factory.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="router_factory.admin_user">Usuário admin</Label>
          <Input
            id="router_factory.admin_user"
            placeholder="admin"
            {...form.register('router_factory.admin_user')}
          />
          {errs.admin_user?.message && (
            <p className="text-xs text-destructive">{errs.admin_user.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="router_factory.admin_password">Senha admin</Label>
          <Input
            id="router_factory.admin_password"
            placeholder="Senha do painel"
            {...form.register('router_factory.admin_password')}
          />
          {errs.admin_password?.message && (
            <p className="text-xs text-destructive">{errs.admin_password.message}</p>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="router_factory.imei">IMEI</Label>
          <Input
            id="router_factory.imei"
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
          Cadastro do chip apenas. A associação a um roteador acontece depois, na separação do estoque após a venda.
        </p>
      </CardHeader>
      <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="sim_card_factory.iccid">ICCID</Label>
          <Input
            id="sim_card_factory.iccid"
            placeholder="89..."
            {...form.register('sim_card_factory.iccid')}
          />
          {errs.iccid?.message && (
            <p className="text-xs text-destructive">{errs.iccid.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="sim_card_factory.line_number">Número da linha</Label>
          <Input
            id="sim_card_factory.line_number"
            placeholder="(11) 9..."
            {...form.register('sim_card_factory.line_number')}
          />
          {errs.line_number?.message && (
            <p className="text-xs text-destructive">{errs.line_number.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor="sim_card_factory.carrier">Operadora</Label>
          <Select
            value={carrier ?? ''}
            onValueChange={(v) =>
              form.setValue('sim_card_factory.carrier', v, { shouldDirty: true, shouldValidate: true })
            }
          >
            <SelectTrigger id="sim_card_factory.carrier">
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
          <Label htmlFor="sim_card_factory.apn">APN</Label>
          <Input
            id="sim_card_factory.apn"
            placeholder="zap.vivo.com.br"
            {...form.register('sim_card_factory.apn')}
          />
          {errs.apn?.message && (
            <p className="text-xs text-destructive">{errs.apn.message}</p>
          )}
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="sim_card_factory.pin">PIN (opcional)</Label>
          <Input
            id="sim_card_factory.pin"
            placeholder="0000"
            {...form.register('sim_card_factory.pin')}
          />
          {errs.pin?.message && (
            <p className="text-xs text-destructive">{errs.pin.message}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
