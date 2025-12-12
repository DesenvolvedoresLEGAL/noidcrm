import { useState } from 'react';
import { useDailyActivityLog, DailyActivityLog } from '@/hooks/usePACEData';
import { useSellerTargets } from '@/hooks/useSalesConfig';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Calendar, Plus, Phone, Users, FileText, DollarSign, TrendingUp } from 'lucide-react';
import { format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const formatCurrency = (value: number) => {
  if (value >= 1000) return `R$ ${(value / 1000).toFixed(1)}k`;
  return `R$ ${value.toFixed(0)}`;
};

const getPaceIcon = (score: string) => {
  switch (score) {
    case 'green': return '🟢';
    case 'yellow': return '🟡';
    case 'red': return '🔴';
    default: return '⏳';
  }
};

interface DailyActivityTrackerProps {
  userId?: string;
  month?: Date;
}

export function DailyActivityTracker({ userId, month }: DailyActivityTrackerProps) {
  const currentMonth = month || new Date();
  const periodMonth = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  
  const { logs, isLoading, upsertLog } = useDailyActivityLog(userId, currentMonth);
  const { targets } = useSellerTargets(periodMonth);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newLog, setNewLog] = useState({
    log_date: format(new Date(), 'yyyy-MM-dd'),
    calls_made: 0,
    leads_generated: 0,
    proposals_sent: 0,
    sales_closed: 0,
    revenue_closed: 0,
    notes: '',
  });

  // Get target for this user
  const sellerTarget = targets?.find(t => t.user_id === userId);
  const dailyTargets = {
    calls: sellerTarget?.daily_calls_target || 15,
    leads: sellerTarget?.daily_leads_target || 4,
    proposals: sellerTarget?.daily_proposals_target || 3,
    sales: sellerTarget?.daily_sales_target || 2,
    revenue: sellerTarget?.daily_revenue_target || 0,
  };

  const handleAddLog = async () => {
    // Calculate PACE score
    const callsPercent = dailyTargets.calls > 0 ? (newLog.calls_made / dailyTargets.calls) : 1;
    const leadsPercent = dailyTargets.leads > 0 ? (newLog.leads_generated / dailyTargets.leads) : 1;
    const proposalsPercent = dailyTargets.proposals > 0 ? (newLog.proposals_sent / dailyTargets.proposals) : 1;
    const salesPercent = dailyTargets.sales > 0 ? (newLog.sales_closed / dailyTargets.sales) : 1;
    
    const avgPercent = (callsPercent + leadsPercent + proposalsPercent + salesPercent) / 4;
    
    let pace_score: 'red' | 'yellow' | 'green' = 'green';
    if (avgPercent < 0.7) {
      pace_score = 'red';
    } else if (avgPercent < 0.9) {
      pace_score = 'yellow';
    }
    
    await upsertLog({
      ...newLog,
      pace_score,
      pace_percentage: avgPercent * 100,
    });
    
    setIsAddDialogOpen(false);
    setNewLog({
      log_date: format(new Date(), 'yyyy-MM-dd'),
      calls_made: 0,
      leads_generated: 0,
      proposals_sent: 0,
      sales_closed: 0,
      revenue_closed: 0,
      notes: '',
    });
  };

  const renderMetricCell = (actual: number, target: number) => {
    const percent = target > 0 ? (actual / target) * 100 : 100;
    const isGood = percent >= 100;
    const isOk = percent >= 70;
    
    return (
      <span className={`font-medium ${isGood ? 'text-green-600' : isOk ? 'text-yellow-600' : 'text-red-600'}`}>
        {actual} / {target}
      </span>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Plano Diário
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <div className="animate-pulse text-muted-foreground">Carregando...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Plano Diário - {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </CardTitle>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Registrar Dia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Registrar Atividades do Dia</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={newLog.log_date}
                    onChange={(e) => setNewLog({ ...newLog, log_date: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> Ligações
                      <span className="text-muted-foreground text-xs">(meta: {dailyTargets.calls})</span>
                    </Label>
                    <Input
                      type="number"
                      value={newLog.calls_made}
                      onChange={(e) => setNewLog({ ...newLog, calls_made: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> Leads
                      <span className="text-muted-foreground text-xs">(meta: {dailyTargets.leads})</span>
                    </Label>
                    <Input
                      type="number"
                      value={newLog.leads_generated}
                      onChange={(e) => setNewLog({ ...newLog, leads_generated: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <FileText className="h-3 w-3" /> Propostas
                      <span className="text-muted-foreground text-xs">(meta: {dailyTargets.proposals})</span>
                    </Label>
                    <Input
                      type="number"
                      value={newLog.proposals_sent}
                      onChange={(e) => setNewLog({ ...newLog, proposals_sent: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3" /> Vendas
                      <span className="text-muted-foreground text-xs">(meta: {dailyTargets.sales})</span>
                    </Label>
                    <Input
                      type="number"
                      value={newLog.sales_closed}
                      onChange={(e) => setNewLog({ ...newLog, sales_closed: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                </div>
                
                <div>
                  <Label className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Receita Fechada
                  </Label>
                  <Input
                    type="number"
                    value={newLog.revenue_closed}
                    onChange={(e) => setNewLog({ ...newLog, revenue_closed: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                
                <div>
                  <Label>Notas</Label>
                  <Input
                    value={newLog.notes}
                    onChange={(e) => setNewLog({ ...newLog, notes: e.target.value })}
                    placeholder="Observações do dia..."
                  />
                </div>
                
                <Button onClick={handleAddLog} className="w-full">
                  Salvar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {/* Targets Summary */}
        <div className="grid grid-cols-5 gap-2 mb-4 p-3 bg-muted/50 rounded-lg">
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Ligações/dia</p>
            <p className="font-bold">{dailyTargets.calls}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Leads/dia</p>
            <p className="font-bold">{dailyTargets.leads}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Propostas/dia</p>
            <p className="font-bold">{dailyTargets.proposals}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Vendas/dia</p>
            <p className="font-bold">{dailyTargets.sales}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Receita/dia</p>
            <p className="font-bold">{formatCurrency(dailyTargets.revenue)}</p>
          </div>
        </div>

        {logs && logs.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-center">Ligações</TableHead>
                <TableHead className="text-center">Leads</TableHead>
                <TableHead className="text-center">Propostas</TableHead>
                <TableHead className="text-center">Vendas</TableHead>
                <TableHead className="text-right">Receita</TableHead>
                <TableHead className="text-center">Score</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="font-medium">
                    {format(parseISO(log.log_date), 'dd/MM', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderMetricCell(log.calls_made, dailyTargets.calls)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderMetricCell(log.leads_generated, dailyTargets.leads)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderMetricCell(log.proposals_sent, dailyTargets.proposals)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderMetricCell(log.sales_closed, dailyTargets.sales)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(log.revenue_closed)}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={log.pace_score === 'green' ? 'default' : log.pace_score === 'yellow' ? 'secondary' : 'destructive'}>
                      {getPaceIcon(log.pace_score)} {log.pace_percentage?.toFixed(0) || 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Nenhum registro</p>
            <p className="text-sm">Clique em "Registrar Dia" para adicionar suas atividades diárias</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
