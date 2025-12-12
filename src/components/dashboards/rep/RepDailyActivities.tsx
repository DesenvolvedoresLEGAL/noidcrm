import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Phone, Users, FileText, DollarSign, Target, Plus, CheckCircle2, AlertCircle, Circle } from 'lucide-react';
import { useRepPACE } from '@/hooks/useRepPACE';
import { formatCurrencyBR } from '@/lib/i18n';
import { cn } from '@/lib/utils';

interface ActivityMetric {
  label: string;
  icon: React.ElementType;
  target: number;
  achieved: number;
  unit?: string;
}

export function RepDailyActivities() {
  const { paceData, isLoading } = useRepPACE();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activityInput, setActivityInput] = useState({
    calls: 0,
    leads: 0,
    proposals: 0,
    sales: 0,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const activities: ActivityMetric[] = [
    {
      label: 'Ligações',
      icon: Phone,
      target: paceData.dailyActivities.calls.target,
      achieved: paceData.dailyActivities.calls.achieved,
    },
    {
      label: 'Leads',
      icon: Users,
      target: paceData.dailyActivities.leads.target,
      achieved: paceData.dailyActivities.leads.achieved,
    },
    {
      label: 'Propostas',
      icon: FileText,
      target: paceData.dailyActivities.proposals.target,
      achieved: paceData.dailyActivities.proposals.achieved,
    },
    {
      label: 'Vendas',
      icon: Target,
      target: paceData.dailyActivities.sales.target,
      achieved: paceData.dailyActivities.sales.achieved,
    },
  ];

  const getScoreIcon = (achieved: number, target: number) => {
    if (target === 0) return <Circle className="h-4 w-4 text-muted-foreground" />;
    const percentage = (achieved / target) * 100;
    if (percentage >= 100) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    if (percentage >= 70) return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  };

  const getProgressColor = (achieved: number, target: number) => {
    if (target === 0) return 'bg-muted';
    const percentage = (achieved / target) * 100;
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const handleSaveActivities = () => {
    // TODO: Save activities to database
    setIsDialogOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            📋 Atividades Diárias
          </CardTitle>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Registrar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Atividades do Dia</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ligações realizadas</Label>
                    <Input
                      type="number"
                      min="0"
                      value={activityInput.calls}
                      onChange={(e) => setActivityInput({ ...activityInput, calls: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Leads qualificados</Label>
                    <Input
                      type="number"
                      min="0"
                      value={activityInput.leads}
                      onChange={(e) => setActivityInput({ ...activityInput, leads: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Propostas enviadas</Label>
                    <Input
                      type="number"
                      min="0"
                      value={activityInput.proposals}
                      onChange={(e) => setActivityInput({ ...activityInput, proposals: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vendas fechadas</Label>
                    <Input
                      type="number"
                      min="0"
                      value={activityInput.sales}
                      onChange={(e) => setActivityInput({ ...activityInput, sales: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveActivities}>
                  Salvar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {activities.map((activity) => {
            const Icon = activity.icon;
            const percentage = activity.target > 0 ? Math.min((activity.achieved / activity.target) * 100, 100) : 0;
            
            return (
              <div key={activity.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{activity.label}</span>
                  </div>
                  {getScoreIcon(activity.achieved, activity.target)}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{activity.achieved}/{activity.target}</span>
                    <span>{percentage.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full transition-all", getProgressColor(activity.achieved, activity.target))}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Revenue Row */}
        <div className="mt-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Receita do Dia</span>
            </div>
            <div className="text-right">
              <span className="font-semibold">{formatCurrencyBR(paceData.dailyActivities.revenue.achieved)}</span>
              <span className="text-muted-foreground text-sm"> / {formatCurrencyBR(paceData.dailyActivities.revenue.target)}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
