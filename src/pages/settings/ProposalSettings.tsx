import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Save, DollarSign, Hash, Calendar, FileText } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { type ProposalSettings as ProposalSettingsType, getProposalSettings, updateProposalSettings } from '@/services/crm/organization-settings';
import { toast } from 'sonner';

export default function ProposalSettings() {
  const { organization } = useCurrentUser();
  const [settings, setSettings] = useState<ProposalSettingsType>({
    default_currency: 'BRL',
    proposal_prefix: 'PROP',
    proposal_sequence: 0,
    proposal_validity_days: 30,
  });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (organization?.id) {
      getProposalSettings(organization.id).then((data) => {
        if (data) setSettings(data);
      });
    }
  }, [organization?.id]);

  const handleSave = async () => {
    if (!organization?.id) return;
    
    setIsSaving(true);
    try {
      await updateProposalSettings(organization.id, settings);
      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações de Propostas</h1>
        <p className="text-muted-foreground mt-2">
          Configure os padrões e comportamentos do sistema de propostas
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Moeda Padrão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Moeda Padrão
            </CardTitle>
            <CardDescription>
              Define a moeda padrão para novas propostas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="currency">Moeda</Label>
              <Select 
                value={settings.default_currency} 
                onValueChange={(value: any) => setSettings({ ...settings, default_currency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BRL">R$ Real Brasileiro (BRL)</SelectItem>
                  <SelectItem value="USD">$ Dólar Americano (USD)</SelectItem>
                  <SelectItem value="EUR">€ Euro (EUR)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Esta moeda será selecionada automaticamente ao criar novas propostas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Prefixo de Numeração */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Prefixo de Numeração
            </CardTitle>
            <CardDescription>
              Define o prefixo usado nos números de proposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefixo</Label>
              <Input
                id="prefix"
                value={settings.proposal_prefix}
                onChange={(e) => setSettings({ ...settings, proposal_prefix: e.target.value.toUpperCase() })}
                placeholder="PROP"
                maxLength={10}
              />
              <p className="text-xs text-muted-foreground mt-2">
                Exemplo: <code className="bg-muted px-1 py-0.5 rounded">{settings.proposal_prefix}-2025-00001</code>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Validade Padrão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Validade Padrão
            </CardTitle>
            <CardDescription>
              Define quantos dias uma proposta fica válida
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="validity">Dias de Validade</Label>
              <Input
                id="validity"
                type="number"
                min="1"
                max="365"
                value={settings.proposal_validity_days}
                onChange={(e) => setSettings({ ...settings, proposal_validity_days: parseInt(e.target.value) || 30 })}
              />
              <p className="text-xs text-muted-foreground mt-2">
                A data de validade será automaticamente calculada ao criar propostas
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Sequência Atual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Sequência Atual
            </CardTitle>
            <CardDescription>
              Número sequencial da próxima proposta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="sequence">Sequência</Label>
              <Input
                id="sequence"
                type="number"
                min="0"
                value={settings.proposal_sequence}
                onChange={(e) => setSettings({ ...settings, proposal_sequence: parseInt(e.target.value) || 0 })}
              />
              <p className="text-xs text-muted-foreground mt-2">
                ⚠️ Cuidado ao alterar este valor. Próximo número: <code className="bg-muted px-1 py-0.5 rounded">{settings.proposal_prefix}-2025-{String(settings.proposal_sequence + 1).padStart(5, '0')}</code>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Botão Salvar */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} size="lg">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Salvando...' : 'Salvar Configurações'}
        </Button>
      </div>
    </div>
  );
}
