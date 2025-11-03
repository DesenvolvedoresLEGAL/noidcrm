import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Target, Edit2, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { toast } from 'sonner';

export function MonthlyGoalCard() {
  const { user } = useSupabaseAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [monthlyGoal, setMonthlyGoal] = useState<number>(0);
  const [inputValue, setInputValue] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchMonthlyGoal();
    }
  }, [user]);

  const fetchMonthlyGoal = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('monthly_goal')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      const goal = data?.monthly_goal || 0;
      setMonthlyGoal(goal);
      setInputValue(formatCurrency(goal));
    } catch (error) {
      console.error('Error fetching monthly goal:', error);
    }
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const parseCurrency = (value: string): number => {
    const numbers = value.replace(/[^\d,]/g, '').replace(',', '.');
    return parseFloat(numbers) || 0;
  };

  const handleInputChange = (value: string) => {
    // Remove tudo exceto números e vírgula
    const cleaned = value.replace(/[^\d,]/g, '');
    
    // Limita a 12 dígitos antes da vírgula e 2 depois
    const parts = cleaned.split(',');
    if (parts[0].length > 12) return;
    if (parts[1] && parts[1].length > 2) return;
    
    const numberValue = parseCurrency(cleaned);
    
    if (numberValue > 999999999.99) {
      toast.error('Valor máximo permitido: R$ 999.999.999,99');
      return;
    }
    
    setInputValue(cleaned);
  };

  const handleSave = async () => {
    if (!user) return;

    const newGoal = parseCurrency(inputValue);

    if (newGoal < 0) {
      toast.error('O valor não pode ser negativo');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ monthly_goal: newGoal })
        .eq('user_id', user.id);

      if (error) throw error;

      setMonthlyGoal(newGoal);
      setInputValue(formatCurrency(newGoal));
      setIsEditing(false);
      toast.success('Meta mensal atualizada com sucesso');
    } catch (error) {
      console.error('Error updating monthly goal:', error);
      toast.error('Erro ao atualizar meta mensal');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setInputValue(formatCurrency(monthlyGoal));
    setIsEditing(false);
  };

  const handleEdit = () => {
    setInputValue(monthlyGoal.toFixed(2).replace('.', ','));
    setIsEditing(true);
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <CardTitle>Meta Mensal</CardTitle>
          </div>
          {!isEditing && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEdit}
            >
              <Edit2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        <CardDescription>
          Defina sua meta mensal de vendas para acompanhamento no Dashboard
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="monthly-goal">Valor da Meta (R$)</Label>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-muted-foreground">R$</span>
                <Input
                  id="monthly-goal"
                  type="text"
                  value={inputValue}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="0,00"
                  className="text-2xl font-bold"
                  disabled={saving}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Use vírgula para separar os centavos (ex: 100000,00)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 gap-2"
              >
                <Check className="h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Meta'}
              </Button>
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={saving}
                className="gap-2"
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Meta Atual</p>
            <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20">
              <p className="text-4xl font-bold text-primary">
                {formatCurrency(monthlyGoal)}
              </p>
            </div>
            {monthlyGoal === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Configure sua meta para visualizar o progresso no Dashboard
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
