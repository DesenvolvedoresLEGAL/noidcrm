import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Tag as TagIcon, Search, Power, PowerOff } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';

import {
  useTagsManagement,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  type TagWithUsage,
} from '@/hooks/useTagsManagement';

const PRESET_COLORS = [
  '#F97316', '#8B5CF6', '#10B981', '#3B82F6',
  '#EF4444', '#F59E0B', '#EC4899', '#06B6D4',
  '#14B8A6', '#A855F7', '#6366F1', '#84CC16',
];

interface EditState {
  open: boolean;
  tag?: TagWithUsage | null;
  name: string;
  color: string;
}

const emptyEdit: EditState = { open: false, tag: null, name: '', color: PRESET_COLORS[3] };

export default function TagsManagement() {
  const { data: tags = [], isLoading } = useTagsManagement();
  const createMut = useCreateTag();
  const updateMut = useUpdateTag();
  const deleteMut = useDeleteTag();

  const [search, setSearch] = useState('');
  const [edit, setEdit] = useState<EditState>(emptyEdit);
  const [toDelete, setToDelete] = useState<TagWithUsage | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tags;
    return tags.filter((t) => t.name.toLowerCase().includes(q));
  }, [tags, search]);

  const stats = useMemo(() => {
    const total = tags.length;
    const inUse = tags.filter((t) => t.total_usage > 0).length;
    const accounts = tags.reduce((s, t) => s + t.account_count, 0);
    const opps = tags.reduce((s, t) => s + t.opportunity_count, 0);
    return { total, inUse, accounts, opps };
  }, [tags]);

  const openCreate = () => setEdit({ open: true, tag: null, name: '', color: PRESET_COLORS[3] });
  const openEdit = (tag: TagWithUsage) =>
    setEdit({ open: true, tag, name: tag.name, color: tag.color || PRESET_COLORS[3] });

  const handleSubmit = async () => {
    const name = edit.name.trim();
    if (!name) {
      toast.error('Informe um nome para a tag');
      return;
    }
    try {
      if (edit.tag) {
        await updateMut.mutateAsync({ id: edit.tag.id, name, color: edit.color });
        toast.success('Tag atualizada');
      } else {
        await createMut.mutateAsync({ name, color: edit.color });
        toast.success('Tag criada');
      }
      setEdit(emptyEdit);
    } catch (err: any) {
      const msg = err?.message || 'Erro ao salvar tag';
      if (msg.toLowerCase().includes('duplicate') || msg.includes('unique')) {
        toast.error('Já existe uma tag com esse nome');
      } else {
        toast.error(msg);
      }
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try {
      await deleteMut.mutateAsync(toDelete.id);
      toast.success('Tag excluída');
      setToDelete(null);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao excluir tag');
    }
  };

  const handleToggleActive = async (tag: TagWithUsage) => {
    try {
      await updateMut.mutateAsync({ id: tag.id, is_active: !tag.is_active });
      toast.success(tag.is_active ? 'Tag desativada' : 'Tag ativada');
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar tag');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TagIcon className="h-6 w-6 text-primary" />
            Tags
          </h1>
          <p className="text-muted-foreground">
            Gerencie as tags da organização. Use para classificar contas e oportunidades em relatórios cruzados.
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Nova tag
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total de tags" value={stats.total} />
        <StatCard label="Tags em uso" value={stats.inUse} />
        <StatCard label="Vínculos com contas" value={stats.accounts} />
        <StatCard label="Vínculos com oportunidades" value={stats.opps} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle>Lista de tags</CardTitle>
              <CardDescription>
                {filtered.length} de {tags.length} tags
              </CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar tags..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <TagIcon className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">
                {search ? 'Nenhuma tag encontrada para esse filtro' : 'Nenhuma tag cadastrada ainda'}
              </p>
              {!search && (
                <Button variant="link" onClick={openCreate} className="mt-2">
                  Criar a primeira tag
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tag</TableHead>
                    <TableHead className="w-32 text-center">Contas</TableHead>
                    <TableHead className="w-40 text-center">Oportunidades</TableHead>
                    <TableHead className="w-28 text-center">Ativa</TableHead>
                    <TableHead className="w-32 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((tag) => {
                    const inUse = tag.total_usage > 0;
                    const color = tag.color || PRESET_COLORS[3];
                    return (
                      <TableRow key={tag.id}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="gap-1.5 px-2 py-0.5"
                            style={{
                              backgroundColor: `${color}20`,
                              color,
                              borderColor: `${color}50`,
                            }}
                          >
                            <TagIcon className="h-3 w-3" />
                            {tag.name}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {tag.account_count > 0 ? (
                            <span className="font-medium">{tag.account_count}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {tag.opportunity_count > 0 ? (
                            <span className="font-medium">{tag.opportunity_count}</span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Switch
                            checked={!!tag.is_active}
                            onCheckedChange={() => handleToggleActive(tag)}
                            aria-label={tag.is_active ? 'Desativar tag' : 'Ativar tag'}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => openEdit(tag)}
                              aria-label="Editar"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => setToDelete(tag)}
                              disabled={inUse}
                              title={inUse ? 'Tag em uso — não pode ser excluída' : 'Excluir tag'}
                              aria-label="Excluir"
                              className="text-destructive hover:text-destructive disabled:text-muted-foreground"
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
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={edit.open} onOpenChange={(o) => !o && setEdit(emptyEdit)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{edit.tag ? 'Editar tag' : 'Nova tag'}</DialogTitle>
            <DialogDescription>
              Tags são compartilhadas entre contas e oportunidades da organização.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="tag-name">Nome</Label>
              <Input
                id="tag-name"
                placeholder="Ex.: Expositor, Parceiro Estratégico..."
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                maxLength={50}
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEdit({ ...edit, color: c })}
                    className={`h-9 w-full rounded-md border-2 transition-all ${
                      edit.color === c ? 'border-foreground scale-105' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Label htmlFor="tag-custom-color" className="text-xs text-muted-foreground">
                  Personalizada:
                </Label>
                <Input
                  id="tag-custom-color"
                  type="color"
                  value={edit.color}
                  onChange={(e) => setEdit({ ...edit, color: e.target.value })}
                  className="h-8 w-16 p-1 cursor-pointer"
                />
                <span className="text-xs text-muted-foreground font-mono">{edit.color}</span>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Pré-visualização</Label>
              <div>
                <Badge
                  variant="outline"
                  className="gap-1.5"
                  style={{
                    backgroundColor: `${edit.color}20`,
                    color: edit.color,
                    borderColor: `${edit.color}50`,
                  }}
                >
                  <TagIcon className="h-3 w-3" />
                  {edit.name.trim() || 'Nome da tag'}
                </Badge>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(emptyEdit)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMut.isPending || updateMut.isPending}
            >
              {edit.tag ? 'Salvar' : 'Criar tag'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tag?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tag{' '}
              <strong>{toDelete?.name}</strong> será removida da organização.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  );
}
