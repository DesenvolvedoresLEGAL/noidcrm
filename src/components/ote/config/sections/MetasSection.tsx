import { useState, useEffect } from 'react';
import { useSalesConfig } from '@/hooks/useSalesConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Target, Calculator, CalendarDays, CalendarRange, Calendar, TrendingUp, Save } from 'lucide-react';
import { toast } from 'sonner';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
};

interface GoalCardProps {
  icon: React.ReactNode;
  title: string;
  period: string;
  value: number;
  multiplier: number;
  baseValue: number;
  onChange: (value: number) => void;
  onAutoCalculate: () => void;
  colorClass: string;
}

function GoalCard({ icon, title, period, value, multiplier, baseValue, onChange, onAutoCalculate, colorClass }: GoalCardProps) {
  const suggestedValue = baseValue * multiplier;
  const isAutoCalculated = value === suggestedValue && value > 0;
  
  return (
    <Card className={`relative overflow-hidden border-2 transition-all hover:shadow-md ${colorClass}`}>
      <div className="absolute top-0 right-0 w-24 h-24 opacity-5">
        {icon}
      </div>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg bg-gradient-to-br ${colorClass.replace('border-', 'from-').replace('/30', '/20')} to-transparent`}>
            {icon}
          </div>
          <div>
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <CardDescription className="text-xs">{period}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground">Meta (R$)</Label>
          <Input
            type="number"
            value={value || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            placeholder="0"
            className="text-lg font-semibold"
          />
        </div>
        <div className="flex items-center justify-between">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={onAutoCalculate}
                  className="text-xs gap-1"
                >
                  <Calculator className="h-3 w-3" />
                  {multiplier}x mensal
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Calcular: {formatCurrency(baseValue)} × {multiplier} = {formatCurrency(suggestedValue)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {isAutoCalculated && (
            <Badge variant="secondary" className="text-xs">
              Auto
            </Badge>
          )}
        </div>
        {value > 0 && (
          <div className="text-xs text-muted-foreground">
            = {formatCurrency(value)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function MetasSection() {
  const { config, configLoading, upsertConfig } = useSalesConfig();
  
  const [formData, setFormData] = useState({
    monthly_revenue_target: 0,
    quarterly_goal: 0,
    semester_goal: 0,
    yearly_goal: 0,
  });

  useEffect(() => {
    if (config) {
      setFormData({
        monthly_revenue_target: config.monthly_revenue_target || 0,
        quarterly_goal: config.quarterly_goal || 0,
        semester_goal: config.semester_goal || 0,
        yearly_goal: config.yearly_goal || 0,
      });
    }
  }, [config]);

  const handleSave = async () => {
    await upsertConfig(formData);
    toast.success('Metas salvas com sucesso');
  };

  const handleAutoCalculateAll = () => {
    const monthly = formData.monthly_revenue_target;
    setFormData(prev => ({
      ...prev,
      quarterly_goal: monthly * 3,
      semester_goal: monthly * 6,
      yearly_goal: monthly * 12,
    }));
    toast.success('Metas calculadas automaticamente');
  };

  if (configLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Defina suas metas de receita para cada período.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAutoCalculateAll}>
            <Calculator className="h-4 w-4 mr-2" />
            Auto-calcular
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <GoalCard
          icon={<CalendarDays className="h-5 w-5 text-blue-600" />}
          title="Mensal"
          period="Base de cálculo"
          value={formData.monthly_revenue_target}
          multiplier={1}
          baseValue={formData.monthly_revenue_target}
          onChange={(v) => setFormData({ ...formData, monthly_revenue_target: v })}
          onAutoCalculate={() => {}}
          colorClass="border-blue-500/30"
        />
        <GoalCard
          icon={<CalendarRange className="h-5 w-5 text-emerald-600" />}
          title="Trimestral"
          period="3 meses"
          value={formData.quarterly_goal}
          multiplier={3}
          baseValue={formData.monthly_revenue_target}
          onChange={(v) => setFormData({ ...formData, quarterly_goal: v })}
          onAutoCalculate={() => setFormData({ ...formData, quarterly_goal: formData.monthly_revenue_target * 3 })}
          colorClass="border-emerald-500/30"
        />
        <GoalCard
          icon={<Calendar className="h-5 w-5 text-amber-600" />}
          title="Semestral"
          period="6 meses"
          value={formData.semester_goal}
          multiplier={6}
          baseValue={formData.monthly_revenue_target}
          onChange={(v) => setFormData({ ...formData, semester_goal: v })}
          onAutoCalculate={() => setFormData({ ...formData, semester_goal: formData.monthly_revenue_target * 6 })}
          colorClass="border-amber-500/30"
        />
        <GoalCard
          icon={<TrendingUp className="h-5 w-5 text-purple-600" />}
          title="Anual"
          period="12 meses"
          value={formData.yearly_goal}
          multiplier={12}
          baseValue={formData.monthly_revenue_target}
          onChange={(v) => setFormData({ ...formData, yearly_goal: v })}
          onAutoCalculate={() => setFormData({ ...formData, yearly_goal: formData.monthly_revenue_target * 12 })}
          colorClass="border-purple-500/30"
        />
      </div>
    </div>
  );
}
