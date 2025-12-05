import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTeams, Team } from '@/hooks/useTeams';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { usePermissions } from '@/hooks/usePermissions';
import { CreateTeamModal } from '@/components/teams/CreateTeamModal';
import { TeamMembersManager } from '@/components/teams/TeamMembersManager';
import { 
  Plus, Users, Target, Edit, Trash2, ChevronRight, 
  Loader2, UserCircle, MoreHorizontal 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

function TeamMemberCount({ teamId }: { teamId: string }) {
  const { members, loading } = useTeamMembers(teamId);
  
  if (loading) return <Badge variant="secondary"><Loader2 className="h-3 w-3 animate-spin" /></Badge>;
  
  return (
    <Badge variant="secondary">
      {members.length} membro{members.length !== 1 ? 's' : ''}
    </Badge>
  );
}

export default function TeamsSettings() {
  const { teams, loading, createTeam, updateTeam, deleteTeam } = useTeams();
  const { isAdmin, isOwner } = usePermissions();
  const canManage = isAdmin || isOwner;

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [deletingTeam, setDeletingTeam] = useState<Team | null>(null);
  const [managingTeam, setManagingTeam] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (team: Partial<Team>) => {
    const result = await createTeam(team);
    if (!result.error) {
      toast.success('Equipe criada com sucesso');
    } else {
      toast.error('Erro ao criar equipe');
    }
    return result;
  };

  const handleUpdate = async (team: Partial<Team>) => {
    if (!editingTeam) return { error: new Error('No team') };
    
    const result = await updateTeam(editingTeam.id, team);
    if (!result.error) {
      toast.success('Equipe atualizada com sucesso');
      setEditingTeam(null);
    } else {
      toast.error('Erro ao atualizar equipe');
    }
    return result;
  };

  const handleDelete = async () => {
    if (!deletingTeam) return;
    
    setDeleting(true);
    const result = await deleteTeam(deletingTeam.id);
    setDeleting(false);
    
    if (!result.error) {
      toast.success('Equipe excluída com sucesso');
      setDeletingTeam(null);
    } else {
      toast.error('Erro ao excluir equipe');
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Equipes</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Organize sua estrutura de vendas em equipes
            </p>
          </div>
          {canManage && (
            <Button onClick={() => setCreateModalOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Equipe
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <Card>
            <CardContent className="py-8">
              <div className="flex items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Carregando equipes...</span>
              </div>
            </CardContent>
          </Card>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma equipe criada</h3>
              <p className="text-muted-foreground mb-4">
                Crie equipes para organizar seus vendedores e definir metas
              </p>
              {canManage && (
                <Button onClick={() => setCreateModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Equipe
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map((team, index) => (
              <Card
                key={team.id}
                className="hover:shadow-card-hover transition-all duration-300 animate-fade-in group"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: team.color }}
                        />
                        <CardTitle className="text-lg truncate">{team.name}</CardTitle>
                      </div>
                      {team.description && (
                        <CardDescription className="line-clamp-2">
                          {team.description}
                        </CardDescription>
                      )}
                    </div>
                    {canManage && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingTeam(team)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setManagingTeam(team)}>
                            <Users className="h-4 w-4 mr-2" />
                            Gerenciar Membros
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setDeletingTeam(team)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  {/* Gestor */}
                  <div className="flex items-center gap-2 text-sm">
                    <UserCircle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-muted-foreground">Gestor:</span>
                    <span className="font-medium truncate">
                      {team.manager?.full_name || 'Não definido'}
                    </span>
                  </div>

                  {/* Meta */}
                  {team.monthly_goal > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-muted-foreground">Meta:</span>
                      <span className="font-medium">
                        {new Intl.NumberFormat('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        }).format(team.monthly_goal)}
                      </span>
                    </div>
                  )}

                  {/* Membros */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <TeamMemberCount teamId={team.id} />
                    {canManage && (
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => setManagingTeam(team)}
                        className="text-xs"
                      >
                        Ver membros
                        <ChevronRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <CreateTeamModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      {editingTeam && (
        <CreateTeamModal
          open={!!editingTeam}
          onOpenChange={(open) => !open && setEditingTeam(null)}
          onSubmit={handleUpdate}
          editingTeam={editingTeam}
        />
      )}

      {/* Members Sheet */}
      <Sheet open={!!managingTeam} onOpenChange={(open) => !open && setManagingTeam(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {managingTeam && (
                <>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: managingTeam.color }}
                  />
                  {managingTeam.name}
                </>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {managingTeam && <TeamMembersManager team={managingTeam} />}
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingTeam} onOpenChange={(open) => !open && setDeletingTeam(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Equipe</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a equipe "{deletingTeam?.name}"? 
              Esta ação não pode ser desfeita e todos os membros serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
