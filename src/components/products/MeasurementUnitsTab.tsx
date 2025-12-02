import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { MeasurementUnitModal } from './MeasurementUnitModal';
import {
  listMeasurementUnits,
  deleteMeasurementUnit,
  toggleMeasurementUnitStatus,
  type MeasurementUnit,
} from '@/services/crm/measurement-units';
import { useToast } from '@/hooks/use-toast';
import { Plus, Search, Pencil, Trash2, Power, Star } from 'lucide-react';

export function MeasurementUnitsTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<MeasurementUnit | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: units, isLoading } = useQuery({
    queryKey: ['measurement-units'],
    queryFn: listMeasurementUnits,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteMeasurementUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurement-units'] });
      toast({ title: 'Unidade excluída com sucesso' });
      setDeleteDialogOpen(false);
      setDeletingId(null);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir unidade',
        description: error.message,
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: toggleMeasurementUnitStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurement-units'] });
      toast({ title: 'Status atualizado com sucesso' });
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: error.message,
      });
    },
  });

  const filteredUnits = units?.filter((unit) =>
    unit.name.toLowerCase().includes(search.toLowerCase()) ||
    unit.abbreviation.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar unidades..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          onClick={() => {
            setEditingUnit(undefined);
            setModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4 mr-2" />
          Nova Unidade
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
      ) : filteredUnits && filteredUnits.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Abreviação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUnits.map((unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    {unit.name}
                    {unit.is_default && (
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <code className="px-2 py-1 bg-muted rounded text-sm">
                    {unit.abbreviation}
                  </code>
                </TableCell>
                <TableCell>
                  <Badge variant={unit.is_active ? 'default' : 'secondary'}>
                    {unit.is_active ? 'Ativa' : 'Inativa'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleMutation.mutate(unit.id)}
                      title={unit.is_active ? 'Desativar' : 'Ativar'}
                    >
                      <Power className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingUnit(unit);
                        setModalOpen(true);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeletingId(unit.id);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          Nenhuma unidade encontrada
        </div>
      )}

      <MeasurementUnitModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        unit={editingUnit}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta unidade de medida?
              Produtos que usam esta unidade não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
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
