import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Trash2, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  listDealParticipants,
  addDealParticipant,
  removeDealParticipant,
  DealParticipant,
} from '@/services/crm/deal-participants';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface DealParticipantsManagerProps {
  opportunityId: string;
}

export function DealParticipantsManager({ opportunityId }: DealParticipantsManagerProps) {
  const { toast } = useToast();
  const { users } = useOrganizationUsers();
  const [participants, setParticipants] = useState<DealParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [addMode, setAddMode] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState<'collaborator' | 'observer'>('collaborator');
  const [sharePercentage, setSharePercentage] = useState('0');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [participantToDelete, setParticipantToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadParticipants();
  }, [opportunityId]);

  const loadParticipants = async () => {
    try {
      const data = await listDealParticipants(opportunityId);
      setParticipants(data);
    } catch (error) {
      toast({
        title: 'Erro ao carregar participantes',
        description: 'Tente novamente',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddParticipant = async () => {
    if (!selectedUserId) {
      toast({
        title: 'Selecione um usuário',
        variant: 'destructive',
      });
      return;
    }

    try {
      await addDealParticipant(
        opportunityId,
        selectedUserId,
        selectedRole,
        parseFloat(sharePercentage) || 0
      );
      toast({
        title: 'Participante adicionado',
        description: 'O usuário foi adicionado à oportunidade',
      });
      setAddMode(false);
      setSelectedUserId('');
      setSharePercentage('0');
      loadParticipants();
    } catch (error) {
      toast({
        title: 'Erro ao adicionar participante',
        description: error instanceof Error ? error.message : 'Tente novamente',
        variant: 'destructive',
      });
    }
  };

  const handleRemove = async () => {
    if (!participantToDelete) return;

    try {
      await removeDealParticipant(participantToDelete);
      toast({
        title: 'Participante removido',
      });
      setDeleteDialogOpen(false);
      setParticipantToDelete(null);
      loadParticipants();
    } catch (error) {
      toast({
        title: 'Erro ao remover participante',
        variant: 'destructive',
      });
    }
  };

  const availableUsers = users.filter(
    (u) => !participants.some((p) => p.user_id === u.id)
  );

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'owner':
        return 'default';
      case 'collaborator':
        return 'secondary';
      case 'observer':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle>Participantes da Oportunidade</CardTitle>
          </div>
          <Button onClick={() => setAddMode(!addMode)} size="sm" variant="outline">
            <Plus className="h-4 w-4 mr-2" />
            Adicionar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {addMode && (
          <div className="border rounded-lg p-4 space-y-4 bg-muted/20">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um usuário" />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Função</Label>
              <Select value={selectedRole} onValueChange={(v) => setSelectedRole(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                  <SelectItem value="observer">Observador</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>% Comissão (Split Deal)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={sharePercentage}
                onChange={(e) => setSharePercentage(e.target.value)}
                placeholder="0"
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={handleAddParticipant} size="sm">
                Confirmar
              </Button>
              <Button onClick={() => setAddMode(false)} size="sm" variant="outline">
                Cancelar
              </Button>
            </div>
          </div>
        )}

        {participants.length === 0 && !addMode && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum participante compartilhado
          </p>
        )}

        <div className="space-y-2">
          {participants.map((participant) => (
            <div
              key={participant.id}
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={participant.user?.avatar_url} />
                  <AvatarFallback>
                    {participant.user?.full_name?.substring(0, 2).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-sm">{participant.user?.full_name || participant.user?.email}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={getRoleBadgeVariant(participant.role)} className="text-xs">
                      {participant.role === 'collaborator' && 'Colaborador'}
                      {participant.role === 'observer' && 'Observador'}
                      {participant.role === 'owner' && 'Proprietário'}
                    </Badge>
                    {participant.share_percentage > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {participant.share_percentage}% comissão
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <Button
                onClick={() => {
                  setParticipantToDelete(participant.id);
                  setDeleteDialogOpen(true);
                }}
                size="sm"
                variant="ghost"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover participante?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação removerá o acesso deste usuário a esta oportunidade.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
