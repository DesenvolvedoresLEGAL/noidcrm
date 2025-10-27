import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock, Unlock, History } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTeams } from '@/hooks/useTeams';

interface EditUserModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: {
    id: string;
    user_id: string;
    org_role: string;
    status: string;
    profiles?: {
      full_name: string | null;
      avatar_url: string | null;
      email: string | null;
    };
  } | null;
  onSuccess: () => void;
}

const roleLabels: Record<string, string> = {
  owner: 'Proprietário',
  admin: 'Administrador',
  manager: 'Gerente',
  sales: 'Vendedor',
  viewer: 'Visualizador',
};

export function EditUserModal({ open, onOpenChange, user, onSuccess }: EditUserModalProps) {
  const { teams } = useTeams();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [orgRole, setOrgRole] = useState<'owner' | 'admin' | 'manager' | 'sales' | 'viewer'>('sales');
  const [teamId, setTeamId] = useState<string>('');
  const [currentTeamId, setCurrentTeamId] = useState<string>('');

  useEffect(() => {
    if (user) {
      setFullName(user.profiles?.full_name || '');
      setOrgRole(user.org_role as 'owner' | 'admin' | 'manager' | 'sales' | 'viewer');
      
      // Fetch current team membership
      const fetchTeamMembership = async () => {
        const { data } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.user_id)
          .maybeSingle();
        
        const teamValue = data?.team_id || '';
        setCurrentTeamId(teamValue);
        setTeamId(teamValue);
      };
      
      fetchTeamMembership();
    }
  }, [user]);

  const handleSave = async () => {
    if (!user) return;

    setLoading(true);
    try {
      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: fullName })
        .eq('user_id', user.user_id);

      if (profileError) throw profileError;

      // Update organization member
      const { error: memberError } = await supabase
        .from('organization_members')
        .update({ org_role: orgRole })
        .eq('id', user.id);

      if (memberError) throw memberError;

      // Update team membership
      if (currentTeamId !== teamId) {
        // Remove from current team
        if (currentTeamId) {
          await supabase
            .from('team_members')
            .delete()
            .eq('user_id', user.user_id)
            .eq('team_id', currentTeamId);
        }

        // Add to new team
        if (teamId) {
          await supabase
            .from('team_members')
            .insert({ user_id: user.user_id, team_id: teamId });
        }
      }

      toast.success('Usuário atualizado com sucesso');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast.error('Erro ao atualizar usuário');
    } finally {
      setLoading(false);
    }
  };

  const handleBlockUnblock = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const newStatus = user.status === 'active' ? 'removed' : 'active';
      const { error } = await supabase
        .from('organization_members')
        .update({ status: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      toast.success(newStatus === 'active' ? 'Usuário desbloqueado' : 'Usuário bloqueado');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating user status:', error);
      toast.error('Erro ao atualizar status do usuário');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações do usuário selecionado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* User Avatar and Basic Info */}
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.profiles?.avatar_url || undefined} />
              <AvatarFallback className="text-lg">
                {getInitials(user.profiles?.full_name || null)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="font-medium">{user.profiles?.full_name || 'Sem nome'}</div>
              <div className="text-sm text-muted-foreground">{user.profiles?.email}</div>
              <Badge variant={user.status === 'active' ? 'default' : 'secondary'} className="mt-1">
                {user.status === 'active' ? 'Ativo' : 'Bloqueado'}
              </Badge>
            </div>
          </div>

          {/* Edit Fields */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome Completo</Label>
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
                value={user.profiles?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="orgRole">Função na Organização</Label>
              <Select value={orgRole} onValueChange={(value) => setOrgRole(value as 'owner' | 'admin' | 'manager' | 'sales' | 'viewer')}>
                <SelectTrigger id="orgRole">
                  <SelectValue placeholder="Selecione uma função" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Proprietário</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="sales">Vendedor</SelectItem>
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
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleBlockUnblock}
            disabled={loading}
          >
            {user.status === 'active' ? (
              <>
                <Lock className="mr-2 h-4 w-4" />
                Bloquear
              </>
            ) : (
              <>
                <Unlock className="mr-2 h-4 w-4" />
                Desbloquear
              </>
            )}
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar Alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
