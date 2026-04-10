import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { AgentBuilderConfig } from '@/types/ai-agents';

const PROMPT_LAYERS = [
  { key: 'system_prompt', label: 'System Prompt', desc: 'Papel central do agente, limites e missão.', placeholder: 'Você é um agente especialista em...' },
  { key: 'role_prompt', label: 'Role Prompt', desc: 'Como ele deve se comportar dentro do NOID.', placeholder: 'Dentro do CRM NOID, seu papel é...' },
  { key: 'context_builder_prompt', label: 'Context Builder', desc: 'Como organizar e resumir o contexto antes de deliberar.', placeholder: 'Ao receber um contexto, organize as informações...' },
  { key: 'deliberation_prompt', label: 'Deliberation Prompt', desc: 'Como pensar antes de decidir.', placeholder: 'Antes de tomar qualquer decisão, considere...' },
  { key: 'generation_prompt', label: 'Generation Prompt', desc: 'Como gerar a ação, copy ou resposta final.', placeholder: 'Ao gerar uma resposta ou ação...' },
  { key: 'review_prompt', label: 'Review Prompt', desc: 'Como revisar a própria saída antes de executar.', placeholder: 'Revise sua resposta verificando...' },
];

const DEFAULT_CONTRACT = `{
  "decision": "string",
  "confidence_score": "number",
  "risk_level": "low|medium|high",
  "reasoning_summary": "string",
  "next_action": {
    "tool": "string",
    "payload": {}
  }
}`;

interface Props {
  config: AgentBuilderConfig;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  saving: boolean;
  disabled: boolean;
}

export default function BuilderPromptsTab({ config, onSave, saving, disabled }: Props) {
  const [form, setForm] = useState<Record<string, string>>({
    system_prompt: '',
    role_prompt: '',
    context_builder_prompt: '',
    deliberation_prompt: '',
    generation_prompt: '',
    review_prompt: '',
    output_contract_json: DEFAULT_CONTRACT,
  });

  useEffect(() => {
    const p = config.prompts;
    if (p) {
      setForm({
        system_prompt: p.system_prompt || '',
        role_prompt: p.role_prompt || '',
        context_builder_prompt: p.context_builder_prompt || '',
        deliberation_prompt: p.deliberation_prompt || '',
        generation_prompt: p.generation_prompt || '',
        review_prompt: p.review_prompt || '',
        output_contract_json: p.output_contract_json ? JSON.stringify(p.output_contract_json, null, 2) : DEFAULT_CONTRACT,
      });
    }
  }, [config.prompts]);

  const handleSave = () => {
    let contract = {};
    try { contract = JSON.parse(form.output_contract_json); } catch { contract = {}; }
    onSave({
      system_prompt: form.system_prompt || null,
      role_prompt: form.role_prompt || null,
      context_builder_prompt: form.context_builder_prompt || null,
      deliberation_prompt: form.deliberation_prompt || null,
      generation_prompt: form.generation_prompt || null,
      review_prompt: form.review_prompt || null,
      output_contract_json: contract,
      style_rules_json: [],
      forbidden_patterns_json: [],
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Prompt Layers</h2>
          <p className="text-sm text-muted-foreground">Configure as camadas de inteligência do agente</p>
        </div>
        {!disabled && (
          <Button onClick={handleSave} disabled={saving}><Save className="h-4 w-4 mr-1" /> Salvar</Button>
        )}
      </div>

      {PROMPT_LAYERS.map(layer => (
        <Card key={layer.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">{layer.label}</CardTitle>
            <CardDescription className="text-xs">{layer.desc}</CardDescription>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form[layer.key] || ''}
              onChange={e => setForm(f => ({ ...f, [layer.key]: e.target.value }))}
              disabled={disabled}
              placeholder={layer.placeholder}
              rows={5}
              className="font-mono text-xs"
            />
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Output Contract (JSON)</CardTitle>
          <CardDescription className="text-xs">Estrutura esperada da saída do agente</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.output_contract_json}
            onChange={e => setForm(f => ({ ...f, output_contract_json: e.target.value }))}
            disabled={disabled}
            rows={10}
            className="font-mono text-xs"
          />
        </CardContent>
      </Card>
    </div>
  );
}
