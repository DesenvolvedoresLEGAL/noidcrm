import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSellerEvaluations, CreateEvaluationData } from '@/hooks/useSellerEvaluations';
import { useSellers } from '@/hooks/useSellers';
import { Heart, TrendingUp, Save, Send, Loader2, Star, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface SellerFitScoreEvaluationFormProps {
  sellerId?: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SellerFitScoreEvaluationForm({ sellerId, onSuccess, onCancel }: SellerFitScoreEvaluationFormProps) {
  const { config, configLoading, createEvaluation } = useSellerEvaluations();
  const { sellers, loading: sellersLoading } = useSellers();
  
  const [selectedSellerId, setSelectedSellerId] = useState(sellerId || '');
  const [periodStart, setPeriodStart] = useState(format(startOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [periodEnd, setPeriodEnd] = useState(format(endOfMonth(subMonths(new Date(), 1)), 'yyyy-MM-dd'));
  const [culturalScores, setCulturalScores] = useState<Record<string, number>>({});
  const [performanceScores, setPerformanceScores] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState('');
  const [strengths, setStrengths] = useState('');
  const [improvements, setImprovements] = useState('');
  const [saving, setSaving] = useState(false);

  // Initialize scores when config loads
  useEffect(() => {
    if (config) {
      const initCultural: Record<string, number> = {};
      const initPerformance: Record<string, number> = {};
      config.cultural_factors.forEach(f => { initCultural[f.key] = 50; });
      config.performance_factors.forEach(f => { initPerformance[f.key] = 50; });
      setCulturalScores(initCultural);
      setPerformanceScores(initPerformance);
    }
  }, [config]);

  // Calculate weighted scores
  const calculatedScores = useMemo(() => {
    if (!config) return { cultural: 0, performance: 0, total: 0 };

    let culturalTotal = 0;
    config.cultural_factors.forEach(f => {
      culturalTotal += (culturalScores[f.key] || 0) * f.weight;
    });

    let performanceTotal = 0;
    config.performance_factors.forEach(f => {
      performanceTotal += (performanceScores[f.key] || 0) * f.weight;
    });

    const total = (culturalTotal * config.cultural_weight) + (performanceTotal * config.performance_weight);

    return {
      cultural: Math.round(culturalTotal * 100) / 100,
      performance: Math.round(performanceTotal * 100) / 100,
      total: Math.round(total * 100) / 100,
    };
  }, [config, culturalScores, performanceScores]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    if (score >= 40) return 'text-orange-500';
    return 'text-red-500';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excelente';
    if (score >= 80) return 'Muito Bom';
    if (score >= 70) return 'Bom';
    if (score >= 60) return 'Regular';
    if (score >= 50) return 'Abaixo do Esperado';
    return 'Crítico';
  };

  const handleSubmit = async (status: 'draft' | 'submitted') => {
    if (!selectedSellerId) return;

    setSaving(true);
    try {
      const data: CreateEvaluationData = {
        seller_id: selectedSellerId,
        period_start: periodStart,
        period_end: periodEnd,
        cultural_fit_score: calculatedScores.cultural,
        performance_score: calculatedScores.performance,
        cultural_factors_scores: culturalScores,
        performance_factors_scores: performanceScores,
        notes: notes || undefined,
        strengths: strengths || undefined,
        improvements: improvements || undefined,
        status,
      };

      await createEvaluation(data);
      onSuccess?.();
    } catch (error) {
      console.error('Error creating evaluation:', error);
    } finally {
      setSaving(false);
    }
  };

  if (configLoading || sellersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="text-center p-8 text-muted-foreground">
        Configuração de FitScore não encontrada
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Preview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Nova Avaliação de FitScore</span>
            <div className="flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              <span className={cn('text-3xl font-bold', getScoreColor(calculatedScores.total))}>
                {calculatedScores.total}
              </span>
              <Badge variant="outline" className={getScoreColor(calculatedScores.total)}>
                {getScoreLabel(calculatedScores.total)}
              </Badge>
            </div>
          </CardTitle>
          <CardDescription>
            Avalie o vendedor em cada fator para calcular o FitScore
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Vendedor</Label>
              <Select value={selectedSellerId} onValueChange={setSelectedSellerId} disabled={!!sellerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um vendedor" />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map((seller) => (
                    <SelectItem key={seller.id} value={seller.id}>
                      {seller.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Início do Período</Label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                />
              </div>
              <div>
                <Label>Fim do Período</Label>
                <input
                  type="date"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Score Preview */}
          <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                <Heart className="h-4 w-4 text-pink-500" />
                Fit Cultural
              </div>
              <div className={cn('text-2xl font-bold', getScoreColor(calculatedScores.cultural))}>
                {calculatedScores.cultural}
              </div>
              <div className="text-xs text-muted-foreground">× {config.cultural_weight * 100}%</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Desempenho
              </div>
              <div className={cn('text-2xl font-bold', getScoreColor(calculatedScores.performance))}>
                {calculatedScores.performance}
              </div>
              <div className="text-xs text-muted-foreground">× {config.performance_weight * 100}%</div>
            </div>
            <div className="text-center border-l">
              <div className="text-sm text-muted-foreground mb-1">FitScore Final</div>
              <div className={cn('text-3xl font-bold', getScoreColor(calculatedScores.total))}>
                {calculatedScores.total}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cultural Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-pink-500" />
            Fit Cultural
            <Badge variant="outline">{calculatedScores.cultural} pts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {config.cultural_factors.map((factor) => (
            <div key={factor.key} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label>{factor.label}</Label>
                  {factor.description && (
                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                  )}
                </div>
                <Badge variant="secondary" className={getScoreColor(culturalScores[factor.key] || 0)}>
                  {culturalScores[factor.key] || 0}
                </Badge>
              </div>
              <Slider
                value={[culturalScores[factor.key] || 50]}
                onValueChange={([value]) => setCulturalScores(prev => ({ ...prev, [factor.key]: value }))}
                min={0}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Crítico</span>
                <span>Peso: {Math.round(factor.weight * 100)}%</span>
                <span>Excelente</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Performance Factors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            Desempenho
            <Badge variant="outline">{calculatedScores.performance} pts</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {config.performance_factors.map((factor) => (
            <div key={factor.key} className="space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <Label>{factor.label}</Label>
                  {factor.description && (
                    <p className="text-xs text-muted-foreground">{factor.description}</p>
                  )}
                </div>
                <Badge variant="secondary" className={getScoreColor(performanceScores[factor.key] || 0)}>
                  {performanceScores[factor.key] || 0}
                </Badge>
              </div>
              <Slider
                value={[performanceScores[factor.key] || 50]}
                onValueChange={([value]) => setPerformanceScores(prev => ({ ...prev, [factor.key]: value }))}
                min={0}
                max={100}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Crítico</span>
                <span>Peso: {Math.round(factor.weight * 100)}%</span>
                <span>Excelente</span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Notes */}
      <Card>
        <CardHeader>
          <CardTitle>Observações</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Pontos Fortes
            </Label>
            <Textarea
              placeholder="Descreva os pontos fortes do vendedor..."
              value={strengths}
              onChange={(e) => setStrengths(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              Pontos de Melhoria
            </Label>
            <Textarea
              placeholder="Descreva os pontos que precisam de melhoria..."
              value={improvements}
              onChange={(e) => setImprovements(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Notas Gerais</Label>
            <Textarea
              placeholder="Observações adicionais..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="mt-1"
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Cancelar
          </Button>
        )}
        <Button variant="outline" onClick={() => handleSubmit('draft')} disabled={saving || !selectedSellerId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Salvar Rascunho
        </Button>
        <Button onClick={() => handleSubmit('submitted')} disabled={saving || !selectedSellerId}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
          Enviar para Aprovação
        </Button>
      </div>
    </div>
  );
}
