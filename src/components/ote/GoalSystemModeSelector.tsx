import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Calculator, Target, Loader2 } from 'lucide-react';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

export function GoalSystemModeSelector() {
  const { organization } = useCurrentOrganization();
  const [isUpdating, setIsUpdating] = useState(false);
  const queryClient = useQueryClient();

  const currentMode = organization?.goal_system_mode || 'ote';

  const handleModeChange = async (mode: 'ote' | 'simple' | 'standard_commission') => {
    if (!organization?.id || mode === currentMode) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ goal_system_mode: mode })
        .eq('id', organization.id);

      if (error) throw error;

      toast.success(
        mode === 'ote'
          ? 'Sistema OTE completo ativado'
          : mode === 'standard_commission'
            ? 'Modo Comissão Padrão ativado'
            : 'Modo Metas Simples ativado'
      );
      
      // AUTH.1.4: substituído reload automático por invalidação reativa de cache.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['current-organization'] }),
        queryClient.invalidateQueries({ queryKey: ['current-user'] }),
        queryClient.invalidateQueries({ queryKey: ['ote'] }),
        queryClient.invalidateQueries({ queryKey: ['organization'] }),
      ]);
    } catch (error) {
      console.error('Error updating goal system mode:', error);
      toast.error('Erro ao atualizar configuração');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Modo do Sistema de Metas
          {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
        </CardTitle>
        <CardDescription>
          Escolha como sua organização gerencia metas e comissões
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup 
          value={currentMode} 
          onValueChange={(v) => handleModeChange(v as 'ote' | 'simple')}
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          disabled={isUpdating}
        >
          <Label
            htmlFor="mode-ote"
            className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
              currentMode === 'ote' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="ote" id="mode-ote" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold">
                <Calculator className="h-5 w-5 text-primary" />
                Sistema OTE Completo
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Multiplicadores, aceleradores, flags de performance, comissões variáveis baseadas em atingimento.
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• Níveis com variável alvo</li>
                <li>• Multiplicadores por faixa %</li>
                <li>• Aceleradores (roleplay, CRM, FitScore)</li>
                <li>• Flags azul/amarelo/vermelho</li>
              </ul>
            </div>
          </Label>

          <Label
            htmlFor="mode-simple"
            className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
              currentMode === 'simple' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="simple" id="mode-simple" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold">
                <Target className="h-5 w-5 text-primary" />
                Metas Simples
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Apenas metas individuais e de time, sem cálculo de comissões ou variáveis.
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• Meta mensal por vendedor</li>
                <li>• Meta de time para gestores</li>
                <li>• % de atingimento</li>
                <li>• Sem comissões/variáveis</li>
              </ul>
            </div>
          </Label>

          <Label
            htmlFor="mode-standard"
            className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
              currentMode === 'standard_commission'
                ? 'border-primary bg-primary/5'
                : 'border-border hover:border-primary/50'
            }`}
          >
            <RadioGroupItem value="standard_commission" id="mode-standard" className="mt-1" />
            <div className="flex-1">
              <div className="flex items-center gap-2 font-semibold">
                <Calculator className="h-5 w-5 text-primary" />
                Comissão Padrão
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Comissões diretas por venda, vendedor, produto ou serviço, sem multiplicadores OTE.
              </p>
              <ul className="text-xs text-muted-foreground mt-2 space-y-1">
                <li>• Comissão por venda</li>
                <li>• Comissão por produto/serviço</li>
                <li>• Regras por vendedor ou função</li>
                <li>• Controle de pago e pendente</li>
                <li>• Sem multiplicadores de meta</li>
              </ul>
            </div>
          </Label>
        </RadioGroup>
      </CardContent>
    </Card>
  );
}
