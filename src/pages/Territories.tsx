import { useState, useEffect } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Map, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  listTerritories,
  createTerritory,
  deleteTerritory,
  Territory,
} from '@/services/crm/territories';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function Territories() {
  const { toast } = useToast();
  const { isAdmin, isManager, isOwner, can, loading: permissionsLoading } = usePermissions();
  const [territories, setTerritories] = useState<Territory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    type: 'geographic' as const,
  });

  useEffect(() => {
    loadTerritories();
  }, []);

  const loadTerritories = async () => {
    try {
      const data = await listTerritories();
      setTerritories(data);
    } catch (error) {
      toast({
        title: 'Erro ao carregar territórios',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      await createTerritory(formData);
      toast({ title: 'Território criado' });
      setModalOpen(false);
      resetForm();
      loadTerritories();
    } catch (error) {
      toast({
        title: 'Erro ao criar território',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTerritory(id);
      toast({ title: 'Território desativado' });
      loadTerritories();
    } catch (error) {
      toast({
        title: 'Erro ao desativar território',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      type: 'geographic',
    });
  };

  const getTypeLabel = (type: string | null) => {
    const labels: Record<string, string> = {
      geographic: 'Geográfico',
      segment: 'Segmento',
      product: 'Produto',
      industry: 'Indústria',
    };
    return labels[type || 'geographic'] || 'Geográfico';
  };

  // Verificação unificada: owner, admin, manager ou permissão de teams
  const canAccess = isOwner || isAdmin || isManager || can('teams', 'view');

  if (permissionsLoading || loading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  if (!canAccess) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <p className="text-muted-foreground">Acesso restrito a administradores e gerentes.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">Territórios de Vendas</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">
              Gerencie territórios por geografia, segmento ou produto
            </p>
          </div>
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Território
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {territories.map((territory) => (
            <Card key={territory.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <Map className="h-5 w-5 text-primary" />
                    <CardTitle className="text-lg">{territory.name}</CardTitle>
                  </div>
                  <Badge variant="secondary">{getTypeLabel(territory.type)}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-2">
                  <Button
                    onClick={() => handleDelete(territory.id)}
                    size="sm"
                    variant="outline"
                    className="flex-1"
                  >
                    <Trash2 className="h-4 w-4 mr-2 text-destructive" />
                    Desativar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {territories.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Map className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Nenhum território criado ainda. Crie seu primeiro território para começar.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Create Modal */}
        <Dialog open={modalOpen} onOpenChange={setModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Território</DialogTitle>
              <DialogDescription>
                Crie um território de vendas para organizar sua equipe
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Território</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: São Paulo - Zona Sul"
                />
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.type}
                  onValueChange={(v) => setFormData({ ...formData, type: v as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geographic">Geográfico</SelectItem>
                    <SelectItem value="segment">Segmento</SelectItem>
                    <SelectItem value="product">Produto</SelectItem>
                    <SelectItem value="industry">Indústria</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setModalOpen(false)} variant="outline">
                Cancelar
              </Button>
              <Button onClick={handleSubmit}>
                Criar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
