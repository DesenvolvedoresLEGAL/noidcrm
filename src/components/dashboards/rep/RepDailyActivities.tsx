import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useDailyActivityLog } from '@/hooks/usePACEData';
import { useRepPACE } from '@/hooks/useRepPACE';
import { Phone, Users, FileText, DollarSign, Plus, Check } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrencyBR } from '@/lib/i18n';
import { motion } from 'framer-motion';

interface ActivityMetric {
  label: string;
  icon: React.ReactNode;
  target: number;
  actual: number;
  field: string;
  isCurrency?: boolean;
}

export function RepDailyActivities() {
  const { paceData, hasTarget } = useRepPACE();
  const { logs, upsertLog } = useDailyActivityLog();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const today = format(new Date(), 'yyyy-MM-dd');
  
  const todayLog = logs?.find(l => l.log_date === today);
  
  const [formData, setFormData] = useState({
    calls_made: todayLog?.calls_made || 0,
    leads_generated: todayLog?.leads_generated || 0,
    proposals_sent: todayLog?.proposals_sent || 0,
    sales_closed: todayLog?.sales_closed || 0,
    revenue_closed: todayLog?.revenue_closed || 0,
  });

  // Update form when todayLog changes
  useState(() => {
    if (todayLog) {
      setFormData({
        calls_made: todayLog.calls_made || 0,
        leads_generated: todayLog.leads_generated || 0,
        proposals_sent: todayLog.proposals_sent || 0,
        sales_closed: todayLog.sales_closed || 0,
        revenue_closed: todayLog.revenue_closed || 0,
      });
    }
  });

  const dailyTargets = paceData?.dailyTargets || {
    calls: 15,
    leads: 4,
    proposals: 3,
    sales: 1,
    revenue: 3000,
  };

  const metrics: ActivityMetric[] = [
    {
      label: 'Ligações',
      icon: <Phone className="h-4 w-4" />,
      target: dailyTargets.calls,
      actual: formData.calls_made,
      field: 'calls_made',
    },
    {
      label: 'Leads',
      icon: <Users className="h-4 w-4" />,
      target: dailyTargets.leads,
      actual: formData.leads_generated,
      field: 'leads_generated',
    },
    {
      label: 'Propostas',
      icon: <FileText className="h-4 w-4" />,
      target: dailyTargets.proposals,
      actual: formData.proposals_sent,
      field: 'proposals_sent',
    },
    {
      label: 'Vendas',
      icon: <DollarSign className="h-4 w-4" />,
      target: dailyTargets.sales,
      actual: formData.sales_closed,
      field: 'sales_closed',
    },
  ];

  const getScore = (actual: number, target: number): 'red' | 'yellow' | 'green' => {
    if (target === 0) return actual > 0 ? 'green' : 'yellow';
    const percent = (actual / target) * 100;
    if (percent >= 100) return 'green';
    if (percent >= 70) return 'yellow';
    return 'red';
  };

  const scoreColors = {
    red: 'text-destructive bg-destructive/10',
    yellow: 'text-yellow-600 bg-yellow-500/10',
    green: 'text-emerald-600 bg-emerald-500/10',
  };

  const scoreIcons = {
    red: '🔴',
    yellow: '🟡',
    green: '🟢',
  };

  const handleSave = async () => {
    await upsertLog({
      log_date: today,
      ...formData,
    });
    setIsDialogOpen(false);
  };

  if (!hasTarget) {
    return null; // Don't show if no target configured
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
    >
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              📋 Atividades Diárias
              <Badge variant="outline" className="text-xs font-normal">
                {format(new Date(), "dd 'de' MMMM", { locale: ptBR })}
              </Badge>
            </CardTitle>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1">
                  {todayLog ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {todayLog ? 'Atualizar' : 'Registrar'}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Registrar Atividades do Dia</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  {metrics.map((metric) => (
                    <div key={metric.field} className="grid grid-cols-4 items-center gap-4">
                      <Label className="flex items-center gap-2">
                        {metric.icon}
                        {metric.label}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        value={formData[metric.field as keyof typeof formData]}
                        onChange={(e) => setFormData({
                          ...formData,
                          [metric.field]: parseInt(e.target.value) || 0,
                        })}
                        className="col-span-2"
                      />
                      <span className="text-sm text-muted-foreground">
                        Meta: {metric.target}
                      </span>
                    </div>
                  ))}
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Receita
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      step="100"
                      value={formData.revenue_closed}
                      onChange={(e) => setFormData({
                        ...formData,
                        revenue_closed: parseFloat(e.target.value) || 0,
                      })}
                      className="col-span-2"
                    />
                    <span className="text-sm text-muted-foreground">
                      Meta: {formatCurrencyBR(dailyTargets.revenue)}
                    </span>
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full">
                  Salvar Atividades
                </Button>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((metric) => {
              const score = getScore(metric.actual, metric.target);
              return (
                <div
                  key={metric.field}
                  className={`rounded-lg p-3 ${scoreColors[score]}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      {metric.icon}
                      <span className="text-xs font-medium">{metric.label}</span>
                    </div>
                    <span>{scoreIcons[score]}</span>
                  </div>
                  <p className="text-lg font-bold">
                    {metric.actual}
                    <span className="text-xs font-normal opacity-70">/{metric.target}</span>
                  </p>
                </div>
              );
            })}
          </div>
          
          {/* Revenue Row */}
          <div className={`mt-3 rounded-lg p-3 ${scoreColors[getScore(formData.revenue_closed, dailyTargets.revenue)]}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                <span className="text-sm font-medium">Receita do Dia</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold">
                  {formatCurrencyBR(formData.revenue_closed)}
                </span>
                <span className="text-xs opacity-70">
                  / {formatCurrencyBR(dailyTargets.revenue)}
                </span>
                <span>{scoreIcons[getScore(formData.revenue_closed, dailyTargets.revenue)]}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
