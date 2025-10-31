import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';
import { useBusinessUnits } from '@/hooks/useBusinessUnits';
import { BusinessUnitModal } from '@/components/settings/BusinessUnitModal';
import { createBusinessUnit, updateBusinessUnit, deleteBusinessUnit, type BusinessUnit } from '@/services/crm/business-units';
import { useToast } from '@/hooks/use-toast';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

export default function BusinessUnits() {
  const { businessUnits, loading, refetch } = useBusinessUnits();
  const { toast } = useToast();
  const [showModal, setShowModal] = useState(false);
  const [editingBU, setEditingBU] = useState<BusinessUnit | null>(null);
  const [deletingBU, setDeletingBU] = useState<BusinessUnit | null>(null);

  const handleCreate = () => {
    setEditingBU(null);
    setShowModal(true);
  };

  const handleEdit = (bu: BusinessUnit) => {
    setEditingBU(bu);
    setShowModal(true);
  };

  const handleSave = async (data: { code: string; name: string; color: string }) => {
    try {
      if (editingBU) {
        await updateBusinessUnit(editingBU.id, data);
        toast({
          title: 'Unidade de negócio atualizada',
          description: 'As alterações foram salvas com sucesso.',
        });
      } else {
        await createBusinessUnit(data);
        toast({
          title: 'Unidade de negócio criada',
          description: 'A nova unidade foi adicionada com sucesso.',
        });
      }
      refetch();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar a unidade de negócio.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async () => {
    if (!deletingBU) return;
    
    try {
      await deleteBusinessUnit(deletingBU.id);
      toast({
        title: 'Unidade de negócio desativada',
        description: 'A unidade foi desativada com sucesso.',
      });
      refetch();
      setDeletingBU(null);
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível desativar a unidade de negócio.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Unidades de Negócio</h1>
            <p className="text-muted-foreground mt-2">
              Configure as unidades de negócio que serão associadas aos funis
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Unidade
          </Button>
        </div>

        {businessUnits.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhuma unidade cadastrada</h3>
              <p className="text-muted-foreground text-center mb-4">
                Crie sua primeira unidade de negócio para começar a organizar seus funis
              </p>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeira Unidade
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {businessUnits.map((bu) => (
              <Card key={bu.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: bu.color }}
                      />
                      <div>
                        <CardTitle className="text-lg">{bu.name}</CardTitle>
                        <CardDescription>
                          <Badge variant="outline" className="mt-1">
                            {bu.code}
                          </Badge>
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(bu)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeletingBU(bu)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      <BusinessUnitModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onSave={handleSave}
        businessUnit={editingBU}
      />

      <AlertDialog open={!!deletingBU} onOpenChange={() => setDeletingBU(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar unidade de negócio?</AlertDialogTitle>
            <AlertDialogDescription>
              A unidade "{deletingBU?.name}" será desativada e não aparecerá mais nas opções. 
              Funis existentes não serão afetados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Desativar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
