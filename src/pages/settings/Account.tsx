import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Globe, CreditCard, Palette } from 'lucide-react';

export default function AccountSettings() {
  const { organization, isOwner, isAdmin } = useCurrentOrganization();
  const { can } = usePermissions();
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: organization?.name || '',
    cnpj: (organization as any)?.cnpj || '',
    industry: (organization as any)?.industry || '',
    domain: (organization as any)?.domain || '',
    primary_color: organization?.primary_color || '#000000',
    logo_url: organization?.logo_url || '',
  });

  const canEdit = isOwner || isAdmin || can('settings', 'edit');

  const handleSave = async () => {
    if (!organization?.id || !canEdit) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          cnpj: formData.cnpj,
          industry: formData.industry,
          domain: formData.domain,
          primary_color: formData.primary_color,
          logo_url: formData.logo_url,
        })
        .eq('id', organization.id);

      if (error) throw error;

      toast.success('Informações da empresa atualizadas');
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Erro ao atualizar informações');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-4xl">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Conta</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as informações da sua empresa
          </p>
        </div>

        {/* Company Information */}
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              <CardTitle>Informações da Empresa</CardTitle>
            </div>
            <CardDescription>
              Dados básicos e identificação da empresa
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Empresa *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!canEdit}
                  placeholder="Acme Corp"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={formData.cnpj}
                  onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                  disabled={!canEdit}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="industry">Segmento</Label>
              <Input
                id="industry"
                value={formData.industry}
                onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                disabled={!canEdit}
                placeholder="Tecnologia, Consultoria, etc."
              />
            </div>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-primary" />
              <CardTitle>Identidade Visual</CardTitle>
            </div>
            <CardDescription>
              Personalize a aparência da plataforma
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">URL do Logo</Label>
              <Input
                id="logo_url"
                value={formData.logo_url}
                onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                disabled={!canEdit}
                placeholder="https://exemplo.com/logo.png"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="primary_color">Cor Primária</Label>
              <div className="flex gap-2">
                <Input
                  id="primary_color"
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  disabled={!canEdit}
                  className="w-20 h-10"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => setFormData({ ...formData, primary_color: e.target.value })}
                  disabled={!canEdit}
                  placeholder="#000000"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Domain */}
        <Card className="animate-fade-in" style={{ animationDelay: '300ms' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Domínio</CardTitle>
            </div>
            <CardDescription>
              Configure um domínio personalizado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="domain">Domínio Personalizado</Label>
              <Input
                id="domain"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value })}
                disabled={!canEdit}
                placeholder="crm.suaempresa.com"
              />
              <p className="text-xs text-muted-foreground">
                Entre em contato com o suporte para ativar seu domínio personalizado
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Billing (Placeholder) */}
        <Card className="animate-fade-in" style={{ animationDelay: '400ms' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Plano e Cobrança</CardTitle>
            </div>
            <CardDescription>
              Gerencie seu plano e formas de pagamento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div>
                <p className="font-medium">Plano Atual</p>
                <p className="text-sm text-muted-foreground">
                  {organization?.status === 'trial' ? 'Trial' : 'Enterprise'}
                </p>
              </div>
              <Button variant="outline" disabled>
                Gerenciar Plano
              </Button>
            </div>
          </CardContent>
        </Card>

        {canEdit && (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setFormData({
                  name: organization?.name || '',
                  cnpj: (organization as any)?.cnpj || '',
                  industry: (organization as any)?.industry || '',
                  domain: (organization as any)?.domain || '',
                  primary_color: organization?.primary_color || '#000000',
                  logo_url: organization?.logo_url || '',
                });
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
