import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, ShieldCheck, Save } from 'lucide-react';
import { useCooldownPolicy, useUpsertCooldownPolicy } from '@/hooks/useEmailCadence';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';

interface Props {
  agentId: string;
  disabled?: boolean;
}

export default function BuilderCooldownsTab({ agentId, disabled }: Props) {
  const { data: user } = useCurrentUser();
  const orgId = user?.organization?.id;
  const { data: cooldown, isLoading } = useCooldownPolicy(agentId);
  const upsert = useUpsertCooldownPolicy();

  const [form, setForm] = useState({
    min_hours_between_emails_per_contact: 24,
    min_hours_between_emails_per_opportunity: 24,
    min_hours_between_same_subject: 72,
    min_hours_between_same_purpose: 48,
    max_emails_per_contact_7d: 3,
    max_emails_per_opportunity_7d: 4,
    max_emails_per_account_7d: 6,
    stop_if_last_email_unopened_count: null as number | null,
    stop_if_recent_bounce: true,
    stop_if_opt_out: true,
    stop_if_manual_contact_recent_hours: null as number | null,
    respect_business_hours: true,
    allowed_weekdays_json: [1, 2, 3, 4, 5],
    daily_send_window_start: '08:00',
    daily_send_window_end: '18:00',
    timezone: 'America/Sao_Paulo',
  });

  useEffect(() => {
    if (cooldown) {
      setForm({
        min_hours_between_emails_per_contact: cooldown.min_hours_between_emails_per_contact,
        min_hours_between_emails_per_opportunity: cooldown.min_hours_between_emails_per_opportunity,
        min_hours_between_same_subject: cooldown.min_hours_between_same_subject,
        min_hours_between_same_purpose: cooldown.min_hours_between_same_purpose,
        max_emails_per_contact_7d: cooldown.max_emails_per_contact_7d,
        max_emails_per_opportunity_7d: cooldown.max_emails_per_opportunity_7d,
        max_emails_per_account_7d: cooldown.max_emails_per_account_7d,
        stop_if_last_email_unopened_count: cooldown.stop_if_last_email_unopened_count,
        stop_if_recent_bounce: cooldown.stop_if_recent_bounce,
        stop_if_opt_out: cooldown.stop_if_opt_out,
        stop_if_manual_contact_recent_hours: cooldown.stop_if_manual_contact_recent_hours,
        respect_business_hours: cooldown.respect_business_hours,
        allowed_weekdays_json: (cooldown.allowed_weekdays_json as number[]) || [1, 2, 3, 4, 5],
        daily_send_window_start: cooldown.daily_send_window_start || '08:00',
        daily_send_window_end: cooldown.daily_send_window_end || '18:00',
        timezone: cooldown.timezone || 'America/Sao_Paulo',
      });
    }
  }, [cooldown]);

  const handleSave = async () => {
    if (!orgId) return;
    try {
      await upsert.mutateAsync({
        ...(cooldown?.id ? { id: cooldown.id } : {}),
        organization_id: orgId,
        agent_id: agentId,
        ...form,
      });
      toast.success('Cooldowns salvos');
    } catch { toast.error('Erro ao salvar'); }
  };

  const isAggressive = form.min_hours_between_emails_per_contact < 12 || form.max_emails_per_contact_7d > 5;
  const isLenient = form.min_hours_between_emails_per_contact > 72 || form.max_emails_per_contact_7d < 2;

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Cooldowns</h2>
        <p className="text-sm text-muted-foreground">Configure limites de frequência e anti-saturação do Email Agent.</p>
      </div>

      {isAggressive && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> Policy agressiva — risco de saturação e opt-out.
        </div>
      )}
      {isLenient && (
        <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg flex items-center gap-2 text-sm text-primary">
          <ShieldCheck className="h-4 w-4" /> Policy conservadora — leads podem esfriar.
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Intervalos mínimos</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label>Horas entre emails (contato)</Label>
            <Input type="number" value={form.min_hours_between_emails_per_contact} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, min_hours_between_emails_per_contact: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Horas entre emails (oportunidade)</Label>
            <Input type="number" value={form.min_hours_between_emails_per_opportunity} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, min_hours_between_emails_per_opportunity: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Horas entre mesmo assunto</Label>
            <Input type="number" value={form.min_hours_between_same_subject} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, min_hours_between_same_subject: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Horas entre mesmo propósito</Label>
            <Input type="number" value={form.min_hours_between_same_purpose} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, min_hours_between_same_purpose: parseInt(e.target.value) || 0 }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Limites semanais (7 dias)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <Label>Max por contato</Label>
            <Input type="number" value={form.max_emails_per_contact_7d} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, max_emails_per_contact_7d: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Max por oportunidade</Label>
            <Input type="number" value={form.max_emails_per_opportunity_7d} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, max_emails_per_opportunity_7d: parseInt(e.target.value) || 0 }))} />
          </div>
          <div>
            <Label>Max por conta</Label>
            <Input type="number" value={form.max_emails_per_account_7d} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, max_emails_per_account_7d: parseInt(e.target.value) || 0 }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Bloqueios automáticos</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Parar se bounce recente</Label>
            <Switch checked={form.stop_if_recent_bounce} disabled={disabled} onCheckedChange={(v) => setForm(f => ({ ...f, stop_if_recent_bounce: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Parar se opt-out</Label>
            <Switch checked={form.stop_if_opt_out} disabled={disabled} onCheckedChange={(v) => setForm(f => ({ ...f, stop_if_opt_out: v }))} />
          </div>
          <div className="flex items-center justify-between">
            <Label>Respeitar horário comercial</Label>
            <Switch checked={form.respect_business_hours} disabled={disabled} onCheckedChange={(v) => setForm(f => ({ ...f, respect_business_hours: v }))} />
          </div>
          <div>
            <Label>Bloquear se contato manual recente (horas)</Label>
            <Input type="number" value={form.stop_if_manual_contact_recent_hours ?? ''} disabled={disabled} placeholder="Ex: 24" onChange={(e) => setForm(f => ({ ...f, stop_if_manual_contact_recent_hours: e.target.value ? parseInt(e.target.value) : null }))} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Janela de envio</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-3 gap-4">
          <div>
            <Label>Início</Label>
            <Input type="time" value={form.daily_send_window_start} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, daily_send_window_start: e.target.value }))} />
          </div>
          <div>
            <Label>Fim</Label>
            <Input type="time" value={form.daily_send_window_end} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, daily_send_window_end: e.target.value }))} />
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={form.timezone} disabled={disabled} onChange={(e) => setForm(f => ({ ...f, timezone: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {!disabled && (
        <Button onClick={handleSave} disabled={upsert.isPending}>
          <Save className="h-4 w-4 mr-1" /> Salvar Cooldowns
        </Button>
      )}
    </div>
  );
}
