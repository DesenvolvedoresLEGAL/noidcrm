import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Plus, X, Users, Shield, Eye, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import {
  listProposalParticipants,
  addProposalParticipant,
  updateProposalParticipant,
  removeProposalParticipant,
  ProposalParticipant,
} from '@/services/crm/proposal-participants';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';

interface ProposalParticipantsManagerProps {
  proposalId: string;
  disabled?: boolean;
}

const roleConfig = {
  owner: { label: 'Dono', icon: Shield, color: 'bg-purple-500' },
  collaborator: { label: 'Colaborador', icon: Users, color: 'bg-blue-500' },
  reviewer: { label: 'Revisor', icon: Eye, color: 'bg-orange-500' },
  approver: { label: 'Aprovador', icon: CheckCircle, color: 'bg-green-500' },
};

export function ProposalParticipantsManager({ proposalId, disabled }: ProposalParticipantsManagerProps) {
  const queryClient = useQueryClient();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<ProposalParticipant['role']>('collaborator');
  const [canEdit, setCanEdit] = useState(false);

  const { users: orgUsers } = useOrganizationUsers();

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['proposal-participants', proposalId],
    queryFn: () => listProposalParticipants(proposalId),
    enabled: !!proposalId,
  });

  const availableUsers = orgUsers.filter(
    u => !participants.some(p => p.user_id === u.id)
  );

  const addMutation = useMutation({
    mutationFn: () => addProposalParticipant(proposalId, selectedUserId, selectedRole, canEdit),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-participants', proposalId] });
      setSelectedUserId('');
      setCanEdit(false);
      toast.success('Participante adicionado');
    },
    onError: () => toast.error('Erro ao adicionar participante'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<ProposalParticipant> }) =>
      updateProposalParticipant(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-participants', proposalId] });
      toast.success('Participante atualizado');
    },
    onError: () => toast.error('Erro ao atualizar participante'),
  });

  const removeMutation = useMutation({
    mutationFn: removeProposalParticipant,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-participants', proposalId] });
      toast.success('Participante removido');
    },
    onError: () => toast.error('Erro ao remover participante'),
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  if (!proposalId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Envolvidos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Salve a proposta para adicionar participantes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="h-4 w-4" />
          Envolvidos na Proposta
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Participants */}
        <div className="space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : participants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum participante adicionado.</p>
          ) : (
            participants.map(participant => {
              const role = roleConfig[participant.role];
              const RoleIcon = role.icon;
              return (
                <div
                  key={participant.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={participant.user?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {getInitials(participant.user?.full_name || 'U')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{participant.user?.full_name}</p>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs py-0">
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {role.label}
                        </Badge>
                        {participant.can_edit && (
                          <Badge variant="secondary" className="text-xs py-0">
                            Pode editar
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {!disabled && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => removeMutation.mutate(participant.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Add Participant Form */}
        {!disabled && availableUsers.length > 0 && (
          <div className="border-t pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecionar usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map(user => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(roleConfig).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch
                  id="can-edit"
                  checked={canEdit}
                  onCheckedChange={setCanEdit}
                />
                <Label htmlFor="can-edit" className="text-sm">
                  Permitir edição
                </Label>
              </div>

              <Button
                size="sm"
                onClick={() => addMutation.mutate()}
                disabled={!selectedUserId || addMutation.isPending}
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
