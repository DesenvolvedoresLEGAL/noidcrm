import { useState, useEffect } from 'react';
import { useSalesConfig, useHolidays } from '@/hooks/useSalesConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Percent, Calendar, Plus, Trash2, Save, Users, TrendingUp } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export function OTEGlobalConfig() {
  const { config, configLoading, upsertConfig } = useSalesConfig();
  const { holidays, addHoliday, deleteHoliday } = useHolidays();
  
  const [formData, setFormData] = useState({
    monthly_revenue_target: 0,
    average_ticket: 0,
    working_days_per_month: 20,
    headcount_sdr: 0,
    headcount_closer: 0,
    headcount_farmer: 0,
    headcount_cs: 0,
    outbound_call_to_lead: 0.30,
    outbound_lead_to_mql: 0.79,
    outbound_mql_to_proposal: 0.90,
    outbound_proposal_to_sale: 0.54,
    inbound_lead_to_mql: 0.87,
    inbound_mql_to_proposal: 0.90,
    inbound_proposal_to_sale: 0.58,
    referral_request_to_lead: 0.35,
    referral_lead_to_proposal: 0.90,
    referral_proposal_to_sale: 0.70,
    revenue_share_outbound: 0.23,
    revenue_share_inbound: 0.72,
    revenue_share_referral: 0.05,
  });

  const [newHoliday, setNewHoliday] = useState({ holiday_date: '', name: '' });
  const [isAddHolidayOpen, setIsAddHolidayOpen] = useState(false);

  useEffect(() => {
    if (config) {
      setFormData({
        monthly_revenue_target: config.monthly_revenue_target || 0,
        average_ticket: config.average_ticket || 0,
        working_days_per_month: config.working_days_per_month || 20,
        headcount_sdr: (config as any).headcount_sdr || 0,
        headcount_closer: (config as any).headcount_closer || 0,
        headcount_farmer: (config as any).headcount_farmer || 0,
        headcount_cs: (config as any).headcount_cs || 0,
        outbound_call_to_lead: config.outbound_call_to_lead || 0.30,
        outbound_lead_to_mql: config.outbound_lead_to_mql || 0.79,
        outbound_mql_to_proposal: config.outbound_mql_to_proposal || 0.90,
        outbound_proposal_to_sale: config.outbound_proposal_to_sale || 0.54,
        inbound_lead_to_mql: config.inbound_lead_to_mql || 0.87,
        inbound_mql_to_proposal: config.inbound_mql_to_proposal || 0.90,
        inbound_proposal_to_sale: config.inbound_proposal_to_sale || 0.58,
        referral_request_to_lead: config.referral_request_to_lead || 0.35,
        referral_lead_to_proposal: config.referral_lead_to_proposal || 0.90,
        referral_proposal_to_sale: config.referral_proposal_to_sale || 0.70,
        revenue_share_outbound: config.revenue_share_outbound || 0.23,
        revenue_share_inbound: config.revenue_share_inbound || 0.72,
        revenue_share_referral: config.revenue_share_referral || 0.05,
      });
    }
  }, [config]);

  const handleSave = async () => {
    const totalShare = formData.revenue_share_outbound + formData.revenue_share_inbound + formData.revenue_share_referral;
    if (Math.abs(totalShare - 1) > 0.01) {
      toast.error('A soma das distribuições de receita deve ser 100%');
      return;
    }
    await upsertConfig(formData);
  };

  const handleAddHoliday = async () => {
    if (!newHoliday.holiday_date || !newHoliday.name) {
      toast.error('Preencha data e nome do feriado');
      return;
    }
    await addHoliday(newHoliday);
    setNewHoliday({ holiday_date: '', name: '' });
    setIsAddHolidayOpen(false);
  };

  const RateInput = ({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) => (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          step="0.01"
          min="0"
          max="1"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="text-sm"
        />
        <span className="text-muted-foreground text-sm">({(value * 100).toFixed(0)}%)</span>
      </div>
    </div>
  );

  if (configLoading) {
    return <div className="py-8 text-center text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          Configure metas globais, taxas de conversão e feriados da organização.
        </p>
        <Button onClick={handleSave}>
          <Save className="h-4 w-4 mr-2" />
          Salvar
        </Button>
      </div>

      <Tabs defaultValue="metas">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metas">Metas</TabsTrigger>
          <TabsTrigger value="headcount">Headcount</TabsTrigger>
          <TabsTrigger value="conversao">Taxas</TabsTrigger>
          <TabsTrigger value="feriados">Feriados</TabsTrigger>
        </TabsList>

        <TabsContent value="metas" className="space-y-4 mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="h-4 w-4" />
                Metas Globais
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <Label>Meta de Receita Mensal (R$)</Label>
                <Input
                  type="number"
                  value={formData.monthly_revenue_target}
                  onChange={(e) => setFormData({ ...formData, monthly_revenue_target: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Ticket Médio (R$)</Label>
                <Input
                  type="number"
                  value={formData.average_ticket}
                  onChange={(e) => setFormData({ ...formData, average_ticket: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Dias Úteis por Mês</Label>
                <Input
                  type="number"
                  value={formData.working_days_per_month}
                  onChange={(e) => setFormData({ ...formData, working_days_per_month: parseInt(e.target.value) || 20 })}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Percent className="h-4 w-4" />
                Distribuição de Receita por Canal
              </CardTitle>
              <CardDescription>A soma deve ser 100%</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
              <div>
                <Label>Outbound (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.revenue_share_outbound * 100}
                  onChange={(e) => setFormData({ ...formData, revenue_share_outbound: (parseFloat(e.target.value) || 0) / 100 })}
                />
              </div>
              <div>
                <Label>Inbound (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.revenue_share_inbound * 100}
                  onChange={(e) => setFormData({ ...formData, revenue_share_inbound: (parseFloat(e.target.value) || 0) / 100 })}
                />
              </div>
              <div>
                <Label>Indicação (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.revenue_share_referral * 100}
                  onChange={(e) => setFormData({ ...formData, revenue_share_referral: (parseFloat(e.target.value) || 0) / 100 })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="headcount" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Users className="h-4 w-4" />
                Headcount
              </CardTitle>
              <CardDescription>Quantidade de pessoas por função</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-4 gap-4">
              <div>
                <Label>SDRs</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.headcount_sdr}
                  onChange={(e) => setFormData({ ...formData, headcount_sdr: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Closers</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.headcount_closer}
                  onChange={(e) => setFormData({ ...formData, headcount_closer: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Farmers</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.headcount_farmer}
                  onChange={(e) => setFormData({ ...formData, headcount_farmer: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>CS</Label>
                <Input
                  type="number"
                  min="0"
                  value={formData.headcount_cs}
                  onChange={(e) => setFormData({ ...formData, headcount_cs: parseInt(e.target.value) || 0 })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="conversao" className="mt-4">
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-blue-600">Outbound</CardTitle>
                <CardDescription>Prospecção ativa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <RateInput label="Ligação → Lead" value={formData.outbound_call_to_lead} onChange={(v) => setFormData({ ...formData, outbound_call_to_lead: v })} />
                <RateInput label="Lead → MQL" value={formData.outbound_lead_to_mql} onChange={(v) => setFormData({ ...formData, outbound_lead_to_mql: v })} />
                <RateInput label="MQL → Proposta" value={formData.outbound_mql_to_proposal} onChange={(v) => setFormData({ ...formData, outbound_mql_to_proposal: v })} />
                <RateInput label="Proposta → Venda" value={formData.outbound_proposal_to_sale} onChange={(v) => setFormData({ ...formData, outbound_proposal_to_sale: v })} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-green-600">Inbound</CardTitle>
                <CardDescription>Leads orgânicos</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <RateInput label="Lead → MQL" value={formData.inbound_lead_to_mql} onChange={(v) => setFormData({ ...formData, inbound_lead_to_mql: v })} />
                <RateInput label="MQL → Proposta" value={formData.inbound_mql_to_proposal} onChange={(v) => setFormData({ ...formData, inbound_mql_to_proposal: v })} />
                <RateInput label="Proposta → Venda" value={formData.inbound_proposal_to_sale} onChange={(v) => setFormData({ ...formData, inbound_proposal_to_sale: v })} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base text-purple-600">Indicação</CardTitle>
                <CardDescription>Referrals</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <RateInput label="Pedido → Lead" value={formData.referral_request_to_lead} onChange={(v) => setFormData({ ...formData, referral_request_to_lead: v })} />
                <RateInput label="Lead → Proposta" value={formData.referral_lead_to_proposal} onChange={(v) => setFormData({ ...formData, referral_lead_to_proposal: v })} />
                <RateInput label="Proposta → Venda" value={formData.referral_proposal_to_sale} onChange={(v) => setFormData({ ...formData, referral_proposal_to_sale: v })} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="feriados" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-4 w-4" />
                    Feriados
                  </CardTitle>
                  <CardDescription>Afetam o cálculo de dias úteis</CardDescription>
                </div>
                
                <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar Feriado</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={newHoliday.holiday_date}
                          onChange={(e) => setNewHoliday({ ...newHoliday, holiday_date: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>Nome</Label>
                        <Input
                          value={newHoliday.name}
                          onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                          placeholder="Ex: Natal"
                        />
                      </div>
                      <Button onClick={handleAddHoliday} className="w-full">
                        Adicionar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {holidays && holidays.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-16"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holidays.map((holiday) => (
                      <TableRow key={holiday.id}>
                        <TableCell>
                          {format(parseISO(holiday.holiday_date), 'dd/MM/yyyy', { locale: ptBR })}
                        </TableCell>
                        <TableCell>{holiday.name}</TableCell>
                        <TableCell>
                          <Badge variant={holiday.is_national ? 'default' : 'secondary'}>
                            {holiday.is_national ? 'Nacional' : 'Local'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => deleteHoliday(holiday.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center text-muted-foreground py-8">
                  Nenhum feriado cadastrado
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}