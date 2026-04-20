import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useTeamMembers, TeamMemberWithProfile } from '@/hooks/useTeamMembers';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { Team } from '@/hooks/useTeams';
import { Plus, X, Users, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface TeamMembersManagerProps {
  team: Team;
}

export function TeamMembersManager({ team }: TeamMembersManagerProps) {
  const { members, loading, addMember, removeMember } = useTeamMembers(team.id);
  const { users, loading: loadingUsers } = useOrganizationUsers();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Filtrar usuários que ainda não são membros
  const availableUsers = users.filter(
    user => !members.some(m => m.user_id === user.id)
  );

  const handleAddMember = async () => {
    if (!selectedUserId) return;
    
    setAdding(true);
    const { error } = await addMember(selectedUserId);
    setAdding(false);
    
    if (error) {
      toast.error('Erro ao adicionar membro');
    } else {
      toast.success('Membro adicionado com sucesso');
      setSelectedUserId('');
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    setRemovingId(memberId);
    const { error } = await removeMember(memberId);
    setRemovingId(null);
    
    if (error) {
      toast.error('Erro ao remover membro');
    } else {
      toast.success(`${memberName} removido da equipe`);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            Membros da Equipe
          </CardTitle>
          <Badge variant="secondary">
            {members.length} membro{members.length !== 1 ? 's' : ''}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Adicionar membro */}
        <div className="flex gap-2">
          <Select
            value={selectedUserId}
            onValueChange={setSelectedUserId}
            disabled={loadingUsers || availableUsers.length === 0}
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder={
                loadingUsers 
                  ? "Carregando..." 
                  : availableUsers.length === 0 
                    ? "Todos os usuários já são membros"
                    : "Selecionar usuário"
              } />
            </SelectTrigger>
            <SelectContent>
              {availableUsers.map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-xs">
                        {user.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span>{user.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={handleAddMember} 
            disabled={!selectedUserId || adding}
            size="sm"
          >
            {adding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Lista de membros */}
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            Nenhum membro nesta equipe
          </div>
        ) : (
          <div className="space-y-2">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Avatar size="md">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback size="md">
                      {(member.profile?.full_name || 'U').charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">
                      {member.profile?.full_name || 'Sem nome'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Desde {member.created_at ? new Date(member.created_at).toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>
                </div>
                
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveMember(member.id, member.profile?.full_name || 'Membro')}
                  disabled={removingId === member.id}
                >
                  {removingId === member.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
