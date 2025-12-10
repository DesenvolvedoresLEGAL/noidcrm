import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Building2, Loader2 } from 'lucide-react';
import { useIndustries, Industry } from '@/hooks/useIndustries';
import { useCurrentOrganization } from '@/hooks/useCurrentOrganization';

export function IndustriesSettings() {
  const { industries, isLoading, createIndustry, updateIndustry, deleteIndustry } = useIndustries();
  const { organization } = useCurrentOrganization();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingIndustry, setEditingIndustry] = useState<Industry | null>(null);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingIndustry) {
      await updateIndustry.mutateAsync({
        id: editingIndustry.id,
        name: formData.name,
        description: formData.description || undefined,
      });
    } else {
      await createIndustry.mutateAsync({
        name: formData.name,
        description: formData.description || undefined,
      });
    }
    
    setIsDialogOpen(false);
    setEditingIndustry(null);
    setFormData({ name: '', description: '' });
  };

  const handleEdit = (industry: Industry) => {
    setEditingIndustry(industry);
    setFormData({ name: industry.name, description: industry.description || '' });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja remover esta indústria?')) {
      await deleteIndustry.mutateAsync(id);
    }
  };

  const handleToggleActive = async (industry: Industry) => {
    await updateIndustry.mutateAsync({
      id: industry.id,
      is_active: !industry.is_active,
    });
  };

  const orgIndustries = industries.filter(i => i.organization_id === organization?.id);
  const systemIndustries = industries.filter(i => i.is_system_default);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Indústrias e Segmentos
          </CardTitle>
          <CardDescription>
            Configure as indústrias disponíveis para seleção no onboarding e cadastros
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditingIndustry(null); setFormData({ name: '', description: '' }); }}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Indústria
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingIndustry ? 'Editar Indústria' : 'Nova Indústria'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Agronegócio"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createIndustry.isPending || updateIndustry.isPending}>
                  {(createIndustry.isPending || updateIndustry.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingIndustry ? 'Salvar' : 'Criar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Org-specific industries */}
        {orgIndustries.length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-3">Indústrias Personalizadas</h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-24">Ativo</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orgIndustries.map((industry) => (
                  <TableRow key={industry.id}>
                    <TableCell className="font-medium">{industry.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {industry.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={industry.is_active}
                        onCheckedChange={() => handleToggleActive(industry)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(industry)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(industry.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* System defaults */}
        <div>
          <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
            Indústrias Padrão do Sistema
            <Badge variant="secondary" className="text-xs">
              {systemIndustries.length} disponíveis
            </Badge>
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {systemIndustries.map((industry) => (
              <div
                key={industry.id}
                className="flex items-center gap-2 p-2 rounded-lg border bg-muted/30"
              >
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{industry.name}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            As indústrias padrão são disponibilizadas automaticamente para todas as organizações.
            Você pode criar indústrias personalizadas que ficarão disponíveis apenas para sua organização.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
