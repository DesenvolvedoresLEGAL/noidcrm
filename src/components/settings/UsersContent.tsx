import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Search, UserPlus, Edit, Lock, Unlock, Loader2, XCircle, Mail, RefreshCw, Copy, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { InviteUserModal } from '@/components/users/InviteUserModal';
import { BulkCreateUsersModal } from '@/components/users/BulkCreateUsersModal';
import { SeatsUsageCard } from '@/components/billing/SeatsUsageCard';
import { DeleteUserModal } from '@/components/users/DeleteUserModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface OrgMember {
  id: string;
  user_id: string;
  org_role: string;
  status: string;
  joined_at: string;
  profiles?: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
    last_login_at: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  org_role: string;
  status: string;
  created_at: string;
  expires_at: string;
  token: string;
  profiles?: { full_name: string | null };
}

interface AccessLog {
  id: string;
  user_id: string;
  action: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null };
}

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendedor',
  cs: 'Customer Success',
  viewer: 'Visualizador',
};

const roleColors: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  admin: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  manager: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  sales: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  cs: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
};

export default function UsersContent() {
  const navigate = useNavigate();
  const { organization, isOrgAdmin: isAdmin } = useCurrentUser();
  const [activeTab, setActiveTab] = useState('active');
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [bulkCreateModalOpen, setBulkCreateModalOpen] = useState(false);
  const [blockingUser, setBlockingUser] = useState<{ userId: string; currentStatus: string } | null>(null);
  const [deletingUser, setDeletingUser] = useState<{ userId: string; fullName: string | null; email: string | null } | null>(null);
  const [deletedMembers, setDeletedMembers] = useState<(OrgMember & { transferred_to?: string; deleted_at?: string; transferredToProfile?: { full_name: string | null; email: string | null } })[]>([]);

  useEffect(() => {
    fetchData();
  }, [organization, activeTab]);

  const fetchData = async () => {
    if (!organization) return;
    
    setLoading(true);
    try {
      if (activeTab === 'active' || activeTab === 'inactive' || activeTab === 'deleted') {
        const status = activeTab === 'active' ? 'active' : activeTab === 'inactive' ? 'suspended' : 'deleted';
        
        const { data, error } = await supabase
          .from('organization_members')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('status', status)
          .order('joined_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const userIds = data.map(m => m.user_id);
          
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url, email, last_login_at')
            .in('user_id', userIds);

          const membersWithProfiles = data.map(member => ({
            ...member,
            profiles: profiles?.find(p => p.user_id === member.user_id) || {
              full_name: null,
              avatar_url: null,
              email: null,
              last_login_at: null,
            },
          }));

          if (activeTab === 'deleted') {
            // Fetch transferred_to profiles
            const transferredToIds = data.filter(m => m.transferred_to).map(m => m.transferred_to);
            let transferProfiles: any[] = [];
            if (transferredToIds.length > 0) {
              const { data: tp } = await supabase
                .from('profiles')
                .select('user_id, full_name, email')
                .in('user_id', transferredToIds);
              transferProfiles = tp || [];
            }
            setDeletedMembers(membersWithProfiles.map((m: any) => ({
              ...m,
              transferredToProfile: transferProfiles.find(p => p.user_id === m.transferred_to) || null,
            })));
          } else {
            setMembers(membersWithProfiles as OrgMember[]);
          }
        } else {
          if (activeTab === 'deleted') {
            setDeletedMembers([]);
          } else {
            setMembers([]);
          }
        }
      } else if (activeTab === 'pending') {
        const { data, error } = await supabase
          .from('user_invitations')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (data && data.length > 0) {
          const inviterIds = data.map(i => i.invited_by);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name')
            .in('user_id', inviterIds);

          const invitationsWithProfiles = data.map(invitation => ({
            ...invitation,
            profiles: profiles?.find(p => p.user_id === invitation.invited_by) || {
              full_name: null,
            },
          }));

          setInvitations(invitationsWithProfiles as Invitation[]);
        } else {
          setInvitations([]);
        }
      } else if (activeTab === 'history') {
        const { data, error } = await supabase
          .from('user_access_logs')
          .select('*')
          .eq('organization_id', organization.id)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) throw error;

        if (data && data.length > 0) {
          const userIds = [...new Set(data.map(l => l.user_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, email')
            .in('user_id', userIds);

          const logsWithProfiles = data.map(log => ({
            ...log,
            profiles: profiles?.find(p => p.user_id === log.user_id) || {
              full_name: null,
              email: null,
            },
          }));

          setAccessLogs(logsWithProfiles as AccessLog[]);
        } else {
          setAccessLogs([]);
        }
      }
    } catch (error: any) {
      console.error('[Users] Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUnblock = async (userId: string, currentStatus: string) => {
    if (!isAdmin) {
      toast.error('Apenas administradores podem bloquear usuários');
      return;
    }

    try {
      const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
      const { error } = await supabase
        .from('organization_members')
        .update({ status: newStatus })
        .eq('user_id', userId)
        .eq('organization_id', organization?.id);

      if (error) throw error;

      toast.success(newStatus === 'active' ? 'Usuário desbloqueado' : 'Usuário bloqueado');
      fetchData();
      setBlockingUser(null);
    } catch (error: any) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    toast.info('Funcionalidade de reenvio em desenvolvimento');
  };

  const handleCancelInvite = async (inviteId: string) => {
    try {
      const { error } = await supabase
        .from('user_invitations')
        .update({ status: 'cancelled' })
        .eq('id', inviteId);

      if (error) throw error;

      toast.success('Convite cancelado');
      fetchData();
    } catch (error: any) {
      console.error('Error cancelling invite:', error);
      toast.error('Erro ao cancelar convite');
    }
  };

  const handleCopyInviteLink = (token: string) => {
    const url = `${window.location.origin}/accept-invitation/${token}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredMembers = members.filter(member => {
    if (!searchTerm || searchTerm.trim() === '') {
      const matchesRole = roleFilter === 'all' || member.org_role === roleFilter;
      return matchesRole;
    }
    
    const fullName = member.profiles?.full_name || '';
    const email = member.profiles?.email || '';
    
    const matchesSearch = 
      fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || member.org_role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const filteredInvitations = invitations.filter(inv =>
    inv.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredLogs = accessLogs.filter(log =>
    log.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        {isAdmin && (
          <div className="flex gap-2">
            <Button onClick={() => setInviteModalOpen(true)} variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />
              Convidar Usuário
            </Button>
            <Button onClick={() => setBulkCreateModalOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Adicionar Múltiplos
            </Button>
          </div>
        )}
      </div>

      <SeatsUsageCard />

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            {(activeTab === 'active' || activeTab === 'inactive') && (
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <SelectValue placeholder="Filtrar por função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as funções</SelectItem>
                  <SelectItem value="owner">Proprietário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="sales">Vendedor</SelectItem>
                  <SelectItem value="cs">Customer Success</SelectItem>
                  <SelectItem value="viewer">Visualizador</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="active">
                Ativos
                {members.length > 0 && activeTab === 'active' && (
                  <Badge variant="secondary" className="ml-2">{members.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="inactive">Inativos</TabsTrigger>
              <TabsTrigger value="deleted">Excluídos</TabsTrigger>
              <TabsTrigger value="pending">
                Aguardando
                {invitations.length > 0 && (
                  <Badge variant="secondary" className="ml-2">{invitations.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="mt-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  Nenhum usuário encontrado
                </div>
              ) : (
                <>
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Usuário</TableHead>
                          <TableHead>E-mail</TableHead>
                          <TableHead>Permissão</TableHead>
                          <TableHead>Último Login</TableHead>
                          <TableHead>Ativado em</TableHead>
                          <TableHead className="text-right">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredMembers.map((member) => (
                          <TableRow key={member.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Avatar>
                                  <AvatarImage src={member.profiles?.avatar_url || undefined} />
                                  <AvatarFallback>
                                    {getInitials(member.profiles?.full_name || null)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium">
                                  {member.profiles?.full_name || 'Sem nome'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>{member.profiles?.email || 'N/A'}</TableCell>
                            <TableCell>
                              <Badge className={roleColors[member.org_role] || ''}>
                                {roleLabels[member.org_role] || member.org_role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {member.profiles?.last_login_at
                                ? format(new Date(member.profiles.last_login_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                                : 'Nunca'}
                            </TableCell>
                            <TableCell>
                              {format(new Date(member.joined_at), "dd/MM/yyyy", { locale: ptBR })}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => navigate(`/app/settings/users/${member.user_id}/edit`)}
                                  title="Editar"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                {isAdmin && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setBlockingUser({ userId: member.user_id, currentStatus: member.status })}
                                      title="Bloquear acesso"
                                    >
                                      <Lock className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setDeletingUser({ userId: member.user_id, fullName: member.profiles?.full_name || null, email: member.profiles?.email || null })}
                                      title="Excluir usuário"
                                      className="text-destructive hover:text-destructive"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="md:hidden space-y-3">
                    {filteredMembers.map((member) => (
                      <div 
                        key={member.id} 
                        className="border rounded-lg p-4 space-y-3 bg-card"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-10 w-10">
                              <AvatarImage src={member.profiles?.avatar_url || undefined} />
                              <AvatarFallback>
                                {getInitials(member.profiles?.full_name || null)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">
                                {member.profiles?.full_name || 'Sem nome'}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {member.profiles?.email || 'N/A'}
                              </p>
                            </div>
                          </div>
                          <Badge className={roleColors[member.org_role] || ''}>
                            {roleLabels[member.org_role] || member.org_role}
                          </Badge>
                        </div>
                        
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => navigate(`/app/settings/users/${member.user_id}/edit`)}
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Editar / Atribuir Função
                          </Button>
                          {isAdmin && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setBlockingUser({ userId: member.user_id, currentStatus: member.status })}
                              >
                                <Lock className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive border-destructive/30"
                                onClick={() => setDeletingUser({ userId: member.user_id, fullName: member.profiles?.full_name || null, email: member.profiles?.email || null })}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="inactive" className="mt-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredMembers.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  Nenhum usuário inativo
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Bloqueado em</TableHead>
                      {isAdmin && <TableHead className="text-right">Ações</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.profiles?.avatar_url || undefined} />
                              <AvatarFallback>
                                {getInitials(member.profiles?.full_name || null)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium opacity-50">
                              {member.profiles?.full_name || 'Sem nome'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="opacity-50">{member.profiles?.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="opacity-50">
                            {roleLabels[member.org_role] || member.org_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(member.joined_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setBlockingUser({ userId: member.user_id, currentStatus: member.status })}
                            >
                              <Unlock className="mr-2 h-4 w-4" />
                              Desbloquear
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>



            <TabsContent value="deleted" className="mt-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : deletedMembers.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  Nenhum usuário excluído
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Permissão</TableHead>
                      <TableHead>Excluído em</TableHead>
                      <TableHead>Registros transferidos para</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletedMembers.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={member.profiles?.avatar_url || undefined} />
                              <AvatarFallback>
                                {getInitials(member.profiles?.full_name || null)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium opacity-50">
                              {member.profiles?.full_name || 'Sem nome'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="opacity-50">{member.profiles?.email || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="opacity-50">
                            {roleLabels[member.org_role] || member.org_role}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {member.deleted_at
                            ? format(new Date(member.deleted_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {member.transferredToProfile ? (
                            <div className="flex items-center gap-2">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="text-xs">
                                  {getInitials(member.transferredToProfile.full_name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm">
                                {member.transferredToProfile.full_name || member.transferredToProfile.email || 'N/A'}
                              </span>
                            </div>
                          ) : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="pending" className="mt-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredInvitations.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  Nenhum convite pendente
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead>Convidado por</TableHead>
                      <TableHead>Data do convite</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            {invitation.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={roleColors[invitation.org_role] || ''}>
                            {roleLabels[invitation.org_role] || invitation.org_role}
                          </Badge>
                        </TableCell>
                        <TableCell>{invitation.profiles?.full_name || 'N/A'}</TableCell>
                        <TableCell>
                          {format(new Date(invitation.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {format(new Date(invitation.expires_at), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleCopyInviteLink(invitation.token)}
                              title="Copiar link"
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleResendInvite(invitation.id)}
                              title="Reenviar"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            {isAdmin && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancelInvite(invitation.id)}
                                title="Cancelar"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="history" className="mt-6">
              {loading ? (
                <div className="flex justify-center p-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : filteredLogs.length === 0 ? (
                <div className="text-center p-8 text-muted-foreground">
                  Nenhum registro de acesso
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>IP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{log.profiles?.full_name || 'Desconhecido'}</div>
                            <div className="text-sm text-muted-foreground">{log.profiles?.email}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{log.action}</Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(log.created_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{log.ip_address || 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <InviteUserModal
        open={inviteModalOpen}
        onOpenChange={setInviteModalOpen}
        onSuccess={fetchData}
      />
      
      <BulkCreateUsersModal
        open={bulkCreateModalOpen}
        onOpenChange={setBulkCreateModalOpen}
        onSuccess={fetchData}
      />

      <AlertDialog open={!!blockingUser} onOpenChange={() => setBlockingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {blockingUser?.currentStatus === 'active' ? 'Bloquear Acesso' : 'Desbloquear Acesso'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {blockingUser?.currentStatus === 'active' 
                ? 'Tem certeza que deseja bloquear o acesso deste usuário? Ele não poderá mais acessar a plataforma até ser desbloqueado.'
                : 'Tem certeza que deseja desbloquear o acesso deste usuário? Ele voltará a ter acesso à plataforma.'
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => blockingUser && handleBlockUnblock(blockingUser.userId, blockingUser.currentStatus)}
              className={blockingUser?.currentStatus === 'active' 
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
              }
            >
              {blockingUser?.currentStatus === 'active' ? 'Bloquear' : 'Desbloquear'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
