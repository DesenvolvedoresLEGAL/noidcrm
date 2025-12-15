import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, User, Calendar, Mail, Settings, Loader2, Lock, Unlock, ChevronRight, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useTeams } from '@/hooks/useTeams';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface UserData {
  user_id: string;
  org_role: string;
  status: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
    phone: string | null;
    cpf: string | null;
    birth_date: string | null;
  };
  team_id?: string;
}

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

// Format CPF: XXX.XXX.XXX-XX
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

// Format Phone: (XX) XXXXX-XXXX
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

export default function EditUser() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { teams } = useTeams();
  const { organization, loading: orgLoading } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  
  // Password states
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Form states
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [cpf, setCpf] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [orgRole, setOrgRole] = useState('');
  const [teamId, setTeamId] = useState('');

  useEffect(() => {
    if (userId && !orgLoading && organization?.id) {
      fetchUserData();
    }
  }, [userId, orgLoading, organization?.id]);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      
      // Use current organization from hook
      if (!organization?.id) {
        console.warn('No organization available');
        setLoading(false);
        return;
      }
      console.log('EditUser fetch', { orgId: organization.id, userId });

      // Fetch member data
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('user_id, org_role, status, organization_id')
        .eq('user_id', userId)
        .eq('organization_id', organization.id)
        .maybeSingle();

      if (memberError) throw memberError;

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, email, phone, cpf, birth_date')
        .eq('user_id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Fetch team membership
      const { data: teamMember } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', userId)
        .maybeSingle();

      const user: UserData = {
        user_id: memberData.user_id,
        org_role: memberData.org_role,
        status: memberData.status,
        profile: profileData || {
          full_name: null,
          avatar_url: null,
          email: null,
          phone: null,
          cpf: null,
          birth_date: null,
        },
        team_id: teamMember?.team_id,
      };

      setUserData(user);
      setFullName(user.profile.full_name || '');
      setPhone(user.profile.phone || '');
      setCpf(user.profile.cpf || '');
      setBirthDate(user.profile.birth_date || '');
      setOrgRole(user.org_role);
      setTeamId(user.team_id || '');
    } catch (error) {
      console.error('Error fetching user:', error);
      toast.error('Erro ao carregar dados do usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveData = async () => {
    if (!userData) return;

    setSaving(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName,
          phone: phone.replace(/\D/g, ''),
          cpf: cpf.replace(/\D/g, ''),
          birth_date: birthDate || null,
        })
        .eq('user_id', userData.user_id);

      if (profileError) throw profileError;

      // Update organization role
      const { error: orgError } = await supabase
        .from('organization_members')
        .update({ org_role: orgRole } as any)
        .eq('user_id', userData.user_id)
        .eq('organization_id', organization.id);

      if (orgError) throw orgError;

      // Update team membership
      if (userData.team_id && teamId !== userData.team_id) {
        // Remove from old team
        await supabase
          .from('team_members')
          .delete()
          .eq('user_id', userData.user_id)
          .eq('team_id', userData.team_id);
      }

      if (teamId && teamId !== userData.team_id) {
        // Get organization_id
        const { data: orgId } = await supabase.rpc('get_user_organization_id');
        if (!orgId) throw new Error('Organization not found');

        // Add to new team
        await supabase
          .from('team_members')
          .insert({
            team_id: teamId,
            user_id: userData.user_id,
            organization_id: orgId,
          });
      } else if (!teamId && userData.team_id) {
        // Remove from team if "none" selected
        await supabase
          .from('team_members')
          .delete()
          .eq('user_id', userData.user_id);
      }

      toast.success('Dados atualizados com sucesso');
      fetchUserData();
    } catch (error) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar dados');
    } finally {
      setSaving(false);
    }
  };

  const handleBlockUnblock = async () => {
    if (!userData) return;

    const newStatus = userData.status === 'active' ? 'removed' : 'active';
    
    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ status: newStatus })
        .eq('user_id', userData.user_id)
        .eq('organization_id', organization.id);

      if (error) throw error;

      toast.success(
        newStatus === 'removed' 
          ? 'Usuário bloqueado com sucesso' 
          : 'Usuário desbloqueado com sucesso'
      );
      
      fetchUserData();
      setShowBlockDialog(false);
    } catch (error) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  if (loading || orgLoading) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!userData) {
    return (
      <Layout>
        <div className="p-8">
          <p className="text-muted-foreground">Usuário não encontrado</p>
        </div>
      </Layout>
    );
  }

  const isBlocked = userData.status === 'removed';

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/app/settings/users')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Usuários
          </Button>
          <ChevronRight className="h-4 w-4" />
          <span className="text-foreground font-medium">{userData.profile.full_name || 'Usuário'}</span>
        </div>

        {/* Header with user info */}
        <Card className="border-primary/20">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src={userData.profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl">
                  {userData.profile.full_name?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-bold">{userData.profile.full_name || 'Usuário sem nome'}</h1>
                  <Badge variant={isBlocked ? 'destructive' : 'default'}>
                    {isBlocked ? 'Bloqueado' : 'Ativo'}
                  </Badge>
                  <Badge variant="outline">{roleLabels[userData.org_role]}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{userData.profile.email}</p>
              </div>

              <Button
                variant={isBlocked ? 'outline' : 'destructive'}
                onClick={() => setShowBlockDialog(true)}
                className="gap-2"
              >
                {isBlocked ? (
                  <>
                    <Unlock className="h-4 w-4" />
                    Desbloquear
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    Bloquear
                  </>
                )}
              </Button>
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
                  Dados básicos e informações de contato do usuário
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
                      placeholder="Digite o nome completo"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail</Label>
                    <Input
                      id="email"
                      value={userData.profile.email || ''}
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
                    <Select value={orgRole} onValueChange={setOrgRole}>
                      <SelectTrigger id="orgRole">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="owner">Proprietário</SelectItem>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gerente</SelectItem>
                        <SelectItem value="sales">Vendedor</SelectItem>
                        <SelectItem value="cs">Customer Success</SelectItem>
                        <SelectItem value="finance">Financeiro/ADM</SelectItem>
                        <SelectItem value="operations">Operacional</SelectItem>
                        <SelectItem value="viewer">Visualizador</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="team">Equipe</Label>
                    <Select value={teamId || 'none'} onValueChange={(value) => setTeamId(value === 'none' ? '' : value)}>
                      <SelectTrigger id="team">
                        <SelectValue placeholder="Nenhuma equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma equipe</SelectItem>
                        {teams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
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
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle>Configurações de E-mail</CardTitle>
                </div>
                <CardDescription>
                  SMTP personalizado e assinatura de e-mail
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium mb-2">Configuração de SMTP personalizado disponível em breve</p>
                  <p className="text-sm">
                    Você poderá configurar servidor SMTP próprio e criar assinaturas personalizadas
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tab: Outras configurações */}
          <TabsContent value="outras" className="space-y-4">
            {/* Password Reset Card */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5 text-primary" />
                  <CardTitle>Redefinição de Senha</CardTitle>
                </div>
                <CardDescription>
                  Defina uma nova senha para o usuário
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
                      Mínimo de 6 caracteres. A senha será atualizada imediatamente.
                    </p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      if (!newPassword || newPassword.length < 6) {
                        toast.error('A senha deve ter no mínimo 6 caracteres');
                        return;
                      }
                      setSavingPassword(true);
                      try {
                        const { data, error } = await supabase.functions.invoke('admin-reset-password', {
                          body: { userId: userData?.user_id, newPassword },
                        });
                        if (error) throw error;
                        if (data?.error) throw new Error(data.error);
                        toast.success('Senha alterada com sucesso');
                        setNewPassword('');
                      } catch (error: any) {
                        console.error('Error resetting password:', error);
                        toast.error(error.message || 'Erro ao alterar senha');
                      } finally {
                        setSavingPassword(false);
                      }
                    }}
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
                        Redefinir Senha
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Other Settings Card */}
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

        {/* Block/Unblock Dialog */}
        <AlertDialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {isBlocked ? 'Desbloquear usuário?' : 'Bloquear usuário?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {isBlocked
                  ? 'O usuário terá seu acesso restaurado e poderá utilizar o sistema normalmente.'
                  : 'O usuário perderá acesso ao sistema e não poderá fazer login até ser desbloqueado.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleBlockUnblock}>
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
