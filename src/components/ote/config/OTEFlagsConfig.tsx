import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import { Flag, RotateCcw, Save, AlertTriangle, CheckCircle2 } from 'lucide-react';

const DEFAULT_THRESHOLDS = {
  blueThreshold: 100,
  yellowMinThreshold: 70,
  yellowMaxThreshold: 99.99,
};

export function OTEFlagsConfig() {
  const { config, configLoading, upsertConfig } = useSalesConfig();
  const [saving, setSaving] = useState(false);
  
  const [blueThreshold, setBlueThreshold] = useState(DEFAULT_THRESHOLDS.blueThreshold);
  const [yellowMinThreshold, setYellowMinThreshold] = useState(DEFAULT_THRESHOLDS.yellowMinThreshold);
  const [yellowMaxThreshold, setYellowMaxThreshold] = useState(DEFAULT_THRESHOLDS.yellowMaxThreshold);
  
  // Validation
  const hasGaps = yellowMaxThreshold >= blueThreshold;
  const hasOverlap = yellowMinThreshold > yellowMaxThreshold;
  const isValid = !hasGaps && !hasOverlap && yellowMinThreshold > 0 && yellowMaxThreshold > 0 && blueThreshold > 0;
  
  useEffect(() => {
    if (config) {
      setBlueThreshold(config.flag_blue_threshold ?? DEFAULT_THRESHOLDS.blueThreshold);
      setYellowMinThreshold(config.flag_yellow_min_threshold ?? DEFAULT_THRESHOLDS.yellowMinThreshold);
      setYellowMaxThreshold(config.flag_yellow_max_threshold ?? DEFAULT_THRESHOLDS.yellowMaxThreshold);
    }
  }, [config]);
  
  const handleSave = async () => {
    if (!isValid) {
      toast.error('Corrija os erros de validação antes de salvar');
      return;
    }
    
    setSaving(true);
    try {
      await upsertConfig({
        flag_blue_threshold: blueThreshold,
        flag_yellow_min_threshold: yellowMinThreshold,
        flag_yellow_max_threshold: yellowMaxThreshold,
      });
      toast.success('Thresholds de flags salvos!');
    } catch (error) {
      console.error('Error saving flags config:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };
  
  const handleReset = () => {
    setBlueThreshold(DEFAULT_THRESHOLDS.blueThreshold);
    setYellowMinThreshold(DEFAULT_THRESHOLDS.yellowMinThreshold);
    setYellowMaxThreshold(DEFAULT_THRESHOLDS.yellowMaxThreshold);
    toast.info('Valores padrão restaurados');
  };
  
  // Calculate red threshold for display
  const redMaxThreshold = yellowMinThreshold - 0.01;
  
  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Flag className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Configuração de Flags</h3>
            <p className="text-sm text-muted-foreground">
              Defina os limites de percentual de atingimento para cada flag
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Padrões
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !isValid}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </div>
      
      {/* Validation Alerts */}
      {(hasGaps || hasOverlap) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {hasOverlap && 'O valor mínimo da Yellow Flag não pode ser maior que o máximo. '}
            {hasGaps && 'O valor máximo da Yellow Flag deve ser menor que o threshold da Blue Flag. '}
          </AlertDescription>
        </Alert>
      )}
      
      {/* Flags Configuration */}
      <div className="grid gap-6">
        {/* Blue Flag */}
        <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-blue-500 hover:bg-blue-500 text-white font-bold px-3 py-1">
                🟦 BLUE FLAG
              </Badge>
              <CardTitle className="text-base">Meta Atingida ou Superada</CardTitle>
            </div>
            <CardDescription>
              Vendedor atingiu ou superou o percentual definido da meta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="blue-threshold" className="text-sm font-medium">
                  Atingimento mínimo (%)
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-muted-foreground font-medium">≥</span>
                  <Input
                    id="blue-threshold"
                    type="number"
                    value={blueThreshold}
                    onChange={(e) => setBlueThreshold(Number(e.target.value))}
                    min={1}
                    max={200}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex-1 text-sm text-muted-foreground">
                <p>Exemplo: Se definido como <strong>{blueThreshold}%</strong>, vendedores com atingimento igual ou maior receberão Blue Flag.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Yellow Flag */}
        <Card className="border-yellow-500/30 bg-gradient-to-r from-yellow-500/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-yellow-500 hover:bg-yellow-500 text-black font-bold px-3 py-1">
                🟨 YELLOW FLAG
              </Badge>
              <CardTitle className="text-base">Em Progresso</CardTitle>
            </div>
            <CardDescription>
              Vendedor está entre os limites mínimo e máximo definidos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex-1 min-w-[200px] max-w-xs">
                <Label htmlFor="yellow-min" className="text-sm font-medium">
                  Limite mínimo (%)
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-muted-foreground font-medium">≥</span>
                  <Input
                    id="yellow-min"
                    type="number"
                    value={yellowMinThreshold}
                    onChange={(e) => setYellowMinThreshold(Number(e.target.value))}
                    min={1}
                    max={199}
                    step={1}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex-1 min-w-[200px] max-w-xs">
                <Label htmlFor="yellow-max" className="text-sm font-medium">
                  Limite máximo (%)
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-muted-foreground font-medium">≤</span>
                  <Input
                    id="yellow-max"
                    type="number"
                    value={yellowMaxThreshold}
                    onChange={(e) => setYellowMaxThreshold(Number(e.target.value))}
                    min={1}
                    max={199}
                    step={0.01}
                    className="w-24"
                  />
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mt-3">
              Exemplo: Vendedores com atingimento entre <strong>{yellowMinThreshold}%</strong> e <strong>{yellowMaxThreshold}%</strong> receberão Yellow Flag.
            </p>
          </CardContent>
        </Card>
        
        {/* Red Flag */}
        <Card className="border-red-500/30 bg-gradient-to-r from-red-500/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <Badge className="bg-red-500 hover:bg-red-500 text-white font-bold px-3 py-1">
                🟥 RED FLAG
              </Badge>
              <CardTitle className="text-base">Abaixo da Meta</CardTitle>
            </div>
            <CardDescription>
              Vendedor está abaixo do limite mínimo da Yellow Flag (calculado automaticamente)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="flex-1 max-w-xs">
                <Label className="text-sm font-medium text-muted-foreground">
                  Limite (calculado)
                </Label>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-muted-foreground font-medium">&lt;</span>
                  <div className="w-24 px-3 py-2 rounded-md border bg-muted/50 text-sm font-medium">
                    {yellowMinThreshold}
                  </div>
                  <span className="text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex-1 text-sm text-muted-foreground">
                <p>Vendedores com atingimento abaixo de <strong>{yellowMinThreshold}%</strong> receberão Red Flag automaticamente.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Separator />
      
      {/* Visual Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-primary" />
            Preview das Faixas
          </CardTitle>
          <CardDescription>
            Visualização de como as flags serão aplicadas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative h-10 rounded-lg overflow-hidden">
            {/* Red Zone */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-red-500/80 flex items-center justify-center"
              style={{ width: `${(yellowMinThreshold / blueThreshold) * 50}%` }}
            >
              <span className="text-xs font-medium text-white">
                0% - {(yellowMinThreshold - 0.01).toFixed(0)}%
              </span>
            </div>
            {/* Yellow Zone */}
            <div 
              className="absolute top-0 bottom-0 bg-yellow-500/80 flex items-center justify-center"
              style={{ 
                left: `${(yellowMinThreshold / blueThreshold) * 50}%`,
                width: `${((yellowMaxThreshold - yellowMinThreshold) / blueThreshold) * 50}%` 
              }}
            >
              <span className="text-xs font-medium text-black">
                {yellowMinThreshold}% - {yellowMaxThreshold}%
              </span>
            </div>
            {/* Blue Zone */}
            <div 
              className="absolute top-0 bottom-0 right-0 bg-blue-500/80 flex items-center justify-center"
              style={{ 
                left: `${(yellowMaxThreshold / blueThreshold) * 50}%`,
                right: 0
              }}
            >
              <span className="text-xs font-medium text-white">
                ≥ {blueThreshold}%
              </span>
            </div>
          </div>
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>0%</span>
            <span>{blueThreshold}%</span>
            <span>{blueThreshold * 2}%+</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}