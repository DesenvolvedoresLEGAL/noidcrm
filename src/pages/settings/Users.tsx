import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';
import { usePermissions } from '@/hooks/usePermissions';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, Search, Shield, Mail, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface OrgMember {
  id: string;
  user_id: string;
  organization_id: string;
  org_role: 'owner' | 'admin' | 'manager' | 'sales' | 'viewer';
  status: string;
  joined_at: string;
  profile: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

const roleLabels = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendedor',
  viewer: 'Visualizador',
};

const roleColors = {
  owner: 'bg-purple-500',
  admin: 'bg-blue-500',
  manager: 'bg-green-500',
  sales: 'bg-yellow-500',
  viewer: 'bg-gray-500',
};

export default function UsersSettings() {
  const { organization, isOwner, isAdmin } = useCurrentOrganization();
  const { can } = usePermissions();
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const canManage = isOwner || isAdmin;

  useEffect(() => {
    if (!organization?.id) return;

    const fetchMembers = async () => {
      try {
        const { data, error } = await supabase
          .from('organization_members')
          .select('*')
          .eq('organization_id', organization.id)
          .eq('status', 'active')
          .order('joined_at', { ascending: false });

        if (error) throw error;

        // Fetch profiles separately
        if (data && data.length > 0) {
          const userIds = data.map(m => m.user_id);
          const { data: profiles } = await supabase
            .from('profiles')
            .select('user_id, full_name, avatar_url')
            .in('user_id', userIds);

          const membersWithProfiles = data.map(member => ({
            ...member,
            profile: profiles?.find(p => p.user_id === member.user_id) || {
              full_name: null,
              avatar_url: null,
            },
          }));

          setMembers(membersWithProfiles as OrgMember[]);
        } else {
          setMembers([]);
        }
      } catch (error) {
        console.error('Error fetching members:', error);
        toast.error('Erro ao carregar usuários');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [organization?.id]);

  const handleRoleChange = async (memberId: string, newRole: OrgMember['org_role']) => {
    if (!canManage) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ org_role: newRole })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.map(m => 
        m.id === memberId ? { ...m, org_role: newRole } : m
      ));
      toast.success('Função atualizada');
    } catch (error) {
      console.error('Error updating role:', error);
      toast.error('Erro ao atualizar função');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!canManage) return;

    try {
      const { error } = await supabase
        .from('organization_members')
        .update({ status: 'removed' })
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter(m => m.id !== memberId));
      toast.success('Usuário removido');
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Erro ao remover usuário');
    }
  };

  const filteredMembers = members.filter(member =>
    member.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Usuários</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie os membros da sua organização
            </p>
          </div>
          {canManage && (
            <Button>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Usuário
            </Button>
          )}
        </div>

        <Card className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Membros da Equipe</CardTitle>
                <CardDescription>
                  {members.length} usuário{members.length !== 1 ? 's' : ''} ativo{members.length !== 1 ? 's' : ''}
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar usuários..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <p className="text-center text-muted-foreground py-8">Carregando...</p>
              ) : filteredMembers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">Nenhum usuário encontrado</p>
              ) : (
                filteredMembers.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={member.profile?.avatar_url || undefined} />
                        <AvatarFallback>
                          {getInitials(member.profile?.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-foreground">
                          {member.profile?.full_name || 'Sem nome'}
                        </p>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {member.user_id}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge
                        variant="secondary"
                        className={`${roleColors[member.org_role]} text-white`}
                      >
                        <Shield className="h-3 w-3 mr-1" />
                        {roleLabels[member.org_role]}
                      </Badge>

                      {canManage && member.org_role !== 'owner' && (
                        <Select
                          value={member.org_role}
                          onValueChange={(value: OrgMember['org_role']) => handleRoleChange(member.id, value)}
                        >
                          <SelectTrigger className="w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Administrador</SelectItem>
                            <SelectItem value="manager">Gerente</SelectItem>
                            <SelectItem value="sales">Vendedor</SelectItem>
                            <SelectItem value="viewer">Visualizador</SelectItem>
                          </SelectContent>
                        </Select>
                      )}

                      {canManage && member.org_role !== 'owner' && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => handleRemoveMember(member.id)}
                            >
                              Remover usuário
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
