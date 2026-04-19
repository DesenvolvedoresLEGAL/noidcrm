import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Bell, Clock, Mail, Monitor, Smartphone, Eye, AlertTriangle, MessageSquare, CalendarCheck, Users, Target, CalendarX } from 'lucide-react';
import { useNotificationSettings, type NotificationSettings } from '@/hooks/useNotificationSettings';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { DailyDigestHealthCard } from '@/components/admin/notifications/DailyDigestHealthCard';

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const h = String(i).padStart(2, '0');
  return { value: `${h}:00`, label: `${h}:00` };
});

export default function NotificationPreferences() {
  const { settings, isLoading, isSaving, saveSettings } = useNotificationSettings();
  const [form, setForm] = useState<Partial<NotificationSettings>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings && settings.id) {
      setForm({});
      setDirty(false);
    }
  }, [settings?.id]);

  const currentValue = <K extends keyof NotificationSettings>(key: K): NotificationSettings[K] => {
    return (key in form ? form[key] : settings[key]) as NotificationSettings[K];
  };

  const update = <K extends keyof NotificationSettings>(key: K, value: NotificationSettings[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    if (!dirty) return;
    saveSettings(form);
    setDirty(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
        <p className="text-muted-foreground mt-1">Configure como e quando você recebe alertas do sistema.</p>
      </div>

      <DailyDigestHealthCard />

      {/* Bloco 1: Resumo Diário */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Resumo Diário</CardTitle>
          </div>
          <CardDescription>Receba um resumo consolidado das atividades do dia anterior.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="digest-enabled" className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-muted-foreground" />
              Receber resumo diário
            </Label>
            <Switch
              id="digest-enabled"
              checked={currentValue('daily_digest_enabled')}
              onCheckedChange={v => update('daily_digest_enabled', v)}
            />
          </div>

          {currentValue('daily_digest_enabled') && (
            <>
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground">Horário do resumo</Label>
                <Select
                  value={currentValue('daily_digest_time')}
                  onValueChange={v => update('daily_digest_time', v)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {HOURS.map(h => (
                      <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />
              <p className="text-sm font-medium text-muted-foreground">Canais do resumo</p>

              <div className="flex items-center justify-between">
                <Label htmlFor="digest-email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  Receber por e-mail
                </Label>
                <Switch
                  id="digest-email"
                  checked={currentValue('daily_digest_email_enabled')}
                  onCheckedChange={v => update('daily_digest_email_enabled', v)}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="digest-dashboard" className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  Mostrar na dashboard
                </Label>
                <Switch
                  id="digest-dashboard"
                  checked={currentValue('daily_digest_dashboard_enabled')}
                  onCheckedChange={v => update('daily_digest_dashboard_enabled', v)}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Bloco 2: Alertas em Tempo Real */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Alertas em Tempo Real</CardTitle>
          </div>
          <CardDescription>Canais para receber alertas instantâneos.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="rt-inapp" className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-muted-foreground" />
              Alertas dentro do CRM
            </Label>
            <Switch
              id="rt-inapp"
              checked={currentValue('realtime_in_app_enabled')}
              onCheckedChange={v => update('realtime_in_app_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="rt-push" className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-muted-foreground" />
              Alertas do navegador
            </Label>
            <Switch
              id="rt-push"
              checked={currentValue('realtime_browser_push_enabled')}
              onCheckedChange={v => update('realtime_browser_push_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="rt-email" className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              Alertas por e-mail
            </Label>
            <Switch
              id="rt-email"
              checked={currentValue('realtime_email_enabled')}
              onCheckedChange={v => update('realtime_email_enabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bloco 3: Tipos de Evento */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Tipos de Evento</CardTitle>
          </div>
          <CardDescription>Escolha quais eventos devem gerar notificações.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="alert-view" className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" />
              Proposta visualizada
            </Label>
            <Switch
              id="alert-view"
              checked={currentValue('proposal_view_alert_enabled')}
              onCheckedChange={v => update('proposal_view_alert_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="alert-expiring" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              Proposta vencendo
            </Label>
            <Switch
              id="alert-expiring"
              checked={currentValue('proposal_expiring_alert_enabled')}
              onCheckedChange={v => update('proposal_expiring_alert_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="alert-reply" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              Resposta do cliente
            </Label>
            <Switch
              id="alert-reply"
              checked={currentValue('client_reply_alert_enabled')}
              onCheckedChange={v => update('client_reply_alert_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="alert-activity" className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              Atividades de hoje
            </Label>
            <Switch
              id="alert-activity"
              checked={currentValue('activity_due_alert_enabled')}
              onCheckedChange={v => update('activity_due_alert_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="alert-overdue" className="flex items-center gap-2">
              <CalendarX className="h-4 w-4 text-muted-foreground" />
              Atividades atrasadas
            </Label>
            <Switch
              id="alert-overdue"
              checked={currentValue('activity_overdue_alert_enabled')}
              onCheckedChange={v => update('activity_overdue_alert_enabled', v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Bloco 4: Escopo */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Escopo</CardTitle>
          </div>
          <CardDescription>Defina o alcance das notificações que você recebe.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={currentValue('notify_scope')}
            onValueChange={(v) => update('notify_scope', v as 'mine_only' | 'mine_and_team')}
            className="space-y-3"
          >
            <div className="flex items-start gap-3">
              <RadioGroupItem value="mine_only" id="scope-mine" className="mt-0.5" />
              <div>
                <Label htmlFor="scope-mine" className="font-medium cursor-pointer">Apenas minhas oportunidades</Label>
                <p className="text-sm text-muted-foreground">Receba alertas apenas sobre oportunidades atribuídas a você.</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <RadioGroupItem value="mine_and_team" id="scope-team" className="mt-0.5" />
              <div>
                <Label htmlFor="scope-team" className="font-medium cursor-pointer">Minhas + oportunidades do time</Label>
                <p className="text-sm text-muted-foreground">Receba alertas sobre suas oportunidades e as do seu time.</p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={!dirty || isSaving}>
          {isSaving ? 'Salvando...' : 'Salvar Preferências'}
        </Button>
      </div>
    </div>
  );
}
