import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, Eye } from 'lucide-react';
import { useApolloRules } from '@/hooks/intelligence/useApolloInvisible';
import { useToast } from '@/hooks/use-toast';

export function ApolloInvisibleSettingsCard() {
  const { data, isLoading, save, saving } = useApolloRules();
  const { toast } = useToast();
  const [form, setForm] = useState({
    enabled: true,
    minimum_priority_score: 180,
    required_domain: true,
    max_contacts_per_company: 3,
    max_apollo_credits_per_day: 500,
    max_apollo_credits_per_batch: 200,
    auto_select_primary_contact: true,
    auto_reveal_contact: true,
    // KAI.15.1 governance
    auto_reveal_phone: true,
    auto_reveal_email: false,
    auto_reveal_both: false,
    phone_reveal_min_score: 180,
    email_reveal_min_score: 220,
    max_phone_reveals_per_company: 2,
    max_email_reveals_per_company: 0,
    fallback_to_email_if_no_phone: true,
  });

  useEffect(() => {
    if (data) {
      setForm({
        enabled: data.enabled,
        minimum_priority_score: data.minimum_priority_score,
        required_domain: data.required_domain,
        max_contacts_per_company: data.max_contacts_per_company,
        max_apollo_credits_per_day: data.max_apollo_credits_per_day,
        max_apollo_credits_per_batch: data.max_apollo_credits_per_batch,
        auto_select_primary_contact: data.auto_select_primary_contact,
        auto_reveal_contact: data.auto_reveal_contact,
        auto_reveal_phone: data.auto_reveal_phone ?? true,
        auto_reveal_email: data.auto_reveal_email ?? false,
        auto_reveal_both: data.auto_reveal_both ?? false,
        phone_reveal_min_score: data.phone_reveal_min_score ?? 180,
        email_reveal_min_score: data.email_reveal_min_score ?? 220,
        max_phone_reveals_per_company: data.max_phone_reveals_per_company ?? 2,
        max_email_reveals_per_company: data.max_email_reveals_per_company ?? 0,
        fallback_to_email_if_no_phone: data.fallback_to_email_if_no_phone ?? true,
      });
    }
  }, [data]);

  const handleSave = async () => {
    try {
      await save(form);
      toast({ title: 'Regras do Apollo salvas' });
    } catch (e) {
      toast({ title: 'Erro ao salvar', description: String(e), variant: 'destructive' });
    }
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Eye className="h-4 w-4" /> Apollo Invisible Mode</h3>
          <p className="text-xs text-muted-foreground">
            O Kairós decide automaticamente quando consultar Apollo. Você só vê decisores e contatos prontos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
          <span className="text-xs">{form.enabled ? 'Ativo' : 'Pausado'}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando regras…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Score mínimo de prioridade</Label>
            <Input type="number" value={form.minimum_priority_score}
              onChange={(e) => setForm({ ...form, minimum_priority_score: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Máx contatos por empresa</Label>
            <Input type="number" value={form.max_contacts_per_company}
              onChange={(e) => setForm({ ...form, max_contacts_per_company: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Limite diário de créditos</Label>
            <Input type="number" value={form.max_apollo_credits_per_day}
              onChange={(e) => setForm({ ...form, max_apollo_credits_per_day: Number(e.target.value) })} />
          </div>
          <div className="space-y-1.5">
            <Label>Limite por lote</Label>
            <Input type="number" value={form.max_apollo_credits_per_batch}
              onChange={(e) => setForm({ ...form, max_apollo_credits_per_batch: Number(e.target.value) })} />
          </div>
          <div className="flex items-center justify-between md:col-span-2">
            <Label>Exigir domínio corporativo</Label>
            <Switch checked={form.required_domain} onCheckedChange={(v) => setForm({ ...form, required_domain: v })} />
          </div>
          <div className="flex items-center justify-between md:col-span-2">
            <Label>Marcar contato principal automaticamente</Label>
            <Switch checked={form.auto_select_primary_contact}
              onCheckedChange={(v) => setForm({ ...form, auto_select_primary_contact: v })} />
          </div>
          <div className="flex items-center justify-between md:col-span-2">
            <Label>Revelar contatos automaticamente (legado)</Label>
            <Switch checked={form.auto_reveal_contact}
              onCheckedChange={(v) => setForm({ ...form, auto_reveal_contact: v })} />
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="space-y-3 pt-3 border-t">
          <div>
            <h4 className="font-semibold text-sm">Governança de Revelação</h4>
            <p className="text-xs text-muted-foreground">
              Separe perfil, telefone e e-mail. Apollo só consome crédito do canal que a operação usa.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="flex items-center justify-between md:col-span-2">
              <Label>Revelar telefone automaticamente</Label>
              <Switch checked={form.auto_reveal_phone}
                onCheckedChange={(v) => setForm({ ...form, auto_reveal_phone: v })} />
            </div>
            <div className="flex items-center justify-between md:col-span-2">
              <Label>Revelar e-mail automaticamente</Label>
              <Switch checked={form.auto_reveal_email}
                onCheckedChange={(v) => setForm({ ...form, auto_reveal_email: v })} />
            </div>
            <div className="space-y-1.5">
              <Label>Score mínimo para telefone</Label>
              <Input type="number" value={form.phone_reveal_min_score}
                onChange={(e) => setForm({ ...form, phone_reveal_min_score: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Score mínimo para e-mail</Label>
              <Input type="number" value={form.email_reveal_min_score}
                onChange={(e) => setForm({ ...form, email_reveal_min_score: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Máx telefones por empresa</Label>
              <Input type="number" value={form.max_phone_reveals_per_company}
                onChange={(e) => setForm({ ...form, max_phone_reveals_per_company: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Máx e-mails por empresa</Label>
              <Input type="number" value={form.max_email_reveals_per_company}
                onChange={(e) => setForm({ ...form, max_email_reveals_per_company: Number(e.target.value) })} />
            </div>
            <div className="flex items-center justify-between md:col-span-2">
              <Label>Fallback para e-mail se telefone não encontrado</Label>
              <Switch checked={form.fallback_to_email_if_no_phone}
                onCheckedChange={(v) => setForm({ ...form, fallback_to_email_if_no_phone: v })} />
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
          Salvar
        </Button>
      </div>
    </Card>
  );
}
