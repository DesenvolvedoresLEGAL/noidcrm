import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgentBuilderConfig, AIAgentEscalationPolicy } from '@/types/ai-agents';

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderEscalationTab({ config, onSave, saving, disabled }: Props) {
  const [form, setForm] = useState<Omit<AIAgentEscalationPolicy, 'id' | 'organization_id' | 'agent_id' | 'agent_version_id' | 'created_at' | 'updated_at'>>({
    escalation_mode: 'conditional',
    confidence_threshold: 0.7,
    risk_threshold: 'high',
    escalation_targets_json: [],
    approval_rules_json: [],
    fallback_actions_json: [],
  });

  useEffect(() => {
    if (config.escalation) {
      setForm({
        escalation_mode: config.escalation.escalation_mode,
        confidence_threshold: config.escalation.confidence_threshold ?? 0.7,
        risk_threshold: config.escalation.risk_threshold || 'high',
        escalation_targets_json: config.escalation.escalation_targets_json || [],
        approval_rules_json: config.escalation.approval_rules_json || [],
        fallback_actions_json: config.escalation.fallback_actions_json || [],
      });
    }
  }, [config.escalation]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Escalonamento</h2>
          <p className="text-sm text-muted-foreground">Defina quando o agente chama um humano</p>
        </div>
        {!disabled && (
          <Button onClick={() => onSave(form)} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-sm">Modo de Escalonamento</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select value={form.escalation_mode} onValueChange={v => setForm(f => ({ ...f, escalation_mode: v as any }))} disabled={disabled}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="never">Nunca escalar</SelectItem>
                <SelectItem value="always">Sempre escalar</SelectItem>
                <SelectItem value="conditional">Condicional</SelectItem>
              </SelectContent>
            </Select>
            {form.escalation_mode === 'never' && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ Agente nunca escalará — certifique-se que a autonomia permite isso.</p>
            )}
            {form.escalation_mode === 'always' && (
              <p className="text-xs text-muted-foreground">Todas as ações passarão por aprovação humana antes de executar.</p>
            )}
          </CardContent>
        </Card>

        {form.escalation_mode === 'conditional' && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Thresholds</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Confiança mínima (0-1)</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.confidence_threshold ?? ''} onChange={e => setForm(f => ({ ...f, confidence_threshold: parseFloat(e.target.value) || null }))} disabled={disabled} />
                <p className="text-xs text-muted-foreground">Abaixo deste valor, escalona para humano</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nível de risco para escalar</Label>
                <Select value={form.risk_threshold || 'high'} onValueChange={v => setForm(f => ({ ...f, risk_threshold: v }))} disabled={disabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Casos Comuns de Escalonamento</CardTitle></CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
            <li>Confiança menor que o threshold definido</li>
            <li>Risco alto ou crítico detectado</li>
            <li>Conta VIP envolvida</li>
            <li>Tool de risco crítico selecionada</li>
            <li>Contexto ambíguo ou insuficiente</li>
            <li>Autonomia em modo assisted</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
