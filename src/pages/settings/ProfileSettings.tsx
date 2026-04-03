import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Calendar, Mail, Settings, Loader2, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useSupabaseAuth } from '@/hooks/useSupabaseAuth';
import { SmtpSettings } from '@/components/settings/SmtpSettings';
import { GmailSyncSettings } from '@/components/settings/GmailSyncSettings';

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendedor',
  cs: 'Customer Success',
  finance: 'Financeiro/ADM',
  operations: 'Operacional',
  viewer: 'Visualizador',
};

const formatCPF = (value: string) => {
  const numbers = value.replace(/\D/g, '');
  if (numbers.length <= 11) {
    return numbers
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2');
  }
  return value;
};

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

export default function ProfileSettings() {
  const { user } = useSupabaseAuth();
  const { pipelines } = useOrganizationPipelines();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Profile data
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [defaultPipelineId, setDefaultPipelineId] = useState('');
  const [orgRole, setOrgRole] = useState('');
  const [teamName, setTeamName] = useState('');

  // Password
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) fetchProfileData();
  }, [user]);

  const fetchProfileData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      // Fetch profile, org membership, and team in parallel
      const [profileRes, memberRes, teamRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('full_name, avatar_url, email, phone, cpf, birth_date, default_pipeline_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabase
          .from('organization_members')
          .select('org_role')
          .eq('user_id', user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from('team_members')
          .select('team:teams(name)')
          .eq('user_id', user.id)
          .maybeSingle(),
      ]);

      if (profileRes.error) throw profileRes.error;

      const p = profileRes.data;
      if (p) {
        setFullName(p.full_name || '');
        setEmail(p.email || user.email || '');
        setAvatarUrl(p.avatar_url);
        setPhone(p.phone || '');
        setCpf(p.cpf || '');
        setBirthDate(p.birth_date || '');
        setDefaultPipelineId(p.default_pipeline_id || '');
      } else {
        setEmail(user.email || '');
      }

      if (memberRes.data) {
        setOrgRole(memberRes.data.org_role);
      }

      if (teamRes.data && (teamRes.data as any).team) {
        setTeamName((teamRes.data as any).team.name || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Erro ao carregar dados do perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveData = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone.replace(/\D/g, ''),
          cpf: cpf.replace(/\D/g, ''),
          birth_date: birthDate || null,
          default_pipeline_id: defaultPipelineId || null,
        })
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Dados atualizados com sucesso');
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Erro ao atualizar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('A senha deve ter no mínimo 6 caracteres');
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Senha alterada com sucesso');
      setNewPassword('');
    } catch (error: any) {
      console.error('Error changing password:', error);
      toast.error(error.message || 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <Card className="border-primary/20">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={avatarUrl || undefined} />
              <AvatarFallback className="text-2xl">
                {fullName?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{fullName || 'Meu Perfil'}</h1>
                <Badge variant="default">Ativo</Badge>
                {orgRole && <Badge variant="outline">{roleLabels[orgRole] || orgRole}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="agenda">Agenda</TabsTrigger>
          <TabsTrigger value="emails">E-mails</TabsTrigger>
          <TabsTrigger value="outras">Outras configurações</TabsTrigger>
        </TabsList>

        {/* Tab: Dados */}
        <TabsContent value="dados" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                <CardTitle>Informações Pessoais</CardTitle>
              </div>
              <CardDescription>
                Gerencie suas informações pessoais e de contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome completo *</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Digite seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    value={email}
                    disabled
                    className="bg-muted"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={formatPhone(phone)}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                    maxLength={15}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    value={formatCPF(cpf)}
                    onChange={(e) => setCpf(e.target.value)}
                    placeholder="000.000.000-00"
                    maxLength={14}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="birthDate">Data de Nascimento</Label>
                  <Input
                    id="birthDate"
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgRole">Função Organizacional</Label>
                  <div className="flex items-center h-10">
                    <Badge variant="outline" className="text-sm">
                      {roleLabels[orgRole] || orgRole || 'Não definida'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Equipe</Label>
                  <div className="flex items-center h-10">
                    <span className="text-sm text-muted-foreground">
                      {teamName || 'Nenhuma equipe'}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="defaultPipeline">Pipeline Padrão</Label>
                  <Select value={defaultPipelineId || 'none'} onValueChange={(value) => setDefaultPipelineId(value === 'none' ? '' : value)}>
                    <SelectTrigger id="defaultPipeline">
                      <SelectValue placeholder="Nenhum pipeline" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum pipeline</SelectItem>
                      {pipelines.map((pipeline) => (
                        <SelectItem key={pipeline.id} value={pipeline.id}>
                          {pipeline.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleSaveData} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    'Salvar Alterações'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Agenda */}
        <TabsContent value="agenda" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Configurações de Agenda</CardTitle>
              </div>
              <CardDescription>
                Integração de calendário e disponibilidade
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">Integração de calendário disponível em breve</p>
                <p className="text-sm">
                  Você poderá conectar Google Calendar, Outlook e configurar horários de disponibilidade
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: E-mails */}
        <TabsContent value="emails" className="space-y-4">
          {user && <SmtpSettings userId={user.id} />}
          {user && <GmailSyncSettings userId={user.id} />}
        </TabsContent>

        {/* Tab: Outras configurações */}
        <TabsContent value="outras" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <CardTitle>Alterar Senha</CardTitle>
              </div>
              <CardDescription>
                Defina uma nova senha para sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-full px-3"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Mínimo de 6 caracteres.
                  </p>
                </div>
              </div>
              <div className="flex justify-start">
                <Button
                  variant="outline"
                  onClick={handleChangePassword}
                  disabled={savingPassword || !newPassword}
                >
                  {savingPassword ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <KeyRound className="mr-2 h-4 w-4" />
                      Alterar Senha
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                <CardTitle>Outras Configurações</CardTitle>
              </div>
              <CardDescription>
                Notificações e preferências adicionais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12 text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="font-medium mb-2">Configurações adicionais disponíveis em breve</p>
                <p className="text-sm">
                  Notificações, relatórios automáticos e preferências de fuso horário
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
