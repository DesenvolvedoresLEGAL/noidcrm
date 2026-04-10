import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Play, FileText, Zap, Lock } from 'lucide-react';
import type { SimulationExecutionMode } from '@/types/ai-agents';

interface TestScenario {
  id: string;
  name: string;
  description: string | null;
  scenario_type: string;
  source_type: string;
  input_payload_json: Record<string, unknown>;
  is_template?: boolean;
}

interface Props {
  scenarios: TestScenario[];
  onRun: (scenario: Record<string, unknown>, mode: SimulationExecutionMode) => void;
  running: boolean;
}

export default function SimulationScenarioPanel({ scenarios, onRun, running }: Props) {
  const [mode, setMode] = useState<SimulationExecutionMode>('dry_run');
  const [scenarioSource, setScenarioSource] = useState<'template' | 'manual'>('template');
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('');
  const [manualPayload, setManualPayload] = useState('{\n  "trigger": "opportunity_stalled",\n  "days_stalled": 7\n}');

  const handleRun = () => {
    let scenario: Record<string, unknown>;
    if (scenarioSource === 'template' && selectedScenarioId) {
      const found = scenarios.find(s => s.id === selectedScenarioId);
      if (found) {
        scenario = { ...found, input_payload_json: found.input_payload_json };
      } else return;
    } else {
      try {
        scenario = { scenario_type: 'manual', source_type: 'manual_payload', input_payload_json: JSON.parse(manualPayload) };
      } catch {
        return;
      }
    }
    onRun(scenario, mode);
  };

  return (
    <div className="space-y-4">
      {/* Execution Mode */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Modo de Execução</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup value={mode} onValueChange={(v) => setMode(v as SimulationExecutionMode)} className="space-y-2">
            <div className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
              <RadioGroupItem value="preview_only" id="preview" />
              <div>
                <Label htmlFor="preview" className="font-medium text-sm cursor-pointer">Preview Only</Label>
                <p className="text-xs text-muted-foreground">Análise estrutural sem deliberação AI</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50">
              <RadioGroupItem value="dry_run" id="dryrun" />
              <div>
                <Label htmlFor="dryrun" className="font-medium text-sm cursor-pointer">Dry Run</Label>
                <p className="text-xs text-muted-foreground">Fluxo completo sem efeitos reais</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-2 rounded-md hover:bg-muted/50 opacity-50">
              <RadioGroupItem value="guarded_test" id="guarded" disabled />
              <div>
                <Label htmlFor="guarded" className="font-medium text-sm cursor-pointer flex items-center gap-1">
                  Guarded Test <Badge variant="outline" className="text-[10px]">Em breve</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">Execução controlada em sandbox</p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Scenario Selection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cenário de Teste</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={scenarioSource === 'template' ? 'default' : 'outline'} onClick={() => setScenarioSource('template')}>
              <FileText className="h-3 w-3 mr-1" /> Templates
            </Button>
            <Button size="sm" variant={scenarioSource === 'manual' ? 'default' : 'outline'} onClick={() => setScenarioSource('manual')}>
              <Zap className="h-3 w-3 mr-1" /> Manual
            </Button>
          </div>

          {scenarioSource === 'template' ? (
            <div className="space-y-2">
              <Select value={selectedScenarioId} onValueChange={setSelectedScenarioId}>
                <SelectTrigger><SelectValue placeholder="Selecionar cenário..." /></SelectTrigger>
                <SelectContent>
                  {scenarios.map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <div className="flex items-center gap-2">
                        {s.name}
                        {s.is_template && <Badge variant="outline" className="text-[10px]">template</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedScenarioId && scenarios.find(s => s.id === selectedScenarioId)?.description && (
                <p className="text-xs text-muted-foreground">
                  {scenarios.find(s => s.id === selectedScenarioId)?.description}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Payload JSON</Label>
              <Textarea
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                className="font-mono text-xs min-h-[120px]"
                placeholder='{"trigger": "...", "data": {...}}'
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Run Button */}
      <Button className="w-full" size="lg" onClick={handleRun} disabled={running || (scenarioSource === 'template' && !selectedScenarioId)}>
        <Play className="h-4 w-4 mr-2" />
        {running ? 'Simulando...' : 'Simular Agente'}
      </Button>

      {mode === 'dry_run' && (
        <div className="flex items-center gap-2 p-2 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
          <Lock className="h-3 w-3 flex-shrink-0" />
          Nenhuma ação real será executada
        </div>
      )}
    </div>
  );
}
