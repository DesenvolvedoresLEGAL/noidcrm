import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Loader2, Rocket, AlertTriangle } from 'lucide-react';
import { useEstimateAutopilot, useStartAutopilot } from '@/hooks/intelligence/useAutopilot';
import type { AutopilotConfig } from '@/services/intelligence/autopilot';

interface Props {
  open: boolean;
  onClose: () => void;
  defaults?: {
    prospect_ids?: string[];
    playbook_run_id?: string;
    event_id?: string | null;
    lead_search_id?: string | null;
    run_name?: string;
  };
}

export function AutopilotConfigModal({ open, onClose, defaults }: Props) {
  const [config, setConfig] = useState<AutopilotConfig>({
    min_score: 0,
    max_apollo_credits: 500,
    max_contacts_per_company: 3,
    allow_enrichment: true,
    allow_apollo: true,
    generate_brief: true,
  });
  const [runName, setRunName] = useState(defaults?.run_name ?? `Autopilot ${new Date().toLocaleDateString('pt-BR')}`);
  const [estimate, setEstimate] = useState<{ eligible: number; apollo_eligible: number; credits_estimated: number } | null>(null);

  const estimateM = useEstimateAutopilot();
  const startM = useStartAutopilot();

  const runEstimate = async () => {
    const data = await estimateM.mutateAsync({ ...defaults, config });
    setEstimate(data);
  };

  const launch = async () => {
    await startM.mutateAsync({ ...defaults, run_name: runName, config });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" /> Executar Autopilot</DialogTitle>
          <DialogDescription>
            O Autopilot processa o lote automaticamente: matching → enriquecimento → Apollo → decisor → brief. A saída é a Qualified Queue — nada é importado ao CRM.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="run_name">Nome da execução</Label>
            <Input id="run_name" value={runName} onChange={(e) => setRunName(e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Score mínimo</Label>
              <Input type="number" min={0} max={100} value={config.min_score ?? 0}
                onChange={(e) => setConfig({ ...config, min_score: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5">
              <Label>Máx créditos Apollo</Label>
              <Input type="number" min={0} value={config.max_apollo_credits ?? 500}
                onChange={(e) => setConfig({ ...config, max_apollo_credits: Number(e.target.value) })} />
            </div>
            <div className="space-y-1.5 col-span-2">
              <Label>Máx contatos por empresa</Label>
              <Input type="number" min={1} max={10} value={config.max_contacts_per_company ?? 3}
                onChange={(e) => setConfig({ ...config, max_contacts_per_company: Number(e.target.value) })} />
            </div>
          </div>

          <div className="space-y-2">
            {[
              { key: 'allow_enrichment', label: 'Enriquecimento IA' },
              { key: 'allow_apollo', label: 'Buscar decisores (Apollo)' },
              { key: 'generate_brief', label: 'Gerar brief comercial' },
            ].map((sw) => (
              <div key={sw.key} className="flex items-center justify-between">
                <Label htmlFor={sw.key}>{sw.label}</Label>
                <Switch id={sw.key}
                  checked={!!(config as Record<string, unknown>)[sw.key]}
                  onCheckedChange={(v) => setConfig({ ...config, [sw.key]: v })} />
              </div>
            ))}
          </div>

          {estimate && (
            <Card className="p-3 bg-muted/40">
              <div className="text-sm space-y-1">
                <div>Elegíveis: <strong>{estimate.eligible}</strong></div>
                <div>Apollo elegível: <strong>{estimate.apollo_eligible}</strong></div>
                <div>Créditos estimados: <strong>{estimate.credits_estimated}</strong> / {config.max_apollo_credits}</div>
                {estimate.credits_estimated > (config.max_apollo_credits ?? 0) && (
                  <div className="flex items-center gap-1 text-amber-600 text-xs">
                    <AlertTriangle className="h-3 w-3" /> Lote excede limite — Apollo será interrompido ao atingir o teto.
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={runEstimate} disabled={estimateM.isPending}>
            {estimateM.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Estimar
          </Button>
          <Button onClick={launch} disabled={startM.isPending || !estimate}>
            {startM.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            🚀 Iniciar Autopilot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
