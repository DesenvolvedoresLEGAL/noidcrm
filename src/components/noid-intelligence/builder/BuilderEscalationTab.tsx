import { useState, useEffect } from 'react';
import { Save, CheckCircle2, ShieldAlert, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import type { AgentBuilderConfig, AIAgentEscalationPolicy, AutoSendRules, RequireApprovalRules, BlockRules } from '@/types/ai-agents';

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

type FormState = Omit<AIAgentEscalationPolicy, 'id' | 'organization_id' | 'agent_id' | 'agent_version_id' | 'created_at' | 'updated_at'> & {
  auto_send_rules: AutoSendRules;
  require_approval_rules: RequireApprovalRules;
  block_rules: BlockRules;
};

const DEFAULT_AUTO: AutoSendRules = { confidence_min: 0.85, deal_value_max: 50000, risk_max: 'low' };
const DEFAULT_APPROVAL: RequireApprovalRules = { deal_value_min: 50000, risk_min: 'high', vip_account: true };
const DEFAULT_BLOCK: BlockRules = { last_contact_hours_min: 24, max_emails_in_window: 3, window_days: 7 };

export default function BuilderEscalationTab({ config, onSave, saving, disabled }: Props) {
  const [form, setForm] = useState<FormState>({
    escalation_mode: 'conditional',
    confidence_threshold: 0.7,
    risk_threshold: 'high',
    escalation_targets_json: [],
    approval_rules_json: [],
    fallback_actions_json: [],
    auto_send_rules: DEFAULT_AUTO,
    require_approval_rules: DEFAULT_APPROVAL,
    block_rules: DEFAULT_BLOCK,
  });

  useEffect(() => {
    if (config.escalation) {
      const e: any = config.escalation;
      setForm({
        escalation_mode: e.escalation_mode,
        confidence_threshold: e.confidence_threshold ?? 0.7,
        risk_threshold: e.risk_threshold || 'high',
        escalation_targets_json: e.escalation_targets_json || [],
        approval_rules_json: e.approval_rules_json || [],
        fallback_actions_json: e.fallback_actions_json || [],
        auto_send_rules: { ...DEFAULT_AUTO, ...(e.auto_send_rules || {}) },
        require_approval_rules: { ...DEFAULT_APPROVAL, ...(e.require_approval_rules || {}) },
        block_rules: { ...DEFAULT_BLOCK, ...(e.block_rules || {}) },
      });
    }
  }, [config.escalation]);

  const updateAuto = (patch: Partial<AutoSendRules>) =>
    setForm(f => ({ ...f, auto_send_rules: { ...f.auto_send_rules, ...patch } }));
  const updateApproval = (patch: Partial<RequireApprovalRules>) =>
    setForm(f => ({ ...f, require_approval_rules: { ...f.require_approval_rules, ...patch } }));
  const updateBlock = (patch: Partial<BlockRules>) =>
    setForm(f => ({ ...f, block_rules: { ...f.block_rules, ...patch } }));

  const showGranular = form.escalation_mode === 'conditional';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Escalonamento & Política de Decisão</h2>
          <p className="text-sm text-muted-foreground">Defina quando o agente envia, aprova ou bloqueia uma ação</p>
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
                <SelectItem value="conditional">Condicional (regras granulares)</SelectItem>
              </SelectContent>
            </Select>
            {form.escalation_mode === 'never' && (
              <p className="text-xs text-yellow-700 dark:text-yellow-400">⚠️ Agente nunca escalará — certifique-se que a autonomia permite isso.</p>
            )}
            {form.escalation_mode === 'always' && (
              <p className="text-xs text-muted-foreground">Todas as ações passarão por aprovação humana antes de executar.</p>
            )}
            {showGranular && (
              <p className="text-xs text-muted-foreground">As 3 regras abaixo definem o comportamento granular.</p>
            )}
          </CardContent>
        </Card>

        {showGranular && (
          <Card>
            <CardHeader><CardTitle className="text-sm">Thresholds Globais (fallback)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Confiança mínima geral (0-1)</Label>
                <Input type="number" step="0.01" min="0" max="1" value={form.confidence_threshold ?? ''} onChange={e => setForm(f => ({ ...f, confidence_threshold: parseFloat(e.target.value) || null }))} disabled={disabled} />
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

      {showGranular && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* AUTO-SEND */}
          <Card className="border-green-200 dark:border-green-900/40 bg-green-50/40 dark:bg-green-950/10">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-green-800 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" /> Auto-enviar quando
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-xs">Confiança mínima</Label>
                  <span className="text-xs font-medium">{((form.auto_send_rules.confidence_min ?? 0.85) * 100).toFixed(0)}%</span>
                </div>
                <Slider min={0} max={1} step={0.05} value={[form.auto_send_rules.confidence_min ?? 0.85]} onValueChange={(v) => updateAuto({ confidence_min: v[0] })} disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Valor máx do deal (R$)</Label>
                <Input type="number" min="0" value={form.auto_send_rules.deal_value_max ?? ''} placeholder="Sem limite"
                  onChange={e => updateAuto({ deal_value_max: e.target.value ? parseFloat(e.target.value) : null })}
                  disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Risco máximo permitido</Label>
                <Select value={form.auto_send_rules.risk_max || 'low'} onValueChange={(v) => updateAuto({ risk_max: v as any })} disabled={disabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">Se TODAS as condições baterem, o email é enviado automaticamente.</p>
            </CardContent>
          </Card>

          {/* REQUIRE APPROVAL */}
          <Card className="border-yellow-200 dark:border-yellow-900/40 bg-yellow-50/40 dark:bg-yellow-950/10">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-yellow-800 dark:text-yellow-400">
                <ShieldAlert className="h-4 w-4" /> Exigir aprovação quando
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Valor mín do deal (R$)</Label>
                <Input type="number" min="0" value={form.require_approval_rules.deal_value_min ?? ''} placeholder="Sem mínimo"
                  onChange={e => updateApproval({ deal_value_min: e.target.value ? parseFloat(e.target.value) : null })}
                  disabled={disabled} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Risco mínimo</Label>
                <Select value={form.require_approval_rules.risk_min || 'high'} onValueChange={(v) => updateApproval({ risk_min: v as any })} disabled={disabled}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixo</SelectItem>
                    <SelectItem value="medium">Médio</SelectItem>
                    <SelectItem value="high">Alto</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs">Conta marcada como VIP</Label>
                <Switch checked={!!form.require_approval_rules.vip_account} onCheckedChange={(v) => updateApproval({ vip_account: v })} disabled={disabled} />
              </div>
              <p className="text-xs text-muted-foreground">Se QUALQUER condição bater, vai pra fila de aprovação humana.</p>
            </CardContent>
          </Card>

          {/* BLOCK */}
          <Card className="border-red-200 dark:border-red-900/40 bg-red-50/40 dark:bg-red-950/10">
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2 text-red-800 dark:text-red-400">
                <Ban className="h-4 w-4" /> Bloquear quando
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs">Último contato há menos de (horas)</Label>
                <Input type="number" min="0" value={form.block_rules.last_contact_hours_min ?? ''} placeholder="24"
                  onChange={e => updateBlock({ last_contact_hours_min: e.target.value ? parseFloat(e.target.value) : null })}
                  disabled={disabled} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Máx emails</Label>
                  <Input type="number" min="0" value={form.block_rules.max_emails_in_window ?? ''} placeholder="3"
                    onChange={e => updateBlock({ max_emails_in_window: e.target.value ? parseInt(e.target.value) : null })}
                    disabled={disabled} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Em (dias)</Label>
                  <Input type="number" min="1" value={form.block_rules.window_days ?? ''} placeholder="7"
                    onChange={e => updateBlock({ window_days: e.target.value ? parseInt(e.target.value) : null })}
                    disabled={disabled} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Se QUALQUER condição bater, a ação é bloqueada com log do motivo.</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm">Ordem de avaliação</CardTitle></CardHeader>
        <CardContent>
          <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
            <li><strong className="text-red-700 dark:text-red-400">Bloqueio</strong> — primeira regra a ser checada (segurança máxima)</li>
            <li><strong className="text-yellow-700 dark:text-yellow-400">Aprovação</strong> — se não bloqueado, verifica se precisa de aprovação humana</li>
            <li><strong className="text-green-700 dark:text-green-400">Auto-envio</strong> — se nenhuma das anteriores acionou, envia automaticamente</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
