import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import type { AgentBuilderConfig, AIAgentMemoryProfile } from '@/types/ai-agents';

const CONTEXT_SOURCES = [
  { key: 'opportunity', label: 'Oportunidade' },
  { key: 'account', label: 'Conta' },
  { key: 'contact', label: 'Contato' },
  { key: 'activities', label: 'Atividades' },
  { key: 'proposals', label: 'Propostas' },
  { key: 'emails', label: 'Histórico de Emails' },
  { key: 'wins_losses', label: 'Wins e Losses' },
  { key: 'playbooks', label: 'Playbooks' },
];

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderMemoryTab({ config, onSave, saving, disabled }: Props) {
  const [form, setForm] = useState<Omit<AIAgentMemoryProfile, 'id' | 'organization_id' | 'agent_id' | 'agent_version_id' | 'created_at' | 'updated_at'>>({
    short_term_enabled: true,
    operational_memory_enabled: false,
    learning_memory_enabled: false,
    short_term_window: 10,
    context_sources_json: [],
    retention_policy_json: {},
    recent_interactions_enabled: true,
    recent_interactions_lookback_hours: 72,
  });

  useEffect(() => {
    if (config.memory) {
      const m: any = config.memory;
      setForm({
        short_term_enabled: m.short_term_enabled,
        operational_memory_enabled: m.operational_memory_enabled,
        learning_memory_enabled: m.learning_memory_enabled,
        short_term_window: m.short_term_window,
        context_sources_json: m.context_sources_json || [],
        retention_policy_json: m.retention_policy_json || {},
        recent_interactions_enabled: m.recent_interactions_enabled ?? true,
        recent_interactions_lookback_hours: m.recent_interactions_lookback_hours ?? 72,
      });
    }
  }, [config.memory]);

  const toggleSource = (key: string) => {
    setForm(f => ({
      ...f,
      context_sources_json: f.context_sources_json.includes(key)
        ? f.context_sources_json.filter(s => s !== key)
        : [...f.context_sources_json, key],
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Memória</h2>
          <p className="text-sm text-muted-foreground">Defina do que o agente pode se lembrar</p>
        </div>
        {!disabled && (
          <Button onClick={() => onSave(form)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Memória Curta</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Habilitada</Label>
              <Switch checked={form.short_term_enabled} onCheckedChange={v => setForm(f => ({ ...f, short_term_enabled: v }))} disabled={disabled} />
            </div>
            {form.short_term_enabled && (
              <div className="space-y-1">
                <Label className="text-xs">Janela de contexto</Label>
                <Input type="number" value={form.short_term_window} onChange={e => setForm(f => ({ ...f, short_term_window: Number(e.target.value) }))} disabled={disabled} />
                <p className="text-xs text-muted-foreground">Últimas N interações consideradas</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Memória Operacional</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Habilitada</Label>
              <Switch checked={form.operational_memory_enabled} onCheckedChange={v => setForm(f => ({ ...f, operational_memory_enabled: v }))} disabled={disabled} />
            </div>
            <p className="text-xs text-muted-foreground">Mantém estado de tarefas em execução e decisões recentes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Memória de Aprendizagem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Habilitada</Label>
              <Switch checked={form.learning_memory_enabled} onCheckedChange={v => setForm(f => ({ ...f, learning_memory_enabled: v }))} disabled={disabled} />
            </div>
            <p className="text-xs text-muted-foreground">Aprende com feedbacks e correções humanas</p>
          </CardContent>
        </Card>
      </div>

      {(form.operational_memory_enabled && form.learning_memory_enabled) && (
        <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm text-yellow-800 dark:text-yellow-300">
          ⚠️ Memória ampla habilitada pode aumentar custo e risco de ruído por execução.
        </div>
      )}

      <Card className="border-primary/30">
        <CardHeader>
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Interações Recentes (anti over-communication)</span>
            <Switch
              checked={!!form.recent_interactions_enabled}
              onCheckedChange={v => setForm(f => ({ ...f, recent_interactions_enabled: v }))}
              disabled={disabled}
            />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Considera emails, WhatsApp e atividades das últimas N horas para evitar contato duplicado mesmo fora do CRM.
          </p>
          {form.recent_interactions_enabled && (
            <div className="space-y-1 max-w-xs">
              <Label className="text-xs">Janela de lookback (horas)</Label>
              <Input
                type="number"
                min="1"
                value={form.recent_interactions_lookback_hours ?? 72}
                onChange={e => setForm(f => ({ ...f, recent_interactions_lookback_hours: parseInt(e.target.value) || 72 }))}
                disabled={disabled}
              />
              <p className="text-xs text-muted-foreground">Padrão: 72h (3 dias)</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">Fontes de Contexto</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {CONTEXT_SOURCES.map(src => (
              <Badge
                key={src.key}
                variant={form.context_sources_json.includes(src.key) ? 'default' : 'outline'}
                className={`cursor-pointer ${disabled ? 'pointer-events-none opacity-60' : ''}`}
                onClick={() => !disabled && toggleSource(src.key)}
              >
                {src.label}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
