import React, { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Users, Target, Award, Video as VideoIcon, ChevronLeft } from 'lucide-react';
import { listICPs, createICP, updateICP, deleteICP, type ICP } from '@/services/roleplay/icps';
import { listArchetypes, createArchetype, updateArchetype, deleteArchetype, type Archetype } from '@/services/roleplay/archetypes';
import { listRubrics, createRubric, updateRubric, deleteRubric, type Rubric } from '@/services/roleplay/rubrics';
import { listVideos, createVideo, updateVideo, deleteVideo, type Video } from '@/services/roleplay/videos';
import { ICPModal } from '@/components/roleplay/admin/ICPModal';
import { ArchetypeModal } from '@/components/roleplay/admin/ArchetypeModal';
import { RubricModal } from '@/components/roleplay/admin/RubricModal';
import { VideoModal } from '@/components/roleplay/admin/VideoModal';
import type { ICPFormData, ArchetypeFormData, RubricFormData, VideoFormData } from '@/schemas/roleplay';

export default function RoleplayAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { organization } = useCurrentUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('icps');
  
  // Modal states
  const [icpModalOpen, setIcpModalOpen] = useState(false);
  const [archetypeModalOpen, setArchetypeModalOpen] = useState(false);
  const [rubricModalOpen, setRubricModalOpen] = useState(false);
  const [videoModalOpen, setVideoModalOpen] = useState(false);
  
  // Selected items for editing
  const [selectedICP, setSelectedICP] = useState<ICP | undefined>();
  const [selectedArchetype, setSelectedArchetype] = useState<Archetype | undefined>();
  const [selectedRubric, setSelectedRubric] = useState<Rubric | undefined>();
  const [selectedVideo, setSelectedVideo] = useState<Video | undefined>();
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: string; id: string; name: string } | null>(null);

  // Queries
  const { data: icps = [], isLoading: icpsLoading } = useQuery({
    queryKey: ['icps', organization?.id],
    queryFn: () => listICPs(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: archetypes = [], isLoading: archetypesLoading } = useQuery({
    queryKey: ['archetypes', organization?.id],
    queryFn: () => listArchetypes(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: rubrics = [], isLoading: rubricsLoading } = useQuery({
    queryKey: ['rubrics', organization?.id],
    queryFn: () => listRubrics(organization!.id),
    enabled: !!organization?.id,
  });

  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['videos', organization?.id],
    queryFn: () => listVideos(organization!.id),
    enabled: !!organization?.id,
  });

  // ICP Mutations
  const createICPMutation = useMutation({
    mutationFn: (data: ICPFormData) => createICP({ 
      name: data.name, 
      segment: data.segment,
      company_size: data.company_size,
      revenue_band: data.revenue_band,
      tech_maturity: data.tech_maturity,
      pain_points: data.pain_points,
      buying_triggers: data.buying_triggers || [],
      success_criteria: data.success_criteria || [],
      competing_alternatives: data.competing_alternatives || [],
      organization_id: organization!.id 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icps'] });
      toast({ title: 'ICP criado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao criar ICP', variant: 'destructive' }),
  });

  const updateICPMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ICPFormData> }) => updateICP(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icps'] });
      toast({ title: 'ICP atualizado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao atualizar ICP', variant: 'destructive' }),
  });

  const deleteICPMutation = useMutation({
    mutationFn: deleteICP,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['icps'] });
      toast({ title: 'ICP removido com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao remover ICP', variant: 'destructive' }),
  });

  // Archetype Mutations
  const createArchetypeMutation = useMutation({
    mutationFn: (data: ArchetypeFormData) => createArchetype({ 
      name: data.name,
      type: data.type,
      level: data.level,
      tone_style: data.tone_style,
      decision_role: data.decision_role,
      complexity_score: data.complexity_score,
      min_message_exchanges: data.min_message_exchanges,
      objection_set: data.objection_set,
      organization_id: organization!.id 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archetypes'] });
      toast({ title: 'Arquétipo criado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao criar arquétipo', variant: 'destructive' }),
  });

  const updateArchetypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ArchetypeFormData> }) => updateArchetype(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archetypes'] });
      toast({ title: 'Arquétipo atualizado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao atualizar arquétipo', variant: 'destructive' }),
  });

  const deleteArchetypeMutation = useMutation({
    mutationFn: deleteArchetype,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['archetypes'] });
      toast({ title: 'Arquétipo removido com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao remover arquétipo', variant: 'destructive' }),
  });

  // Rubric Mutations
  const createRubricMutation = useMutation({
    mutationFn: (data: RubricFormData) => createRubric({ 
      name: data.name,
      passing_score: data.passing_score,
      dimensions: data.dimensions as any,
      organization_id: organization!.id 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics'] });
      toast({ title: 'Rubrica criada com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao criar rubrica', variant: 'destructive' }),
  });

  const updateRubricMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RubricFormData> }) => updateRubric(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics'] });
      toast({ title: 'Rubrica atualizada com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao atualizar rubrica', variant: 'destructive' }),
  });

  const deleteRubricMutation = useMutation({
    mutationFn: deleteRubric,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rubrics'] });
      toast({ title: 'Rubrica removida com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao remover rubrica', variant: 'destructive' }),
  });

  // Video Mutations
  const createVideoMutation = useMutation({
    mutationFn: (data: VideoFormData) => createVideo({ 
      title: data.title,
      url: data.url,
      duration_sec: data.duration_sec,
      level: data.level,
      source: data.source,
      tags: data.tags || [],
      language: data.language,
      organization_id: organization!.id 
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast({ title: 'Vídeo criado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao criar vídeo', variant: 'destructive' }),
  });

  const updateVideoMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<VideoFormData> }) => updateVideo(id, data as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast({ title: 'Vídeo atualizado com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao atualizar vídeo', variant: 'destructive' }),
  });

  const deleteVideoMutation = useMutation({
    mutationFn: deleteVideo,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['videos'] });
      toast({ title: 'Vídeo removido com sucesso' });
    },
    onError: () => toast({ title: 'Erro ao remover vídeo', variant: 'destructive' }),
  });

  // Handlers
  const handleDelete = (type: string, id: string, name: string) => {
    setItemToDelete({ type, id, name });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    switch (itemToDelete.type) {
      case 'icp':
        await deleteICPMutation.mutateAsync(itemToDelete.id);
        break;
      case 'archetype':
        await deleteArchetypeMutation.mutateAsync(itemToDelete.id);
        break;
      case 'rubric':
        await deleteRubricMutation.mutateAsync(itemToDelete.id);
        break;
      case 'video':
        await deleteVideoMutation.mutateAsync(itemToDelete.id);
        break;
    }
    
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCreateNew = () => {
    switch (activeTab) {
      case 'icps':
        setSelectedICP(undefined);
        setIcpModalOpen(true);
        break;
      case 'archetypes':
        setSelectedArchetype(undefined);
        setArchetypeModalOpen(true);
        break;
      case 'rubrics':
        setSelectedRubric(undefined);
        setRubricModalOpen(true);
        break;
      case 'videos':
        setSelectedVideo(undefined);
        setVideoModalOpen(true);
        break;
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Administração Roleplay</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie ICPs, arquétipos, rubricas e vídeos de treinamento
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/app/roleplay')}>
              <ChevronLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
            <Button onClick={handleCreateNew}>
              <Plus className="mr-2 h-4 w-4" />
              Novo {activeTab === 'icps' ? 'ICP' : activeTab === 'archetypes' ? 'Arquétipo' : activeTab === 'rubrics' ? 'Rubrica' : 'Vídeo'}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="icps">
              <Target className="h-4 w-4 mr-2" />
              ICPs
            </TabsTrigger>
            <TabsTrigger value="archetypes">
              <Users className="h-4 w-4 mr-2" />
              Arquétipos
            </TabsTrigger>
            <TabsTrigger value="rubrics">
              <Award className="h-4 w-4 mr-2" />
              Rubricas
            </TabsTrigger>
            <TabsTrigger value="videos">
              <VideoIcon className="h-4 w-4 mr-2" />
              Vídeos
            </TabsTrigger>
          </TabsList>

          {/* ICPs Tab */}
          <TabsContent value="icps" className="space-y-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead>Tamanho</TableHead>
                    <TableHead>Pain Points</TableHead>
                    <TableHead>Gatilhos</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {icps.map((icp) => (
                    <TableRow key={icp.id}>
                      <TableCell className="font-medium">{icp.name}</TableCell>
                      <TableCell>{icp.segment}</TableCell>
                      <TableCell>{icp.company_size || '-'}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{icp.pain_points?.length || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{icp.buying_triggers?.length || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setSelectedICP(icp); setIcpModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete('icp', icp.id, icp.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {icps.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum ICP cadastrado
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Archetypes Tab */}
          <TabsContent value="archetypes" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {archetypes.map((archetype) => (
                <Card key={archetype.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">{archetype.name}</CardTitle>
                        <CardDescription>{archetype.type}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setSelectedArchetype(archetype); setArchetypeModalOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete('archetype', archetype.id, archetype.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nível:</span>
                      <Badge>{archetype.level}</Badge>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Complexidade:</span>
                      <span>{archetype.complexity_score}/5</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mensagens:</span>
                      <span>{archetype.min_message_exchanges}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Objeções:</span>
                      <Badge variant="secondary">{archetype.objection_set?.length || 0}</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            {archetypes.length === 0 && (
              <Card>
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum arquétipo cadastrado
                </div>
              </Card>
            )}
          </TabsContent>

          {/* Rubrics Tab */}
          <TabsContent value="rubrics" className="space-y-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Nota de Aprovação</TableHead>
                    <TableHead>Dimensões</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rubrics.map((rubric) => (
                    <TableRow key={rubric.id}>
                      <TableCell className="font-medium">{rubric.name}</TableCell>
                      <TableCell>{rubric.passing_score}/10</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{rubric.dimensions?.length || 0}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => { setSelectedRubric(rubric); setRubricModalOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDelete('rubric', rubric.id, rubric.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {rubrics.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  Nenhuma rubrica cadastrada
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Videos Tab */}
          <TabsContent value="videos" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {videos.map((video) => (
                <Card key={video.id}>
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{video.title}</CardTitle>
                        <CardDescription>{formatDuration(video.duration_sec)}</CardDescription>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => { setSelectedVideo(video); setVideoModalOpen(true); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete('video', video.id, video.title)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Nível:</span>
                      <Badge>{video.level}</Badge>
                    </div>
                    {video.source && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Fonte:</span>
                        <span>{video.source}</span>
                      </div>
                    )}
                    {video.tags && video.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {video.tags.slice(0, 3).map((tag, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
            {videos.length === 0 && (
              <Card>
                <div className="text-center py-12 text-muted-foreground">
                  Nenhum vídeo cadastrado
                </div>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <ICPModal
        open={icpModalOpen}
        onClose={() => setIcpModalOpen(false)}
        onSave={async (data) => {
          if (selectedICP) {
            await updateICPMutation.mutateAsync({ id: selectedICP.id, data });
          } else {
            await createICPMutation.mutateAsync(data);
          }
        }}
        icp={selectedICP}
      />

      <ArchetypeModal
        open={archetypeModalOpen}
        onClose={() => setArchetypeModalOpen(false)}
        onSave={async (data) => {
          if (selectedArchetype) {
            await updateArchetypeMutation.mutateAsync({ id: selectedArchetype.id, data });
          } else {
            await createArchetypeMutation.mutateAsync(data);
          }
        }}
        archetype={selectedArchetype}
      />

      <RubricModal
        open={rubricModalOpen}
        onClose={() => setRubricModalOpen(false)}
        onSave={async (data) => {
          if (selectedRubric) {
            await updateRubricMutation.mutateAsync({ id: selectedRubric.id, data });
          } else {
            await createRubricMutation.mutateAsync(data);
          }
        }}
        rubric={selectedRubric}
      />

      <VideoModal
        open={videoModalOpen}
        onClose={() => setVideoModalOpen(false)}
        onSave={async (data) => {
          if (selectedVideo) {
            await updateVideoMutation.mutateAsync({ id: selectedVideo.id, data });
          } else {
            await createVideoMutation.mutateAsync(data);
          }
        }}
        video={selectedVideo}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{itemToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
