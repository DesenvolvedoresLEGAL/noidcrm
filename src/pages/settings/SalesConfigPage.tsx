import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { useSalesConfig, useHolidays } from '@/hooks/useSalesConfig';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Settings, DollarSign, Percent, Calendar, Plus, Trash2, Save } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function SalesConfigPage() {
  const { config, configLoading, upsertConfig } = useSalesConfig();
  const { holidays, addHoliday, deleteHoliday } = useHolidays();
  
  const [formData, setFormData] = useState({
    monthly_revenue_target: 0,
    average_ticket: 0,
    working_days_per_month: 20,
    // Outbound
    outbound_call_to_lead: 0.30,
    outbound_lead_to_mql: 0.79,
    outbound_mql_to_proposal: 0.90,
    outbound_proposal_to_sale: 0.54,
    // Inbound
    inbound_lead_to_mql: 0.87,
    inbound_mql_to_proposal: 0.90,
    inbound_proposal_to_sale: 0.58,
    // Referral
    referral_request_to_lead: 0.35,
    referral_lead_to_proposal: 0.90,
    referral_proposal_to_sale: 0.70,
    // Revenue share
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
    // Validate revenue share sums to 1
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
    return (
      <Layout>
        <div className="p-6">
          <div className="animate-pulse">Carregando...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Settings className="h-6 w-6" />
              Configurações de Vendas
            </h1>
            <p className="text-muted-foreground">Configure metas, taxas de conversão e feriados</p>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Configurações
          </Button>
        </div>

        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="conversion">Taxas de Conversão</TabsTrigger>
            <TabsTrigger value="holidays">Feriados</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  Metas Globais
                </CardTitle>
                <CardDescription>Configure as metas gerais da organização</CardDescription>
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Percent className="h-5 w-5" />
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

          <TabsContent value="conversion" className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              {/* Outbound */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-blue-600">Outbound</CardTitle>
                  <CardDescription>Taxas de conversão para prospecção ativa</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RateInput
                    label="Ligação → Lead"
                    value={formData.outbound_call_to_lead}
                    onChange={(v) => setFormData({ ...formData, outbound_call_to_lead: v })}
                  />
                  <RateInput
                    label="Lead → MQL"
                    value={formData.outbound_lead_to_mql}
                    onChange={(v) => setFormData({ ...formData, outbound_lead_to_mql: v })}
                  />
                  <RateInput
                    label="MQL → Proposta"
                    value={formData.outbound_mql_to_proposal}
                    onChange={(v) => setFormData({ ...formData, outbound_mql_to_proposal: v })}
                  />
                  <RateInput
                    label="Proposta → Venda"
                    value={formData.outbound_proposal_to_sale}
                    onChange={(v) => setFormData({ ...formData, outbound_proposal_to_sale: v })}
                  />
                </CardContent>
              </Card>

              {/* Inbound */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Inbound</CardTitle>
                  <CardDescription>Taxas de conversão para leads orgânicos</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RateInput
                    label="Lead → MQL"
                    value={formData.inbound_lead_to_mql}
                    onChange={(v) => setFormData({ ...formData, inbound_lead_to_mql: v })}
                  />
                  <RateInput
                    label="MQL → Proposta"
                    value={formData.inbound_mql_to_proposal}
                    onChange={(v) => setFormData({ ...formData, inbound_mql_to_proposal: v })}
                  />
                  <RateInput
                    label="Proposta → Venda"
                    value={formData.inbound_proposal_to_sale}
                    onChange={(v) => setFormData({ ...formData, inbound_proposal_to_sale: v })}
                  />
                </CardContent>
              </Card>

              {/* Referral */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-purple-600">Indicação</CardTitle>
                  <CardDescription>Taxas de conversão para indicações</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <RateInput
                    label="Pedido → Lead"
                    value={formData.referral_request_to_lead}
                    onChange={(v) => setFormData({ ...formData, referral_request_to_lead: v })}
                  />
                  <RateInput
                    label="Lead → Proposta"
                    value={formData.referral_lead_to_proposal}
                    onChange={(v) => setFormData({ ...formData, referral_lead_to_proposal: v })}
                  />
                  <RateInput
                    label="Proposta → Venda"
                    value={formData.referral_proposal_to_sale}
                    onChange={(v) => setFormData({ ...formData, referral_proposal_to_sale: v })}
                  />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="holidays">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Feriados
                    </CardTitle>
                    <CardDescription>Feriados afetam o cálculo de dias úteis</CardDescription>
                  </div>
                  
                  <Dialog open={isAddHolidayOpen} onOpenChange={setIsAddHolidayOpen}>
                    <DialogTrigger asChild>
                      <Button size="sm">
                        <Plus className="h-4 w-4 mr-1" />
                        Adicionar Feriado
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
                              {holiday.is_national ? 'Nacional' : 'Regional'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteHoliday(holiday.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum feriado cadastrado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
