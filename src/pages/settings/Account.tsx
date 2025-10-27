import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Building2, Globe, CreditCard, Palette, Info, Edit2, X, Check, Users, Target, MapPin, Phone, Mail, FileText, Upload, Image as ImageIcon } from 'lucide-react';

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

// Format CEP: XXXXX-XXX
const formatCEP = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 8) {
    return numbers.replace(/^(\d{5})(\d)/, '$1-$2');
  }
  return value;
};

// Format Phone: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
const formatPhone = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    if (numbers.length <= 10) {
      return numbers
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    }
    return numbers
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2');
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
  const { users } = useOrganizationUsers();
  
  // Edit states for each section
  const [editingCompany, setEditingCompany] = useState(false);
  const [editingAddress, setEditingAddress] = useState(false);
  const [editingContact, setEditingContact] = useState(false);
  const [editingLegal, setEditingLegal] = useState(false);
  const [editingBranding, setEditingBranding] = useState(false);
  const [editingDomain, setEditingDomain] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('');

  const [companyData, setCompanyData] = useState({
    name: '',
    legal_name: '',
    cnpj: '',
    industry: '',
  });

  const [addressData, setAddressData] = useState({
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    address_zip: '',
  });

  const [contactData, setContactData] = useState({
    phone: '',
    email: '',
    website: '',
  });

  const [legalData, setLegalData] = useState({
    state_registration: '',
    municipal_registration: '',
    responsible_user_id: '',
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
      const org = organization as any;
      setCompanyData({
        name: organization.name || '',
        legal_name: org.legal_name || '',
        cnpj: org.cnpj || '',
        industry: org.industry || '',
      });
      setAddressData({
        address_street: org.address_street || '',
        address_number: org.address_number || '',
        address_complement: org.address_complement || '',
        address_city: org.address_city || '',
        address_state: org.address_state || '',
        address_zip: org.address_zip || '',
      });
      setContactData({
        phone: org.phone || '',
        email: org.email || '',
        website: org.website || '',
      });
      setLegalData({
        state_registration: org.state_registration || '',
        municipal_registration: org.municipal_registration || '',
        responsible_user_id: org.responsible_user_id || '',
      });
      setBrandingData({
        logo_url: organization.logo_url || '',
        primary_color: organization.primary_color || '#000000',
      });
      setDomainData({
        domain: org.domain || '',
      });
      setLogoPreview(organization.logo_url || '');
    }
  }, [organization]);

  const canEdit = isOwner || isAdmin || can('settings', 'edit');

  const handleSaveSection = async (section: 'company' | 'address' | 'contact' | 'legal' | 'branding' | 'domain') => {
    if (!organization?.id || !canEdit) return;

    setSaving(true);
    try {
      let updateData: any = {};
      
      if (section === 'company') {
        updateData = {
          name: companyData.name,
          legal_name: companyData.legal_name,
          cnpj: companyData.cnpj.replace(/\D/g, ''),
          industry: companyData.industry,
        };
      } else if (section === 'address') {
        updateData = {
          address_street: addressData.address_street,
          address_number: addressData.address_number,
          address_complement: addressData.address_complement,
          address_city: addressData.address_city,
          address_state: addressData.address_state,
          address_zip: addressData.address_zip.replace(/\D/g, ''),
        };
      } else if (section === 'contact') {
        updateData = {
          phone: contactData.phone.replace(/\D/g, ''),
          email: contactData.email,
          website: contactData.website,
        };
      } else if (section === 'legal') {
        updateData = {
          state_registration: legalData.state_registration,
          municipal_registration: legalData.municipal_registration,
          responsible_user_id: legalData.responsible_user_id || null,
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
      if (section === 'address') setEditingAddress(false);
      if (section === 'contact') setEditingContact(false);
      if (section === 'legal') setEditingLegal(false);
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

  const handleCancelSection = (section: 'company' | 'address' | 'contact' | 'legal' | 'branding' | 'domain') => {
    if (organization) {
      const org = organization as any;
      if (section === 'company') {
        setCompanyData({
          name: organization.name || '',
          legal_name: org.legal_name || '',
          cnpj: org.cnpj || '',
          industry: org.industry || '',
        });
        setEditingCompany(false);
      } else if (section === 'address') {
        setAddressData({
          address_street: org.address_street || '',
          address_number: org.address_number || '',
          address_complement: org.address_complement || '',
          address_city: org.address_city || '',
          address_state: org.address_state || '',
          address_zip: org.address_zip || '',
        });
        setEditingAddress(false);
      } else if (section === 'contact') {
        setContactData({
          phone: org.phone || '',
          email: org.email || '',
          website: org.website || '',
        });
        setEditingContact(false);
      } else if (section === 'legal') {
        setLegalData({
          state_registration: org.state_registration || '',
          municipal_registration: org.municipal_registration || '',
          responsible_user_id: org.responsible_user_id || '',
        });
        setEditingLegal(false);
      } else if (section === 'branding') {
        setBrandingData({
          logo_url: organization.logo_url || '',
          primary_color: organization.primary_color || '#000000',
        });
        setEditingBranding(false);
      } else if (section === 'domain') {
        setDomainData({
          domain: org.domain || '',
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
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        <div className="animate-fade-in">
          <h1 className="text-2xl md:text-3xl font-black text-foreground">Configurações da Conta</h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Gerencie as informações da sua organização
          </p>
        </div>

        {/* Workspace Information - Read Only */}
        <Card className="animate-fade-in border-primary/20">
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

        {/* Tabs Navigation */}
        <Tabs defaultValue="dados" className="w-full">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 mb-4">
            <TabsTrigger value="dados">Dados</TabsTrigger>
            <TabsTrigger value="endereco">Endereço</TabsTrigger>
            <TabsTrigger value="contato">Contato</TabsTrigger>
            <TabsTrigger value="legal">Legal/Fiscal</TabsTrigger>
            <TabsTrigger value="branding">Visual</TabsTrigger>
            <TabsTrigger value="plano">Plano</TabsTrigger>
          </TabsList>

          {/* Tab: Dados (Company Information) */}
          <TabsContent value="dados" className="space-y-4">
            <Card>
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
                      <Label className="text-xs text-muted-foreground">Nome Fantasia</Label>
                      <p className="text-sm font-medium text-foreground">{companyData.name || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Razão Social</Label>
                      <p className="text-sm font-medium text-foreground">{companyData.legal_name || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">CNPJ</Label>
                      <p className="text-sm font-mono text-foreground">
                        {companyData.cnpj ? formatCNPJ(companyData.cnpj) : '—'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Segmento</Label>
                      <p className="text-sm font-medium text-foreground">{companyData.industry || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Nome Fantasia *</Label>
                        <Input
                          id="name"
                          value={companyData.name}
                          onChange={(e) => setCompanyData({ ...companyData, name: e.target.value })}
                          placeholder="Acme Corp"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="legal_name">Razão Social</Label>
                        <Input
                          id="legal_name"
                          value={companyData.legal_name}
                          onChange={(e) => setCompanyData({ ...companyData, legal_name: e.target.value })}
                          placeholder="Acme Corporation LTDA"
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
                      <div className="space-y-2">
                        <Label htmlFor="industry">Segmento</Label>
                        <Input
                          id="industry"
                          value={companyData.industry}
                          onChange={(e) => setCompanyData({ ...companyData, industry: e.target.value })}
                          placeholder="Tecnologia, Consultoria, etc."
                        />
                      </div>
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
          </TabsContent>

          {/* Tab: Endereço (Address) */}
          <TabsContent value="endereco" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-primary" />
                      <CardTitle>Endereço</CardTitle>
                    </div>
                    <CardDescription className="mt-1.5">
                      Endereço completo da empresa
                    </CardDescription>
                  </div>
                  {canEdit && !editingAddress && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingAddress(true)}
                      className="gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editingAddress ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Logradouro</Label>
                      <p className="text-sm font-medium text-foreground">{addressData.address_street || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Número</Label>
                      <p className="text-sm font-medium text-foreground">{addressData.address_number || '—'}</p>
                    </div>
                    <div className="space-y-1.5 md:col-span-3">
                      <Label className="text-xs text-muted-foreground">Complemento</Label>
                      <p className="text-sm font-medium text-foreground">{addressData.address_complement || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Cidade</Label>
                      <p className="text-sm font-medium text-foreground">{addressData.address_city || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Estado</Label>
                      <p className="text-sm font-medium text-foreground">{addressData.address_state || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">CEP</Label>
                      <p className="text-sm font-mono text-foreground">
                        {addressData.address_zip ? formatCEP(addressData.address_zip) : '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="address_street">Logradouro</Label>
                        <Input
                          id="address_street"
                          value={addressData.address_street}
                          onChange={(e) => setAddressData({ ...addressData, address_street: e.target.value })}
                          placeholder="Rua, Avenida, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address_number">Número</Label>
                        <Input
                          id="address_number"
                          value={addressData.address_number}
                          onChange={(e) => setAddressData({ ...addressData, address_number: e.target.value })}
                          placeholder="123"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-3">
                        <Label htmlFor="address_complement">Complemento</Label>
                        <Input
                          id="address_complement"
                          value={addressData.address_complement}
                          onChange={(e) => setAddressData({ ...addressData, address_complement: e.target.value })}
                          placeholder="Sala, Andar, etc."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address_city">Cidade</Label>
                        <Input
                          id="address_city"
                          value={addressData.address_city}
                          onChange={(e) => setAddressData({ ...addressData, address_city: e.target.value })}
                          placeholder="São Paulo"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address_state">Estado</Label>
                        <Input
                          id="address_state"
                          value={addressData.address_state}
                          onChange={(e) => setAddressData({ ...addressData, address_state: e.target.value })}
                          placeholder="SP"
                          maxLength={2}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address_zip">CEP</Label>
                        <Input
                          id="address_zip"
                          value={formatCEP(addressData.address_zip)}
                          onChange={(e) => setAddressData({ ...addressData, address_zip: e.target.value })}
                          placeholder="00000-000"
                          maxLength={9}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelSection('address')}
                        disabled={saving}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveSection('address')}
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
          </TabsContent>

          {/* Tab: Contato (Contact) */}
          <TabsContent value="contato" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-5 w-5 text-primary" />
                      <CardTitle>Informações de Contato</CardTitle>
                    </div>
                    <CardDescription className="mt-1.5">
                      Telefone, e-mail e website da empresa
                    </CardDescription>
                  </div>
                  {canEdit && !editingContact && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingContact(true)}
                      className="gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editingContact ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Telefone</Label>
                      <p className="text-sm font-mono text-foreground">
                        {contactData.phone ? formatPhone(contactData.phone) : '—'}
                      </p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">E-mail</Label>
                      <p className="text-sm font-medium text-foreground">{contactData.email || '—'}</p>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Website</Label>
                      <p className="text-sm font-medium text-foreground break-all">{contactData.website || '—'}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="phone">Telefone</Label>
                        <Input
                          id="phone"
                          value={formatPhone(contactData.phone)}
                          onChange={(e) => setContactData({ ...contactData, phone: e.target.value })}
                          placeholder="(11) 98765-4321"
                          maxLength={15}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-mail</Label>
                        <Input
                          id="email"
                          type="email"
                          value={contactData.email}
                          onChange={(e) => setContactData({ ...contactData, email: e.target.value })}
                          placeholder="contato@empresa.com"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="website">Website</Label>
                        <Input
                          id="website"
                          value={contactData.website}
                          onChange={(e) => setContactData({ ...contactData, website: e.target.value })}
                          placeholder="https://www.empresa.com"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelSection('contact')}
                        disabled={saving}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveSection('contact')}
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
          </TabsContent>

          {/* Tab: Legal/Fiscal */}
          <TabsContent value="legal" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      <CardTitle>Informações Legais e Fiscais</CardTitle>
                    </div>
                    <CardDescription className="mt-1.5">
                      Inscrições estaduais, municipais e responsável pela conta
                    </CardDescription>
                  </div>
                  {canEdit && !editingLegal && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingLegal(true)}
                      className="gap-2"
                    >
                      <Edit2 className="h-4 w-4" />
                      Editar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!editingLegal ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Inscrição Estadual</Label>
                      <p className="text-sm font-mono text-foreground">{legalData.state_registration || '—'}</p>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Inscrição Municipal</Label>
                      <p className="text-sm font-mono text-foreground">{legalData.municipal_registration || '—'}</p>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                      <Label className="text-xs text-muted-foreground">Responsável pela Conta</Label>
                      <p className="text-sm font-medium text-foreground">
                        {users.find(u => u.id === legalData.responsible_user_id)?.name || '—'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="state_registration">Inscrição Estadual</Label>
                        <Input
                          id="state_registration"
                          value={legalData.state_registration}
                          onChange={(e) => setLegalData({ ...legalData, state_registration: e.target.value })}
                          placeholder="000.000.000.000"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="municipal_registration">Inscrição Municipal</Label>
                        <Input
                          id="municipal_registration"
                          value={legalData.municipal_registration}
                          onChange={(e) => setLegalData({ ...legalData, municipal_registration: e.target.value })}
                          placeholder="000.000.000-0"
                        />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label htmlFor="responsible">Responsável pela Conta</Label>
                        <select
                          id="responsible"
                          value={legalData.responsible_user_id}
                          onChange={(e) => setLegalData({ ...legalData, responsible_user_id: e.target.value })}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        >
                          <option value="">Selecione um usuário</option>
                          {users.map((user) => (
                            <option key={user.id} value={user.id}>
                              {user.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCancelSection('legal')}
                        disabled={saving}
                        className="gap-2"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSaveSection('legal')}
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
          </TabsContent>

          {/* Tab: Branding (Visual Identity) */}
          <TabsContent value="branding" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Palette className="h-5 w-5 text-primary" />
                      <CardTitle>Identidade Visual</CardTitle>
                    </div>
                    <CardDescription className="mt-1.5">
                      Logo e cores da plataforma
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
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Logo da Empresa</Label>
                      {logoPreview ? (
                        <div className="flex items-center gap-4">
                          <Avatar className="h-20 w-20 rounded-lg">
                            <AvatarImage src={logoPreview} alt="Logo" />
                            <AvatarFallback className="rounded-lg bg-muted">
                              <ImageIcon className="h-10 w-10 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-foreground break-all">{brandingData.logo_url}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-4 p-4 border border-dashed rounded-lg bg-muted/30">
                          <ImageIcon className="h-10 w-10 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Nenhum logo configurado</p>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">Cor Primária</Label>
                      <div className="flex items-center gap-3">
                        <div
                          className="w-16 h-16 rounded-lg border-2 border-border shadow-sm"
                          style={{ backgroundColor: brandingData.primary_color }}
                        />
                        <div>
                          <p className="text-sm font-mono font-medium text-foreground">{brandingData.primary_color}</p>
                          <p className="text-xs text-muted-foreground">Cor principal do tema</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="logo_url">URL do Logo</Label>
                        <Input
                          id="logo_url"
                          value={brandingData.logo_url}
                          onChange={(e) => {
                            setBrandingData({ ...brandingData, logo_url: e.target.value });
                            setLogoPreview(e.target.value);
                          }}
                          placeholder="https://exemplo.com/logo.png"
                        />
                        <p className="text-xs text-muted-foreground">
                          Cole o URL da imagem do seu logo
                        </p>
                      </div>
                      {logoPreview && (
                        <div className="p-4 border rounded-lg bg-muted/30">
                          <Label className="text-xs text-muted-foreground mb-2 block">Pré-visualização</Label>
                          <Avatar className="h-20 w-20 rounded-lg">
                            <AvatarImage src={logoPreview} alt="Logo preview" />
                            <AvatarFallback className="rounded-lg bg-muted">
                              <ImageIcon className="h-10 w-10 text-muted-foreground" />
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      <div className="space-y-2">
                        <Label htmlFor="primary_color">Cor Primária</Label>
                        <div className="flex gap-2">
                          <Input
                            id="primary_color"
                            type="color"
                            value={brandingData.primary_color}
                            onChange={(e) => setBrandingData({ ...brandingData, primary_color: e.target.value })}
                            className="w-24 h-12 cursor-pointer"
                          />
                          <Input
                            value={brandingData.primary_color}
                            onChange={(e) => setBrandingData({ ...brandingData, primary_color: e.target.value })}
                            placeholder="#000000"
                            className="flex-1"
                          />
                        </div>
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

            {/* Domain Card - Part of Branding Tab */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-primary" />
                      <CardTitle>Domínio Personalizado</CardTitle>
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
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Domínio Configurado</Label>
                    {domainData.domain ? (
                      <p className="text-sm font-mono font-medium text-foreground">{domainData.domain}</p>
                    ) : (
                      <div className="p-4 border border-dashed rounded-lg bg-muted/30">
                        <p className="text-sm text-muted-foreground">Nenhum domínio configurado</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Configure um domínio personalizado para acessar a plataforma
                        </p>
                      </div>
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
                        Após configurar, será necessário ajustar as configurações de DNS. Entre em contato com o suporte.
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
          </TabsContent>

          {/* Tab: Plano (Plan & Billing) */}
          <TabsContent value="plano" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <CardTitle>Plano e Cobrança</CardTitle>
                </div>
                <CardDescription>
                  Informações sobre seu plano e limites de uso
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl border border-primary/20 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-muted-foreground">Plano Atual</p>
                      {getStatusBadge(organization.status)}
                    </div>
                    <p className="text-3xl font-bold text-foreground">
                      {organization.status === 'trial' ? 'Avaliação' : 'Enterprise'}
                    </p>
                    {organization.trial_ends_at && organization.status === 'trial' && (
                      <div className="pt-2 border-t border-primary/20">
                        <p className="text-xs text-muted-foreground">Válido até</p>
                        <p className="text-sm font-medium text-foreground">{formatDate(organization.trial_ends_at)}</p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Usuários</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {organization.max_users ? `Limite: ${organization.max_users}` : 'Ilimitado'}
                        </Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-muted/30 rounded-lg border">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">Oportunidades</span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {organization.max_opportunities ? `Limite: ${organization.max_opportunities}` : 'Ilimitado'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button variant="outline" className="w-full" size="lg" disabled>
                    <CreditCard className="h-4 w-4 mr-2" />
                    Gerenciar Plano e Pagamento
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    Entre em contato com o suporte para alterar seu plano
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
