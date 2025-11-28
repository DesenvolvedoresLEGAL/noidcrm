import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Trash2, 
  Star, 
  Upload,
  GripVertical,
  FileText
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  listLayouts, 
  createLayout, 
  updateLayout, 
  deleteLayout,
  uploadLayoutPage,
  deleteLayoutPage,
  reorderPages,
  ProposalLayout
} from '@/services/crm/proposal-layouts';
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

export default function ProposalLayouts() {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<ProposalLayout | null>(null);
  const [uploadingFiles, setUploadingFiles] = useState<Record<string, boolean>>({});
  
  const queryClient = useQueryClient();

  const { data: layouts = [], isLoading } = useQuery({
    queryKey: ['proposal-layouts'],
    queryFn: listLayouts,
  });

  const createMutation = useMutation({
    mutationFn: createLayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      setCreateModalOpen(false);
      toast.success('Modelo criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao criar modelo');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => 
      updateLayout(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      toast.success('Modelo atualizado!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao atualizar modelo');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteLayout,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['proposal-layouts'] });
      setDeleteDialogOpen(false);
      setSelectedLayout(null);
      toast.success('Modelo excluído!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao excluir modelo');
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

  const handleSetDefault = (layoutId: string) => {
    updateMutation.mutate({ 
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
              Modelos de Proposta
            </h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie layouts visuais para suas propostas comerciais
            </p>
          </div>
          <Button onClick={() => setCreateModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Modelo
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">
            Carregando modelos...
          </div>
        ) : layouts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum modelo criado ainda
              </p>
              <Button onClick={() => setCreateModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Modelo
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
                        setDeleteDialogOpen(true);
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
                      onClick={() => handleSetDefault(layout.id)}
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
      </div>

      {/* Create Modal */}
      <CreateLayoutModal
        open={createModalOpen}
        onOpenChange={setCreateModalOpen}
        onSubmit={(data) => createMutation.mutate(data)}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Modelo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o modelo "{selectedLayout?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedLayout) {
                  deleteMutation.mutate(selectedLayout.id);
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
          <DialogTitle>Criar Novo Modelo</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Nome do Modelo *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Modelo Padrão"
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva o propósito deste modelo..."
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
          <Button onClick={handleSubmit}>Criar Modelo</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
