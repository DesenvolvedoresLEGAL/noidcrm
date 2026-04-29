import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2, ShieldAlert, Save, Play } from 'lucide-react';
import { useGuardrails, useTriggerGenerateHypotheses, useTriggerEvaluate } from '@/hooks/experiments/useExperiments';

export function GuardrailsCard() {
  const { data, isLoading, update } = useGuardrails();
  const generate = useTriggerGenerateHypotheses();
  const evaluate = useTriggerEvaluate();

  const [form, setForm] = useState({
    experiments_enabled: false,
    allow_auto_apply: false,
    max_experiments_per_day: 5,
    max_variants_per_test: 3,
    min_sample_size: 20,
    min_lift_to_promote: 0.10,
  });

  useEffect(() => {
    if (data) {
      setForm({
        experiments_enabled: data.experiments_enabled,
        allow_auto_apply: data.allow_auto_apply,
        max_experiments_per_day: data.max_experiments_per_day,
        max_variants_per_test: data.max_variants_per_test,
        min_sample_size: data.min_sample_size,
        min_lift_to_promote: data.min_lift_to_promote,
      });
    }
  }, [data]);

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando guardrails…
        </CardContent>
      </Card>
    );
  }

  const handleAutoApply = (v: boolean) => {
    if (v) {
      const ok1 = confirm('Ativar auto-promoção? Variantes vencedoras substituirão o conteúdo atual sem aprovação manual.');
      if (!ok1) return;
      const ok2 = confirm('Tem certeza? Mudanças são reversíveis, mas isso desliga a revisão humana.');
      if (!ok2) return;
    }
    setForm((f) => ({ ...f, allow_auto_apply: v }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" /> Guardrails de experimentação
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Experimentos ativados</Label>
            <p className="text-xs text-muted-foreground">Geração automática de hipóteses no ciclo diário.</p>
          </div>
          <Switch
            checked={form.experiments_enabled}
            onCheckedChange={(v) => setForm({ ...form, experiments_enabled: v })}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <Label className="text-sm">Auto-promoção</Label>
            <p className="text-xs text-muted-foreground">Aplicar variante vencedora automaticamente.</p>
          </div>
          <Switch checked={form.allow_auto_apply} onCheckedChange={handleAutoApply} />
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <div>
            <Label className="text-xs">Máx. experimentos/dia</Label>
            <Input type="number" min={1} max={50} value={form.max_experiments_per_day}
              onChange={(e) => setForm({ ...form, max_experiments_per_day: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Máx. variantes/teste</Label>
            <Input type="number" min={2} max={3} value={form.max_variants_per_test}
              onChange={(e) => setForm({ ...form, max_variants_per_test: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Amostra mínima/variante</Label>
            <Input type="number" min={5} value={form.min_sample_size}
              onChange={(e) => setForm({ ...form, min_sample_size: Number(e.target.value) })} />
          </div>
          <div>
            <Label className="text-xs">Lift mínimo p/ promoção</Label>
            <Input type="number" min={0} max={1} step={0.01} value={form.min_lift_to_promote}
              onChange={(e) => setForm({ ...form, min_lift_to_promote: Number(e.target.value) })} />
          </div>
        </div>

        <div className="flex gap-2 pt-2 border-t">
          <Button size="sm" onClick={() => update.mutate(form)} disabled={update.isPending}>
            <Save className="h-4 w-4 mr-1" /> Salvar
          </Button>
          <Button size="sm" variant="secondary" onClick={() => generate.mutate()} disabled={generate.isPending}>
            <Play className="h-4 w-4 mr-1" /> Gerar hipóteses agora
          </Button>
          <Button size="sm" variant="ghost" onClick={() => evaluate.mutate()} disabled={evaluate.isPending}>
            Reavaliar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
