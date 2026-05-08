import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Trash2, 
  Star, 
  Upload,
  GripVertical,
  FileText,
  Edit,
  LayoutTemplate,
  File
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  listLayouts, 
  createLayout, 
  updateLayout, 
  deleteLayout,
  uploadLayoutPage,
  deleteLayoutPage,
  ProposalLayout
} from '@/services/crm/proposal-layouts';
import { listTemplates, deleteTemplate, ProposalTemplate } from '@/services/crm/proposal-templates';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { templateBadges } from '@/lib/proposals/proposalTemplateRules';

export default function ProposalLayouts() {
  const navigate = useNavigate();
  const [createLayoutModalOpen, setCreateLayoutModalOpen] = useState(false);
  const [deleteLayoutDialogOpen, setDeleteLayoutDialogOpen] = useState(false);
  const [deleteTemplateDialogOpen, setDeleteTemplateDialogOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<ProposalLayout | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<ProposalTemplate | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  
  const queryClient = useQueryClient();

  const { data: layouts = [], isLoading: loadingLayouts } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
  });

  const { data: templates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['proposal-templates'],
    queryFn: listTemplates,
  });

  const createLayoutMutation = useMutation({
    mutationFn: createLayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      setCreateLayoutModalOpen(false);
      toast.success('Layout criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar layout');
    },
  });

  const updateLayoutMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      updateLayout(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      toast.success('Layout atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar layout');
    },
  });

  const deleteLayoutMutation = useMutation({
    mutationFn: deleteLayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      setDeleteLayoutDialogOpen(false);
      setSelectedLayout(null);
      toast.success('Layout excluído!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir layout');
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-templates'] });
      setDeleteTemplateDialogOpen(false);
      setSelectedTemplate(null);
      toast.success('Template excluído!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir template');
    },
  });

  const uploadPageMutation = useMutation({
    mutationFn: ({ layoutId, file, pageNumber }: { 
      layoutId: string; 
      file: File; 
      pageNumber: number;
    }) => uploadLayoutPage(layoutId, file, pageNumber),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      toast.success('Página adicionada!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao fazer upload');
    },
  });

  const deletePageMutation = useMutation({
    mutationFn: deleteLayoutPage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      toast.success('Página removida!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao remover página');
    },
  });

  const handleFileUpload = async (layoutId: string, files: FileList) => {
    setUploadingFiles(prev => ({ ...prev, [layoutId]: true }));
    
    try {
      const layout = layouts.find(l => l.id === layoutId);
      const nextPageNumber = (layout?.pages?.length || 0) + 1;
      
      for (let i = 0; i < files.length; i++) {
        await uploadPageMutation.mutateAsync({
          layoutId,
          file: files[i],
          pageNumber: nextPageNumber + i,
        });
      }
    } finally {
      setUploadingFiles(prev => ({ ...prev, [layoutId]: false }));
    }
  };

  const handleSetLayoutDefault = (layoutId: string) => {
    updateLayoutMutation.mutate({ 
      id: layoutId, 
      updates: { is_default: true } 
    });
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">
              Templates e Layouts
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie templates de conteúdo e layouts visuais para propostas
            </p>
          </div>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates" className="gap-2">
              <LayoutTemplate className="h-4 w-4" />
              Templates de Conteúdo
            </TabsTrigger>
            <TabsTrigger value="layouts" className="gap-2">
              <File className="h-4 w-4" />
              Layouts Visuais (PDF)
            </TabsTrigger>
          </TabsList>

          {/* Templates Tab */}
          <TabsContent value="templates" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => navigate('/app/settings/proposal-templates/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Template
              </Button>
            </div>

            {loadingTemplates ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando templates...
              </div>
            ) : templates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <LayoutTemplate className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhum template criado ainda
                  </p>
                  <Button onClick={() => navigate('/app/settings/proposal-templates/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Template
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {templates.map((template) => (
                  <Card key={template.id} className="relative hover:shadow-md transition-shadow">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {template.name}
                            {template.is_default && (
                              <Badge variant="default" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Padrão
                              </Badge>
                            )}
                          </CardTitle>
                          {template.description && (
                            <CardDescription className="mt-1">
                              {template.description}
                            </CardDescription>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/app/settings/proposal-templates/${template.id}/edit`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSelectedTemplate(template);
                              setDeleteTemplateDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Moeda:</span>
                          <span className="font-medium text-foreground">{template.currency || 'BRL'}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Validade:</span>
                          <span className="font-medium text-foreground">{template.validity_days || 15} dias</span>
                        </div>
                        {template.control_prefix && (
                          <div className="flex justify-between">
                            <span>Sigla:</span>
                            <span className="font-medium text-foreground">{template.control_prefix}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Itens padrão:</span>
                          <span className="font-medium text-foreground">
                            {(template.default_items as any[])?.length || 0}
                          </span>
                        </div>
                        {(() => {
                          const badges = templateBadges(template as any);
                          if (!badges.length) return null;
                          return (
                            <div className="flex flex-wrap gap-1 pt-2">
                              {badges.map((b) => (
                                <Badge key={b.label} variant={b.variant} className="text-[10px]">
                                  {b.label}
                                </Badge>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Layouts Tab */}
          <TabsContent value="layouts" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setCreateLayoutModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Layout
              </Button>
            </div>

            {loadingLayouts ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando layouts...
              </div>
            ) : layouts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">
                    Nenhum layout criado ainda
                  </p>
                  <Button onClick={() => setCreateLayoutModalOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Layout
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {layouts.map((layout) => (
                  <Card key={layout.id} className="relative">
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {layout.name}
                            {layout.is_default && (
                              <Badge variant="default" className="text-xs">
                                <Star className="h-3 w-3 mr-1" />
                                Padrão
                              </Badge>
                            )}
                          </CardTitle>
                          {layout.description && (
                            <p className="text-sm text-muted-foreground mt-1">
                              {layout.description}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedLayout(layout);
                            setDeleteLayoutDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Pages Preview */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label className="text-sm font-medium">
                            Páginas ({layout.pages?.length || 0})
                          </Label>
                          <label>
                            <Input
                              type="file"
                              accept="application/pdf"
                              multiple
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files) {
                                  handleFileUpload(layout.id, e.target.files);
                                }
                              }}
                              disabled={uploadingFiles[layout.id]}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              disabled={uploadingFiles[layout.id]}
                            >
                              <span className="cursor-pointer">
                                <Upload className="h-3 w-3 mr-1" />
                                Upload PDF
                              </span>
                            </Button>
                          </label>
                        </div>
                        
                        {layout.pages && layout.pages.length > 0 ? (
                          <div className="space-y-2 max-h-48 overflow-y-auto">
                            {layout.pages.map((page) => (
                              <div
                                key={page.id}
                                className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                              >
                                <GripVertical className="h-4 w-4 text-muted-foreground" />
                                <FileText className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm flex-1 truncate">
                                  {page.file_name}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => deletePageMutation.mutate(page.id)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Nenhuma página adicionada
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      {!layout.is_default && (
                        <Button
                          variant="outline"
                          className="w-full"
                          onClick={() => handleSetLayoutDefault(layout.id)}
                        >
                          <Star className="h-4 w-4 mr-2" />
                          Definir como Padrão
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Create Layout Modal */}
      <CreateLayoutModal
        open={createLayoutModalOpen}
        onOpenChange={setCreateLayoutModalOpen}
        onSubmit={(data) => createLayoutMutation.mutate(data)}
      />

      {/* Delete Layout Confirmation */}
      <AlertDialog open={deleteLayoutDialogOpen} onOpenChange={setDeleteLayoutDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Layout</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o layout "{selectedLayout?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedLayout) {
                  deleteLayoutMutation.mutate(selectedLayout.id);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={deleteTemplateDialogOpen} onOpenChange={setDeleteTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Template</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o template "{selectedTemplate?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedTemplate) {
                  deleteTemplateMutation.mutate(selectedTemplate.id);
                }
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

function CreateLayoutModal({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; description?: string; is_default?: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    onSubmit({
      name: name.trim(),
      description: description.trim() || undefined,
      is_default: isDefault,
    });

    // Reset form
    setName('');
    setDescription('');
    setIsDefault(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Novo Layout Visual</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Layout *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Layout Padrão"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito deste layout..."
              rows={3}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="is-default">Definir como padrão</Label>
            <Switch
              id="is-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit}>Criar Layout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
