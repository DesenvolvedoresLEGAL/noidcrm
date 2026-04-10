import { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { AgentBuilderConfig } from '@/types/ai-agents';

interface RuleItem { rule: string; priority: string }

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Crítica' },
  { value: 'high', label: 'Alta' },
  { value: 'medium', label: 'Média' },
  { value: 'low', label: 'Baixa' },
];

const PRESET_RULES = [
  'Nunca agir fora do escopo definido',
  'Não executar se confiança abaixo do threshold',
  'Não agir em contas bloqueadas',
  'Respeitar opt-out de comunicação',
  'Não conceder desconto sem aprovação',
  'Não prometer SLA não autorizado',
  'Não alterar owner da oportunidade',
  'Não mudar stage final sem aprovação',
  'Bloquear ação se contexto insuficiente',
  'Escalar se conta VIP',
];

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderRulesTab({ config, onSave, saving, disabled }: Props) {
  const [rules, setRules] = useState<RuleItem[]>([]);

  useEffect(() => {
    const existing = config.rulesets?.rules_json;
    if (existing && Array.isArray(existing)) {
      setRules(existing.map((r: any) => ({ rule: r.rule || r, priority: r.priority || 'medium' })));
    }
  }, [config.rulesets]);

  const addRule = (text?: string) => {
    setRules([...rules, { rule: text || '', priority: 'medium' }]);
  };

  const removeRule = (idx: number) => setRules(rules.filter((_, i) => i !== idx));

  const updateRule = (idx: number, partial: Partial<RuleItem>) => {
    setRules(rules.map((r, i) => i === idx ? { ...r, ...partial } : r));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Regras</h2>
          <p className="text-sm text-muted-foreground">Defina o que o agente pode ou não pode fazer</p>
        </div>
        <div className="flex gap-2">
          {!disabled && (
            <>
              <Button variant="outline" onClick={() => addRule()}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
              <Button onClick={() => onSave({ rules_json: rules, business_constraints_json: {}, risk_controls_json: {} })} disabled={saving}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            </>
          )}
        </div>
      </div>

      {rules.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nenhuma regra configurada.
          </CardContent>
        </Card>
      )}

      {rules.map((rule, idx) => (
        <Card key={idx}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Input value={rule.rule} onChange={e => updateRule(idx, { rule: e.target.value })} disabled={disabled} placeholder="Descreva a regra..." />
              </div>
              <Select value={rule.priority} onValueChange={v => updateRule(idx, { priority: v })} disabled={disabled}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!disabled && (
                <Button variant="ghost" size="sm" onClick={() => removeRule(idx)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      {!disabled && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Regras Pré-definidas</CardTitle></CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {PRESET_RULES.filter(pr => !rules.some(r => r.rule === pr)).map(preset => (
                <Button key={preset} variant="outline" size="sm" className="text-xs" onClick={() => addRule(preset)}>
                  + {preset}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
