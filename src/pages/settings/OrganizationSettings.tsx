import { useState, useEffect, useRef } from 'react';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Loader2, Save, Building2, Palette, Upload, X, User } from 'lucide-react';

interface OrganizationMember {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const formatCNPJ = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 5) return `${numbers.slice(0, 2)}.${numbers.slice(2)}`;
  if (numbers.length <= 8) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5)}`;
  if (numbers.length <= 12) return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8)}`;
  return `${numbers.slice(0, 2)}.${numbers.slice(2, 5)}.${numbers.slice(5, 8)}/${numbers.slice(8, 12)}-${numbers.slice(12, 14)}`;
};

const formatPhone = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 2) return numbers;
  if (numbers.length <= 7) return `(${numbers.slice(0, 2)}) ${numbers.slice(2)}`;
  if (numbers.length <= 11) return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7)}`;
  return `(${numbers.slice(0, 2)}) ${numbers.slice(2, 7)}-${numbers.slice(7, 11)}`;
};

const formatCEP = (value: string): string => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 5) return numbers;
  return `${numbers.slice(0, 5)}-${numbers.slice(5, 8)}`;
};

export default function OrganizationSettings() {
  const { user } = useSupabaseAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [orgLoading, setOrgLoading] = useState(true);
  const [organization, setOrganization] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);

  const [formData, setFormData] = useState({
    name: '',
    legal_name: '',
    cnpj: '',
    state_registration: '',
    municipal_registration: '',
    responsible_user_id: '',
    email: '',
    phone: '',
    website: '',
    address_zip: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_city: '',
    address_state: '',
    logo_url: '',
    primary_color: '#3B82F6',
    industry: '',
    team_size: '',
  });

  // Load organization
  useEffect(() => {
    async function loadOrg() {
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
          setOrganization(org);
        }
      } catch (error) {
        console.error('Error loading organization:', error);
      } finally {
        setOrgLoading(false);
      }
    }
    loadOrg();
  }, [user?.id]);

  // Load organization data into form
  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        legal_name: organization.legal_name || '',
        cnpj: formatCNPJ(organization.cnpj || ''),
        state_registration: organization.state_registration || '',
        municipal_registration: organization.municipal_registration || '',
        responsible_user_id: organization.responsible_user_id || '',
        email: organization.email || '',
        phone: formatPhone(organization.phone || ''),
        website: organization.website || '',
        address_zip: formatCEP(organization.address_zip || ''),
        address_street: organization.address_street || '',
        address_number: organization.address_number || '',
        address_complement: organization.address_complement || '',
        address_city: organization.address_city || '',
        address_state: organization.address_state || '',
        logo_url: organization.logo_url || '',
        primary_color: organization.primary_color || '#3B82F6',
        industry: organization.industry || '',
        team_size: organization.team_size || '',
      });
    }
  }, [organization]);

  // Load organization members
  useEffect(() => {
    async function loadMembers() {
      if (!organization?.id) return;
      
      try {
        const { data: memberData, error } = await supabase
          .from('organization_members')
          .select('user_id')
          .eq('organization_id', organization.id)
          .eq('status', 'active');

        if (error) throw error;

        if (memberData && memberData.length > 0) {
          const userIds = memberData.map((m) => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email, avatar_url')
            .in('user_id', userIds);

          const membersWithProfiles = memberData.map((m) => {
            const profile = profiles?.find((p: any) => p.user_id === m.user_id);
            const label = profile?.full_name || profile?.email || `Usuário ${m.user_id.slice(0, 8)}`;
            return {
              user_id: m.user_id,
              full_name: label,
              avatar_url: profile?.avatar_url || null,
            };
          });
          setMembers(membersWithProfiles);
        }
      } catch (error) {
        console.error('Error loading members:', error);
      } finally {
        setLoadingMembers(false);
      }
    }

    loadMembers();
  }, [organization?.id]);

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'cnpj') {
      formattedValue = formatCNPJ(value);
    } else if (field === 'phone') {
      formattedValue = formatPhone(value);
    } else if (field === 'address_zip') {
      formattedValue = formatCEP(value);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const handleCEPBlur = async () => {
    const cepNumbers = formData.address_zip.replace(/\D/g, '');
    if (cepNumbers.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepNumbers}/json/`);
      const data = await response.json();
      
      if (!data.erro) {
        setFormData(prev => ({
          ...prev,
          address_street: data.logradouro || prev.address_street,
          address_city: data.localidade || prev.address_city,
          address_state: data.uf || prev.address_state,
        }));
      }
    } catch (error) {
      console.error('Error fetching CEP:', error);
    }
  };

  const handleLogoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !organization?.id) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Arquivo inválido',
        description: 'Por favor, selecione uma imagem.',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'Arquivo muito grande',
        description: 'O logo deve ter no máximo 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setIsUploadingLogo(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${organization.id}/logo.${fileExt}`;

      // Delete existing logo if exists
      if (formData.logo_url) {
        const oldPath = formData.logo_url.split('/').slice(-2).join('/');
        await supabase.storage.from('organization-logos').remove([oldPath]);
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from('organization-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL with cache buster to avoid browser cache
      const { data: { publicUrl } } = supabase.storage
        .from('organization-logos')
        .getPublicUrl(fileName);

      const urlWithCacheBuster = `${publicUrl}?t=${Date.now()}`;

      setFormData(prev => ({ ...prev, logo_url: urlWithCacheBuster }));

      // Persist immediately to database
      await supabase
        .from('organizations')
        .update({ logo_url: urlWithCacheBuster })
        .eq('id', organization.id);

      // Update local organization state to prevent useEffect from reverting
      if (organization) {
        organization.logo_url = urlWithCacheBuster;
      }

      toast({
        title: 'Logo atualizado',
        description: 'O logo foi enviado com sucesso.',
      });
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Erro ao enviar logo',
        description: 'Não foi possível enviar o logo. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    if (!formData.logo_url || !organization?.id) return;

    try {
      const path = formData.logo_url.split('/').slice(-2).join('/');
      await supabase.storage.from('organization-logos').remove([path]);
      setFormData(prev => ({ ...prev, logo_url: '' }));

      // Persist immediately to database
      await supabase
        .from('organizations')
        .update({ logo_url: '' })
        .eq('id', organization.id);
      
      toast({
        title: 'Logo removido',
        description: 'O logo foi removido com sucesso.',
      });
    } catch (error) {
      console.error('Error removing logo:', error);
    }
  };

  const handleSave = async () => {
    if (!organization?.id) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: formData.name,
          legal_name: formData.legal_name,
          cnpj: formData.cnpj.replace(/\D/g, ''),
          state_registration: formData.state_registration,
          municipal_registration: formData.municipal_registration,
          responsible_user_id: formData.responsible_user_id || null,
          email: formData.email,
          phone: formData.phone.replace(/\D/g, ''),
          website: formData.website,
          address_zip: formData.address_zip.replace(/\D/g, ''),
          address_street: formData.address_street,
          address_number: formData.address_number,
          address_complement: formData.address_complement,
          address_city: formData.address_city,
          address_state: formData.address_state,
          logo_url: formData.logo_url,
          primary_color: formData.primary_color,
          industry: formData.industry,
          team_size: formData.team_size,
        })
        .eq('id', organization.id);

      if (error) throw error;

      toast({
        title: 'Dados salvos',
        description: 'As informações da empresa foram atualizadas com sucesso.',
      });
    } catch (error) {
      console.error('Error saving organization:', error);
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar as alterações.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const estados = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
    'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
    'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
  ];

  const industries = [
    'Tecnologia',
    'Saúde',
    'Educação',
    'Varejo',
    'Serviços',
    'Indústria',
    'Financeiro',
    'Imobiliário',
    'Alimentação',
    'Logística',
    'Outro'
  ];

  const teamSizes = [
    '1-10',
    '11-50',
    '51-200',
    '201-500',
    '501-1000',
    '1000+'
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dados da Empresa</h1>
          <p className="text-muted-foreground">Gerencie as informações da sua organização</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Salvar Alterações
        </Button>
      </div>

      <Tabs defaultValue="geral" className="space-y-6">
        <TabsList>
          <TabsTrigger value="geral" className="gap-2">
            <Building2 className="h-4 w-4" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="personalizacao" className="gap-2">
            <Palette className="h-4 w-4" />
            Personalização
          </TabsTrigger>
        </TabsList>

        <TabsContent value="geral" className="space-y-6">
          {/* Identification */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Identificação da Empresa</CardTitle>
              <CardDescription>Dados cadastrais e fiscais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Fantasia *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Nome da empresa"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="legal_name">Razão Social</Label>
                  <Input
                    id="legal_name"
                    value={formData.legal_name}
                    onChange={(e) => handleInputChange('legal_name', e.target.value)}
                    placeholder="Razão social completa"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cnpj">CNPJ</Label>
                  <Input
                    id="cnpj"
                    value={formData.cnpj}
                    onChange={(e) => handleInputChange('cnpj', e.target.value)}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input
                    id="state_registration"
                    value={formData.state_registration}
                    onChange={(e) => handleInputChange('state_registration', e.target.value)}
                    placeholder="IE"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipal_registration">Inscrição Municipal</Label>
                  <Input
                    id="municipal_registration"
                    value={formData.municipal_registration}
                    onChange={(e) => handleInputChange('municipal_registration', e.target.value)}
                    placeholder="IM"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responsible */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Responsável pela Conta</CardTitle>
              <CardDescription>Usuário principal da organização</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="responsible">Responsável</Label>
                <Select
                  value={formData.responsible_user_id}
                  onValueChange={(value) => handleInputChange('responsible_user_id', value)}
                  disabled={loadingMembers}
                >
                  <SelectTrigger id="responsible">
                    <SelectValue placeholder="Selecione o responsável" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={member.avatar_url || undefined} />
                            <AvatarFallback>
                              <User className="h-3 w-3" />
                            </AvatarFallback>
                          </Avatar>
                          <span>{member.full_name || 'Sem nome'}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Contact */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contato</CardTitle>
              <CardDescription>Informações de contato da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Principal</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    placeholder="contato@empresa.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone Principal</Label>
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  value={formData.website}
                  onChange={(e) => handleInputChange('website', e.target.value)}
                  placeholder="https://www.empresa.com"
                />
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Endereço</CardTitle>
              <CardDescription>Localização da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_zip">CEP</Label>
                  <Input
                    id="address_zip"
                    value={formData.address_zip}
                    onChange={(e) => handleInputChange('address_zip', e.target.value)}
                    onBlur={handleCEPBlur}
                    placeholder="00000-000"
                    maxLength={9}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address_street">Logradouro</Label>
                  <Input
                    id="address_street"
                    value={formData.address_street}
                    onChange={(e) => handleInputChange('address_street', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_number">Número</Label>
                  <Input
                    id="address_number"
                    value={formData.address_number}
                    onChange={(e) => handleInputChange('address_number', e.target.value)}
                    placeholder="123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="address_complement">Complemento</Label>
                  <Input
                    id="address_complement"
                    value={formData.address_complement}
                    onChange={(e) => handleInputChange('address_complement', e.target.value)}
                    placeholder="Sala, Andar, etc."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address_city">Cidade</Label>
                  <Input
                    id="address_city"
                    value={formData.address_city}
                    onChange={(e) => handleInputChange('address_city', e.target.value)}
                    placeholder="Cidade"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address_state">Estado</Label>
                <Select
                  value={formData.address_state}
                  onValueChange={(value) => handleInputChange('address_state', value)}
                >
                  <SelectTrigger id="address_state">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {estados.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="personalizacao" className="space-y-6">
          {/* Logo */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Logo da Empresa</CardTitle>
              <CardDescription>
                Usado em propostas, relatórios e documentos exportados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-start gap-6">
                <div className="relative">
                  {formData.logo_url ? (
                    <div className="relative group">
                      <img
                        src={formData.logo_url}
                        alt="Logo da empresa"
                        className="h-32 w-32 object-contain rounded-lg border bg-background"
                      />
                      <button
                        onClick={handleRemoveLogo}
                        className="absolute -top-2 -right-2 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-32 w-32 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center bg-muted/50">
                      <Building2 className="h-12 w-12 text-muted-foreground/50" />
                    </div>
                  )}
                </div>

                <div className="flex-1 space-y-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploadingLogo}
                  >
                    {isUploadingLogo ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    {formData.logo_url ? 'Alterar Logo' : 'Enviar Logo'}
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Formatos aceitos: JPG, PNG, SVG. Tamanho máximo: 2MB.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Brand Color */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Cor da Marca</CardTitle>
              <CardDescription>
                Usada em cabeçalhos de documentos e relatórios exportados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <input
                  type="color"
                  value={formData.primary_color}
                  onChange={(e) => handleInputChange('primary_color', e.target.value)}
                  className="w-16 h-10 rounded cursor-pointer border-0"
                />
                <Input
                  value={formData.primary_color}
                  onChange={(e) => handleInputChange('primary_color', e.target.value)}
                  placeholder="#3B82F6"
                  className="w-32 font-mono"
                  maxLength={7}
                />
                <div
                  className="h-10 flex-1 rounded-md border"
                  style={{ backgroundColor: formData.primary_color }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Company Profile */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Perfil da Empresa</CardTitle>
              <CardDescription>Informações adicionais sobre a organização</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="industry">Setor de Atuação</Label>
                  <Select
                    value={formData.industry}
                    onValueChange={(value) => handleInputChange('industry', value)}
                  >
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Selecione o setor" />
                    </SelectTrigger>
                    <SelectContent>
                      {industries.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="team_size">Tamanho da Equipe</Label>
                  <Select
                    value={formData.team_size}
                    onValueChange={(value) => handleInputChange('team_size', value)}
                  >
                    <SelectTrigger id="team_size">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamSizes.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size} colaboradores
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
