import { useState, useEffect } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { 
  Building2, 
  Globe, 
  Mail, 
  Phone, 
  MapPin, 
  Save, 
  FileText, 
  Briefcase,
  CreditCard,
  Users,
  Hash
} from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  slug: string;
  email?: string;
  phone?: string;
  website?: string;
  domain?: string;
  logo_url?: string;
  primary_color?: string;
  // Dados legais
  cnpj?: string;
  legal_name?: string;
  state_registration?: string;
  municipal_registration?: string;
  // Endereço
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_city?: string;
  address_state?: string;
  address_zip?: string;
  // Configurações
  industry?: string;
  team_size?: string;
  default_currency?: string;
  proposal_prefix?: string;
  proposal_validity_days?: number;
}

const INDUSTRIES = [
  { value: 'technology', label: 'Tecnologia' },
  { value: 'finance', label: 'Finanças' },
  { value: 'healthcare', label: 'Saúde' },
  { value: 'education', label: 'Educação' },
  { value: 'retail', label: 'Varejo' },
  { value: 'manufacturing', label: 'Indústria' },
  { value: 'services', label: 'Serviços' },
  { value: 'real_estate', label: 'Imobiliário' },
  { value: 'consulting', label: 'Consultoria' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'legal', label: 'Jurídico' },
  { value: 'logistics', label: 'Logística' },
  { value: 'hospitality', label: 'Hotelaria' },
  { value: 'food', label: 'Alimentação' },
  { value: 'other', label: 'Outro' },
];

const TEAM_SIZES = [
  { value: '1-5', label: '1-5 funcionários' },
  { value: '6-10', label: '6-10 funcionários' },
  { value: '11-25', label: '11-25 funcionários' },
  { value: '26-50', label: '26-50 funcionários' },
  { value: '51-100', label: '51-100 funcionários' },
  { value: '101-250', label: '101-250 funcionários' },
  { value: '251-500', label: '251-500 funcionários' },
  { value: '500+', label: 'Mais de 500 funcionários' },
];

const CURRENCIES = [
  { value: 'BRL', label: 'Real (R$)' },
  { value: 'USD', label: 'Dólar ($)' },
  { value: 'EUR', label: 'Euro (€)' },
];

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function OrganizationSettings() {
  const { user } = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [organization, setOrganization] = useState<Organization | null>(null);

  useEffect(() => {
    const loadOrganization = async () => {
      if (!user?.id) return;

      try {
        const { data: membership } = await supabase
          .from('organization_members')
          .select('organization_id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .single();

        if (membership?.organization_id) {
          const { data: org } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', membership.organization_id)
            .single();

          if (org) {
            setOrganization(org as Organization);
          }
        }
      } catch (error) {
        console.error('Error loading organization:', error);
      } finally {
        setLoading(false);
      }
    };

    loadOrganization();
  }, [user?.id]);

  const formatCNPJ = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .slice(0, 18);
  };

  const formatCEP = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/^(\d{5})(\d)/, '$1-$2').slice(0, 9);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 10) {
      return numbers
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return numbers
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .slice(0, 15);
  };

  const handleSave = async () => {
    if (!organization) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: organization.name,
          email: organization.email,
          phone: organization.phone,
          website: organization.website,
          domain: organization.domain,
          logo_url: organization.logo_url,
          primary_color: organization.primary_color,
          cnpj: organization.cnpj,
          legal_name: organization.legal_name,
          state_registration: organization.state_registration,
          municipal_registration: organization.municipal_registration,
          address_street: organization.address_street,
          address_number: organization.address_number,
          address_complement: organization.address_complement,
          address_city: organization.address_city,
          address_state: organization.address_state,
          address_zip: organization.address_zip,
          industry: organization.industry,
          team_size: organization.team_size,
          default_currency: organization.default_currency,
          proposal_prefix: organization.proposal_prefix,
          proposal_validity_days: organization.proposal_validity_days,
        })
        .eq('id', organization.id);

      if (error) throw error;

      toast.success('Dados da empresa atualizados com sucesso');
    } catch (error) {
      console.error('Error updating organization:', error);
      toast.error('Erro ao atualizar dados da empresa');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="text-center py-12">
        <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Organização não encontrada</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground">Dados da Empresa</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Gerencie todas as informações da sua organização
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full max-w-2xl grid-cols-4">
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            <span className="hidden sm:inline">Geral</span>
          </TabsTrigger>
          <TabsTrigger value="legal" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Fiscal</span>
          </TabsTrigger>
          <TabsTrigger value="address" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="hidden sm:inline">Endereço</span>
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
          </TabsTrigger>
        </TabsList>

        {/* Tab: Informações Gerais */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Identificação da Empresa
              </CardTitle>
              <CardDescription>
                Dados básicos de identificação
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Fantasia *</Label>
                  <Input
                    id="name"
                    value={organization.name || ''}
                    onChange={(e) => setOrganization({ ...organization, name: e.target.value })}
                    placeholder="Nome comercial da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Identificador (Slug)</Label>
                  <Input
                    id="slug"
                    value={organization.slug || ''}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="legal_name">Razão Social</Label>
                <Input
                  id="legal_name"
                  value={organization.legal_name || ''}
                  onChange={(e) => setOrganization({ ...organization, legal_name: e.target.value })}
                  placeholder="Nome jurídico completo da empresa"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Contato
              </CardTitle>
              <CardDescription>
                Informações de contato da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Email Principal
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={organization.email || ''}
                    onChange={(e) => setOrganization({ ...organization, email: e.target.value })}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    Telefone Principal
                  </Label>
                  <Input
                    id="phone"
                    value={organization.phone || ''}
                    onChange={(e) => setOrganization({ ...organization, phone: formatPhone(e.target.value) })}
                    placeholder="(11) 99999-9999"
                    maxLength={15}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Website
                  </Label>
                  <Input
                    id="website"
                    value={organization.website || ''}
                    onChange={(e) => setOrganization({ ...organization, website: e.target.value })}
                    placeholder="https://www.empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="domain" className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    Domínio
                  </Label>
                  <Input
                    id="domain"
                    value={organization.domain || ''}
                    onChange={(e) => setOrganization({ ...organization, domain: e.target.value })}
                    placeholder="empresa.com"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Dados Fiscais */}
        <TabsContent value="legal" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dados Fiscais e Tributários
              </CardTitle>
              <CardDescription>
                Informações legais e fiscais da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj" className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    CNPJ
                  </Label>
                  <Input
                    id="cnpj"
                    value={organization.cnpj || ''}
                    onChange={(e) => setOrganization({ ...organization, cnpj: formatCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_name_fiscal">Razão Social</Label>
                  <Input
                    id="legal_name_fiscal"
                    value={organization.legal_name || ''}
                    onChange={(e) => setOrganization({ ...organization, legal_name: e.target.value })}
                    placeholder="Nome jurídico completo"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input
                    id="state_registration"
                    value={organization.state_registration || ''}
                    onChange={(e) => setOrganization({ ...organization, state_registration: e.target.value })}
                    placeholder="Número da inscrição estadual"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipal_registration">Inscrição Municipal</Label>
                  <Input
                    id="municipal_registration"
                    value={organization.municipal_registration || ''}
                    onChange={(e) => setOrganization({ ...organization, municipal_registration: e.target.value })}
                    placeholder="Número da inscrição municipal"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Endereço */}
        <TabsContent value="address" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço da Empresa
              </CardTitle>
              <CardDescription>
                Localização física da sede
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address_street">Logradouro</Label>
                  <Input
                    id="address_street"
                    value={organization.address_street || ''}
                    onChange={(e) => setOrganization({ ...organization, address_street: e.target.value })}
                    placeholder="Rua, Avenida, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_number">Número</Label>
                  <Input
                    id="address_number"
                    value={organization.address_number || ''}
                    onChange={(e) => setOrganization({ ...organization, address_number: e.target.value })}
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_complement">Complemento</Label>
                <Input
                  id="address_complement"
                  value={organization.address_complement || ''}
                  onChange={(e) => setOrganization({ ...organization, address_complement: e.target.value })}
                  placeholder="Sala, Andar, Bloco, etc."
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_city">Cidade</Label>
                  <Input
                    id="address_city"
                    value={organization.address_city || ''}
                    onChange={(e) => setOrganization({ ...organization, address_city: e.target.value })}
                    placeholder="São Paulo"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_state">Estado</Label>
                  <Select
                    value={organization.address_state || ''}
                    onValueChange={(value) => setOrganization({ ...organization, address_state: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map(state => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label htmlFor="address_zip">CEP</Label>
                  <Input
                    id="address_zip"
                    value={organization.address_zip || ''}
                    onChange={(e) => setOrganization({ ...organization, address_zip: formatCEP(e.target.value) })}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Configurações */}
        <TabsContent value="settings" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Briefcase className="h-5 w-5" />
                Perfil da Empresa
              </CardTitle>
              <CardDescription>
                Informações sobre o segmento e tamanho da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Setor de Atuação</Label>
                  <Select
                    value={organization.industry || ''}
                    onValueChange={(value) => setOrganization({ ...organization, industry: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map(industry => (
                        <SelectItem key={industry.value} value={industry.value}>
                          {industry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team_size" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Tamanho da Equipe
                  </Label>
                  <Select
                    value={organization.team_size || ''}
                    onValueChange={(value) => setOrganization({ ...organization, team_size: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tamanho" />
                    </SelectTrigger>
                    <SelectContent>
                      {TEAM_SIZES.map(size => (
                        <SelectItem key={size.value} value={size.value}>
                          {size.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Configurações Comerciais
              </CardTitle>
              <CardDescription>
                Configurações padrão para propostas e documentos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="default_currency">Moeda Padrão</Label>
                  <Select
                    value={organization.default_currency || 'BRL'}
                    onValueChange={(value) => setOrganization({ ...organization, default_currency: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a moeda" />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map(currency => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal_prefix">Prefixo de Propostas</Label>
                  <Input
                    id="proposal_prefix"
                    value={organization.proposal_prefix || ''}
                    onChange={(e) => setOrganization({ ...organization, proposal_prefix: e.target.value.toUpperCase() })}
                    placeholder="PROP"
                    maxLength={10}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal_validity_days">Validade das Propostas (dias)</Label>
                  <Input
                    id="proposal_validity_days"
                    type="number"
                    min={1}
                    max={365}
                    value={organization.proposal_validity_days || ''}
                    onChange={(e) => setOrganization({ ...organization, proposal_validity_days: parseInt(e.target.value) || undefined })}
                    placeholder="30"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Personalização
              </CardTitle>
              <CardDescription>
                Identidade visual da empresa
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="logo_url">URL do Logo</Label>
                  <Input
                    id="logo_url"
                    value={organization.logo_url || ''}
                    onChange={(e) => setOrganization({ ...organization, logo_url: e.target.value })}
                    placeholder="https://exemplo.com/logo.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="primary_color">Cor Primária</Label>
                  <div className="flex gap-2">
                    <Input
                      id="primary_color"
                      type="color"
                      value={organization.primary_color || '#6366f1'}
                      onChange={(e) => setOrganization({ ...organization, primary_color: e.target.value })}
                      className="w-14 h-10 p-1 cursor-pointer"
                    />
                    <Input
                      value={organization.primary_color || '#6366f1'}
                      onChange={(e) => setOrganization({ ...organization, primary_color: e.target.value })}
                      placeholder="#6366f1"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {organization.logo_url && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <Label className="text-sm text-muted-foreground">Preview do Logo</Label>
                  <div className="mt-2 flex items-center justify-center bg-background rounded border p-4">
                    <img 
                      src={organization.logo_url} 
                      alt="Logo da empresa" 
                      className="max-h-16 object-contain"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
