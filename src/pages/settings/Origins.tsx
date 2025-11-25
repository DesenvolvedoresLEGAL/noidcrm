import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Search, Edit, Trash2, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';
import {
  listOrigins,
  createOrigin,
  updateOrigin,
  deleteOrigin,
  toggleOriginStatus,
  listOriginGroups,
  createOriginGroup,
  updateOriginGroup,
  deleteOriginGroup,
  toggleGroupStatus,
  type Origin,
  type OriginGroup,
  type OriginWithGroup,
} from '@/services/crm/origins';
import { OriginModal } from '@/components/settings/OriginModal';
import { OriginGroupModal } from '@/components/settings/OriginGroupModal';

export default function Origins() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [originModalOpen, setOriginModalOpen] = useState(false);
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [editingOrigin, setEditingOrigin] = useState<Origin | null>(null);
  const [editingGroup, setEditingGroup] = useState<OriginGroup | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteType, setDeleteType] = useState<'origin' | 'group'>('origin');

  const { data: origins = [], isLoading: loadingOrigins } = useQuery({
    queryKey: ['origins'],
    queryFn: listOrigins,
  });

  const { data: groups = [], isLoading: loadingGroups } = useQuery({
    queryKey: ['origin-groups'],
    queryFn: listOriginGroups,
  });

  const createOriginMutation = useMutation({
    mutationFn: createOrigin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origins'] });
      toast.success('Origem criada com sucesso!');
    },
    onError: () => toast.error('Erro ao criar origem'),
  });

  const updateOriginMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateOrigin(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origins'] });
      toast.success('Origem atualizada com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar origem'),
  });

  const deleteOriginMutation = useMutation({
    mutationFn: deleteOrigin,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origins'] });
      toast.success('Origem excluída com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir origem'),
  });

  const toggleOriginMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => toggleOriginStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origins'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const createGroupMutation = useMutation({
    mutationFn: createOriginGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origin-groups'] });
      toast.success('Grupo criado com sucesso!');
    },
    onError: () => toast.error('Erro ao criar grupo'),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateOriginGroup(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origin-groups'] });
      toast.success('Grupo atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar grupo'),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: deleteOriginGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origin-groups'] });
      toast.success('Grupo excluído com sucesso!');
    },
    onError: () => toast.error('Erro ao excluir grupo'),
  });

  const toggleGroupMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => toggleGroupStatus(id, is_active),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['origin-groups'] });
      toast.success('Status atualizado com sucesso!');
    },
    onError: () => toast.error('Erro ao atualizar status'),
  });

  const filteredOrigins = origins.filter((origin) =>
    origin.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSaveOrigin = async (data: any) => {
    if (editingOrigin) {
      await updateOriginMutation.mutateAsync({ id: editingOrigin.id, data });
    } else {
      await createOriginMutation.mutateAsync(data);
    }
    setEditingOrigin(null);
  };

  const handleSaveGroup = async (data: any) => {
    if (editingGroup) {
      await updateGroupMutation.mutateAsync({ id: editingGroup.id, data });
    } else {
      await createGroupMutation.mutateAsync(data);
    }
    setEditingGroup(null);
  };

  const handleDelete = () => {
    if (deleteType === 'origin' && deleteId) {
      deleteOriginMutation.mutate(deleteId);
    } else if (deleteType === 'group' && deleteId) {
      deleteGroupMutation.mutate(deleteId);
    }
    setDeleteId(null);
  };

  const getOriginsForGroup = (groupId: string) => {
    return origins.filter((o) => o.group_id === groupId);
  };

  return (
    <Layout>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Origens e Grupos de Origens</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as origens dos seus leads e organize-as em grupos
          </p>
        </div>
      </div>

      <Tabs defaultValue="origins" className="space-y-4">
        <TabsList>
          <TabsTrigger value="origins">Origens</TabsTrigger>
          <TabsTrigger value="groups">Grupos de Origens</TabsTrigger>
        </TabsList>

        <TabsContent value="origins" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Origens</CardTitle>
                <Button
                  onClick={() => {
                    setEditingOrigin(null);
                    setOriginModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Origem
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar origens..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loadingOrigins ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredOrigins.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'Nenhuma origem encontrada' : 'Nenhuma origem cadastrada'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrigins.map((origin) => (
                      <TableRow key={origin.id}>
                        <TableCell className="font-medium">{origin.name}</TableCell>
                        <TableCell>
                          {origin.origin_groups?.name ? (
                            <Badge variant="outline">{origin.origin_groups.name}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Sem grupo</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {origin.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={origin.is_active ? 'default' : 'secondary'}>
                            {origin.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleOriginMutation.mutate({ id: origin.id, is_active: !origin.is_active })}
                              title={origin.is_active ? 'Desativar' : 'Ativar'}
                            >
                              {origin.is_active ? (
                                <PowerOff className="h-4 w-4" />
                              ) : (
                                <Power className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingOrigin(origin);
                                setOriginModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setDeleteType('origin');
                                setDeleteId(origin.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="groups" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Grupos de Origens</CardTitle>
                <Button
                  onClick={() => {
                    setEditingGroup(null);
                    setGroupModalOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Grupo
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar grupos..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {loadingGroups ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredGroups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {search ? 'Nenhum grupo encontrado' : 'Nenhum grupo cadastrado'}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Origens Vinculadas</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredGroups.map((group) => {
                      const groupOrigins = getOriginsForGroup(group.id);
                      return (
                        <TableRow key={group.id}>
                          <TableCell className="font-medium">{group.name}</TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1">
                              {groupOrigins.length > 0 ? (
                                groupOrigins.map((origin) => (
                                  <Badge key={origin.id} variant="secondary" className="text-xs">
                                    {origin.name}
                                  </Badge>
                                ))
                              ) : (
                                <span className="text-muted-foreground text-sm">Nenhuma origem</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {group.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={group.is_active ? 'default' : 'secondary'}>
                              {group.is_active ? 'Ativo' : 'Inativo'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => toggleGroupMutation.mutate({ id: group.id, is_active: !group.is_active })}
                                title={group.is_active ? 'Desativar' : 'Ativar'}
                              >
                                {group.is_active ? (
                                  <PowerOff className="h-4 w-4" />
                                ) : (
                                  <Power className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditingGroup(group);
                                  setGroupModalOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteType('group');
                                  setDeleteId(group.id);
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <OriginModal
        open={originModalOpen}
        onOpenChange={setOriginModalOpen}
        origin={editingOrigin}
        groups={groups}
        onSave={handleSaveOrigin}
      />

      <OriginGroupModal
        open={groupModalOpen}
        onOpenChange={setGroupModalOpen}
        group={editingGroup}
        onSave={handleSaveGroup}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este {deleteType === 'origin' ? 'origem' : 'grupo'}?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
