import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useSellerEvaluations, FitScoreFactor } from '@/hooks/useSellerEvaluations';
import { Scale, Heart, TrendingUp, Save, Info, Loader2 } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function FitScoreConfigManager() {
  const { config, configLoading, updateConfig } = useSellerEvaluations();
  const [culturalWeight, setCulturalWeight] = useState(50);
  const [culturalFactors, setCulturalFactors] = useState<FitScoreFactor[]>([]);
  const [performanceFactors, setPerformanceFactors] = useState<FitScoreFactor[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (config) {
      setCulturalWeight(config.cultural_weight * 100);
      setCulturalFactors(config.cultural_factors);
      setPerformanceFactors(config.performance_factors);
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateConfig({
        cultural_weight: culturalWeight / 100,
        performance_weight: (100 - culturalWeight) / 100,
        cultural_factors: culturalFactors,
        performance_factors: performanceFactors,
      });
    } finally {
      setSaving(false);
    }
  };

  const updateFactorWeight = (
    factors: FitScoreFactor[],
    setFactors: (factors: FitScoreFactor[]) => void,
    index: number,
    newWeight: number
  ) => {
    const updated = [...factors];
    updated[index] = { ...updated[index], weight: newWeight / 100 };
    setFactors(updated);
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const totalCulturalWeight = culturalFactors.reduce((sum, f) => sum + f.weight, 0);
  const totalPerformanceWeight = performanceFactors.reduce((sum, f) => sum + f.weight, 0);

  return (
    <div className="space-y-6">
      {/* Main Weights */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5" />
            Pesos Principais
          </CardTitle>
          <CardDescription>
            Defina o peso entre Fit Cultural e Desempenho no cálculo do FitScore
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Heart className="h-4 w-4 text-pink-500" />
                  Fit Cultural
                </span>
                <Badge variant="secondary">{culturalWeight}%</Badge>
              </div>
              <Slider
                value={[culturalWeight]}
                onValueChange={([value]) => setCulturalWeight(value)}
                min={0}
                max={100}
                step={5}
              />
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Desempenho
                </span>
                <Badge variant="secondary">{100 - culturalWeight}%</Badge>
              </div>
            </div>
          </div>

          <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <strong>Fórmula:</strong> FitScore = (Fit Cultural × {culturalWeight}%) + (Desempenho × {100 - culturalWeight}%)
          </div>
        </CardContent>
      </Card>

      {/* Cultural Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Fatores de Fit Cultural
            <Badge variant={Math.abs(totalCulturalWeight - 1) < 0.01 ? 'default' : 'destructive'}>
              {Math.round(totalCulturalWeight * 100)}%
            </Badge>
          </CardTitle>
          <CardDescription>
            Fatores avaliados para determinar o alinhamento cultural (soma deve ser 100%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {culturalFactors.map((factor, index) => (
            <div key={factor.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{factor.label}</Label>
                  {factor.description && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>{factor.description}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Input
                  type="number"
                  className="w-20 text-right"
                  value={Math.round(factor.weight * 100)}
                  onChange={(e) => updateFactorWeight(culturalFactors, setCulturalFactors, index, Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              <Slider
                value={[factor.weight * 100]}
                onValueChange={([value]) => updateFactorWeight(culturalFactors, setCulturalFactors, index, value)}
                min={0}
                max={100}
                step={5}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Fatores de Desempenho
            <Badge variant={Math.abs(totalPerformanceWeight - 1) < 0.01 ? 'default' : 'destructive'}>
              {Math.round(totalPerformanceWeight * 100)}%
            </Badge>
          </CardTitle>
          <CardDescription>
            Fatores avaliados para determinar o desempenho (soma deve ser 100%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {performanceFactors.map((factor, index) => (
            <div key={factor.key} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>{factor.label}</Label>
                  {factor.description && (
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>{factor.description}</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <Input
                  type="number"
                  className="w-20 text-right"
                  value={Math.round(factor.weight * 100)}
                  onChange={(e) => updateFactorWeight(performanceFactors, setPerformanceFactors, index, Number(e.target.value))}
                  min={0}
                  max={100}
                />
              </div>
              <Slider
                value={[factor.weight * 100]}
                onValueChange={([value]) => updateFactorWeight(performanceFactors, setPerformanceFactors, index, value)}
                min={0}
                max={100}
                step={5}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Configuração
        </Button>
      </div>
    </div>
  );
}
