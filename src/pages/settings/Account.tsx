import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Globe, CreditCard, Palette, Info, Edit2, X, Check, Users, Target } from 'lucide-react';

// Format CNPJ: XX.XXX.XXX/XXXX-XX
const formatCNPJ = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 14) {
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
  return value;
};

// Format date
const formatDate = (date: string | null) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('pt-BR');
};

export default function AccountSettings() {
  const { organization, isOwner, isAdmin } = useCurrentOrganization();
  const { can } = usePermissions();
  
  // Edit states for each section
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingBranding, setEditingBranding] = useState(false);
  const [editingDomain, setEditingDomain] = useState(false);
  const [saving, setSaving] = useState(false);

  const [companyData, setCompanyData] = useState({
    name: '',
    cnpj: '',
    industry: '',
  });

  const [brandingData, setBrandingData] = useState({
    logo_url: '',
    primary_color: '#000000',
  });

  const [domainData, setDomainData] = useState({
    domain: '',
  });

  // Initialize form data when organization loads
  useEffect(() => {
    if (organization) {
      setCompanyData({
        name: organization.name || '',
        cnpj: (organization as any).cnpj || '',
        industry: (organization as any).industry || '',
      });
      setBrandingData({
        logo_url: organization.logo_url || '',
        primary_color: organization.primary_color || '#000000',
      });
      setDomainData({
        domain: (organization as any).domain || '',
      });
    }
  }, [organization]);

  const canEdit = isOwner || isAdmin || can('settings', 'edit');

  const handleSaveSection = async (section: 'company' | 'branding' | 'domain') => {
    if (!organization?.id || !canEdit) return;

    setSaving(true);
    try {
      let updateData = {};
      
      if (section === 'company') {
        updateData = {
          name: companyData.name,
          cnpj: companyData.cnpj.replace(/\D/g, ''),
          industry: companyData.industry,
        };
      } else if (section === 'branding') {
        updateData = {
          logo_url: brandingData.logo_url,
          primary_color: brandingData.primary_color,
        };
      } else if (section === 'domain') {
        updateData = {
          domain: domainData.domain,
        };
      }

      const { error } = await supabase
        .from('organizations')
        .update(updateData)
        .eq('id', organization.id);

      if (error) throw error;

      toast.success('Informações atualizadas com sucesso');
      
      if (section === 'company') setEditingCompany(false);
      if (section === 'branding') setEditingBranding(false);
      if (section === 'domain') setEditingDomain(false);
      
      // Refresh page to show updated data
      window.location.reload();
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Erro ao atualizar informações');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSection = (section: 'company' | 'branding' | 'domain') => {
    if (organization) {
      if (section === 'company') {
        setCompanyData({
          name: organization.name || '',
          cnpj: (organization as any).cnpj || '',
          industry: (organization as any).industry || '',
        });
        setEditingCompany(false);
      } else if (section === 'branding') {
        setBrandingData({
          logo_url: organization.logo_url || '',
          primary_color: organization.primary_color || '#000000',
        });
        setEditingBranding(false);
      } else if (section === 'domain') {
        setDomainData({
          domain: (organization as any).domain || '',
        });
        setEditingDomain(false);
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      trial: 'secondary',
      active: 'default',
      expired: 'destructive',
    };
    return (
      <Badge variant={variants[status] || 'outline'}>
        {status === 'trial' ? 'Período de Avaliação' : status === 'active' ? 'Ativo' : 'Expirado'}
      </Badge>
    );
  };

  if (!organization) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-5xl">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Configurações da Conta</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as informações da sua organização
          </p>
        </div>

        {/* Workspace Information - Read Only */}
        <Card className="animate-fade-in border-primary/20" style={{ animationDelay: '50ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" />
                <CardTitle>Informações do Workspace</CardTitle>
              </div>
              {getStatusBadge(organization.status)}
            </div>
            <CardDescription>
              Dados de identificação do workspace (somente leitura)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Nome do Workspace</Label>
                <p className="text-sm font-medium text-foreground">{organization.name}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Endereço do Workspace</Label>
                <p className="text-sm font-mono text-foreground">{organization.slug}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">ID da Conta</Label>
                <p className="text-sm font-mono text-muted-foreground truncate">{organization.id}</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status da Conta</Label>
                <p className="text-sm font-medium text-foreground capitalize">{organization.status}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Information */}
        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Building2 className="h-5 w-5 text-primary" />
                  <CardTitle>Informações da Empresa</CardTitle>
                </div>
                <CardDescription className="mt-1.5">
                  Dados básicos e identificação da empresa
                </CardDescription>
              </div>
              {canEdit && !editingCompany && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingCompany(true)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!editingCompany ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Nome da Empresa</Label>
                  <p className="text-sm font-medium text-foreground">{companyData.name || '—'}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">CNPJ</Label>
                  <p className="text-sm font-mono text-foreground">
                    {companyData.cnpj ? formatCNPJ(companyData.cnpj) : '—'}
                  </p>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Segmento</Label>
                  <p className="text-sm font-medium text-foreground">{companyData.industry || '—'}</p>
                </div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Empresa *</Label>
                    <Input
                      id="name"
                      value={companyData.name}
                      onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                      placeholder="Acme Corp"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cnpj">CNPJ</Label>
                    <Input
                      id="cnpj"
                      value={formatCNPJ(companyData.cnpj)}
                      onChange={(e) => setCompanyData({ ...companyData, cnpj: e.target.value })}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Segmento</Label>
                  <Input
                    id="industry"
                    value={companyData.industry}
                    onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                    placeholder="Tecnologia, Consultoria, etc."
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelSection('company')}
                    disabled={saving}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveSection('company')}
                    disabled={saving}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Branding */}
        <Card className="animate-fade-in" style={{ animationDelay: '150ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Palette className="h-5 w-5 text-primary" />
                  <CardTitle>Identidade Visual</CardTitle>
                </div>
                <CardDescription className="mt-1.5">
                  Personalize a aparência da plataforma
                </CardDescription>
              </div>
              {canEdit && !editingBranding && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingBranding(true)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!editingBranding ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">URL do Logo</Label>
                  <p className="text-sm font-medium text-foreground break-all">
                    {brandingData.logo_url || '—'}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Cor Primária</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded border border-border"
                      style={{ backgroundColor: brandingData.primary_color }}
                    />
                    <p className="text-sm font-mono text-foreground">{brandingData.primary_color}</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="logo_url">URL do Logo</Label>
                  <Input
                    id="logo_url"
                    value={brandingData.logo_url}
                    onChange={(e) => setBrandingData({ ...brandingData, logo_url: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={brandingData.primary_color}
                      onChange={(e) => setBrandingData({ ...brandingData, primary_color: e.target.value })}
                      className="w-20 h-10"
                    />
                    <Input
                      value={brandingData.primary_color}
                      onChange={(e) => setBrandingData({ ...brandingData, primary_color: e.target.value })}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelSection('branding')}
                    disabled={saving}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveSection('branding')}
                    disabled={saving}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Domain */}
        <Card className="animate-fade-in" style={{ animationDelay: '200ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-primary" />
                  <CardTitle>Domínio</CardTitle>
                </div>
                <CardDescription className="mt-1.5">
                  Configure um domínio personalizado para seu workspace
                </CardDescription>
              </div>
              {canEdit && !editingDomain && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditingDomain(true)}
                  className="gap-2"
                >
                  <Edit2 className="h-4 w-4" />
                  Editar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!editingDomain ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Domínio Personalizado</Label>
                <p className="text-sm font-medium text-foreground">{domainData.domain || 'Não configurado'}</p>
                {!domainData.domain && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Entre em contato com o suporte para ativar seu domínio personalizado
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="domain">Domínio Personalizado</Label>
                  <Input
                    id="domain"
                    value={domainData.domain}
                    onChange={(e) => setDomainData({ ...domainData, domain: e.target.value })}
                    placeholder="crm.suaempresa.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Entre em contato com o suporte para ativar seu domínio personalizado
                  </p>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelSection('domain')}
                    disabled={saving}
                    className="gap-2"
                  >
                    <X className="h-4 w-4" />
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleSaveSection('domain')}
                    disabled={saving}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {saving ? 'Salvando...' : 'Salvar'}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Plan & Billing */}
        <Card className="animate-fade-in" style={{ animationDelay: '250ms' }}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Plano e Cobrança</CardTitle>
            </div>
            <CardDescription>
              Informações sobre seu plano e limites de uso
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Plano Atual</p>
                  {getStatusBadge(organization.status)}
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {organization.status === 'trial' ? 'Período de Avaliação' : 'Enterprise'}
                </p>
                {organization.trial_ends_at && (
                  <p className="text-xs text-muted-foreground">
                    Válido até: {formatDate(organization.trial_ends_at)}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Usuários</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {organization.max_users || '∞'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Oportunidades</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">
                    {organization.max_opportunities || '∞'}
                  </span>
                </div>
              </div>
            </div>

            <Button variant="outline" className="w-full" disabled>
              Gerenciar Plano
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
