import { useOptimizationAutoMode, useTriggerOptimizationCycle } from '@/hooks/optimization/useOptimization';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Play, ShieldAlert } from 'lucide-react';

export function AutoModeToggle() {
  const { enabled, setEnabled, isLoading } = useOptimizationAutoMode();
  const trigger = useTriggerOptimizationCycle();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Modo automático</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Aplicar otimizações automaticamente</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Quando ativo, recomendações com alta confiança são aplicadas no ciclo diário.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={isLoading}
            onCheckedChange={(v) => {
              if (v && !confirm('Ativar o modo automático? Recomendações com confiança ≥ 80% serão aplicadas sem aprovação manual.')) return;
              setEnabled(v);
            }}
          />
        </div>
        {enabled && (
          <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
            <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
            <span>O sistema vai aplicar mudanças sozinho. Acompanhe o histórico de ações regularmente.</span>
          </div>
        )}
        <div className="border-t pt-3">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => trigger.mutate()}
            disabled={trigger.isPending}
          >
            {trigger.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
            Executar ciclo agora
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
