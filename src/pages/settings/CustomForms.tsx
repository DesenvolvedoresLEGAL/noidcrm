import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import { Plus, Search, MoreHorizontal, Pencil, Copy, Trash2, FileCheck, ArrowLeft } from 'lucide-react';
import { useCustomForms, useCustomFormMutations } from '@/hooks/useCustomForms';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { CustomFormEditorModal } from '@/components/custom-forms/CustomFormEditorModal';
import { useNavigate } from 'react-router-dom';

export default function CustomForms() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingForm, setEditingForm] = useState<any>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [formToDelete, setFormToDelete] = useState<string | null>(null);

  const { data: forms = [], isLoading } = useCustomForms();
  const { pipelines = [] } = useOrganizationPipelines();
  const { deleteForm, duplicateForm, isDeleting } = useCustomFormMutations();

  const filteredForms = forms.filter(form =>
    form.name.toLowerCase().includes(search.toLowerCase())
  );

  const getPipelineNames = (pipelineIds: string[]) => {
    if (!pipelineIds || pipelineIds.length === 0) return 'Todos';
    return pipelineIds
      .map(id => pipelines.find(p => p.id === id)?.name || id)
      .join(', ');
  };

  const getEntityTypeLabel = (type: string) => {
    switch (type) {
      case 'opportunity': return 'Oportunidade';
      case 'account': return 'Empresa';
      case 'contact': return 'Contato';
      default: return type;
    }
  };

  const handleEdit = (form: any) => {
    setEditingForm(form);
    setEditorOpen(true);
  };

  const handleCreate = () => {
    setEditingForm(null);
    setEditorOpen(true);
  };

  const handleDuplicate = (id: string) => {
    duplicateForm.mutate(id);
  };

  const handleDeleteClick = (id: string) => {
    setFormToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (formToDelete) {
      deleteForm.mutate(formToDelete);
      setDeleteDialogOpen(false);
      setFormToDelete(null);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/app/settings')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Formulários Personalizados</h1>
              <p className="text-muted-foreground">
                Crie checklists e formulários para capturar informações específicas
              </p>
            </div>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Formulário
          </Button>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5" />
                  Formulários
                </CardTitle>
                <CardDescription>
                  {forms.length} formulário(s) cadastrado(s)
                </CardDescription>
              </div>
              <div className="relative w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar formulário..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredForms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileCheck className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium text-lg">Nenhum formulário encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Crie seu primeiro formulário para começar a capturar dados
                </p>
                <Button onClick={handleCreate}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Formulário
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Funis</TableHead>
                    <TableHead>Campos</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredForms.map((form) => (
                    <TableRow key={form.id}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{form.name}</span>
                          {form.description && (
                            <p className="text-sm text-muted-foreground truncate max-w-xs">
                              {form.description}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getEntityTypeLabel(form.entity_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground truncate max-w-xs block">
                          {getPipelineNames(form.pipeline_ids)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {form.fields.length} campo(s)
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={form.is_active ? 'default' : 'secondary'}>
                          {form.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEdit(form)}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDuplicate(form.id)}>
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem 
                              onClick={() => handleDeleteClick(form.id)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Editor Modal */}
      <CustomFormEditorModal
        open={editorOpen}
        onOpenChange={setEditorOpen}
        form={editingForm}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir formulário?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os dados preenchidos neste 
              formulário também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
