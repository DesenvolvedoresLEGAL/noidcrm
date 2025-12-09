import { Layout } from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Shield, Pencil, Trash2, Loader2, LayoutDashboard } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface PermissionSet {
  id: string;
  name: string;
  description: string | null;
  permissions: Record<string, Record<string, boolean>>;
  default_dashboard: string;
  visible_menus: string[];
  organization_id: string;
}

const MODULES = [
  { key: 'deals', label: 'Oportunidades', description: 'Pipeline e negociações' },
  { key: 'contacts', label: 'Contatos', description: 'Pessoas e empresas' },
  { key: 'activities', label: 'Atividades', description: 'Tarefas e histórico' },
  { key: 'reports', label: 'Relatórios', description: 'Análises e métricas' },
  { key: 'settings', label: 'Configurações', description: 'Ajustes do sistema' },
  { key: 'automation', label: 'Automação', description: 'Workflows e cadências' },
  { key: 'teams', label: 'Equipes', description: 'Gestão de times' },
];

const ACTIONS = [
  { key: 'view', label: 'Visualizar' },
  { key: 'create', label: 'Criar' },
  { key: 'edit', label: 'Editar' },
  { key: 'delete', label: 'Excluir' },
  { key: 'viewAll', label: 'Ver Todos' },
];

const DASHBOARDS = [
  { value: 'OwnerDashboard', label: 'CEO Cockpit' },
  { value: 'AdminDashboard', label: 'Admin Dashboard' },
  { value: 'ManagerDashboard', label: 'Gerente' },
  { value: 'RepDashboard', label: 'Vendedor' },
  { value: 'FinanceDashboard', label: 'Financeiro' },
  { value: 'CSDashboard', label: 'Customer Success' },
  { value: 'SDRCommandCenter', label: 'SDR Command Center' },
  { value: 'AEDashboard', label: 'AE Dashboard' },
];

const MENU_SECTIONS = [
  { key: 'principal', label: 'Principal', description: 'Dashboard, Pipeline, Atividades, Roleplay' },
  { key: 'gestao', label: 'Gestão', description: 'Contas, Propostas, Contratos, Produtos' },
  { key: 'inteligencia', label: 'Inteligência', description: 'Forecast, Scoring, Relatórios, OTE, Insights, Win/Loss' },
  { key: 'gtm', label: 'GTM', description: 'SDR, AE, CS, RevOps, Manager, CEO dashboards' },
];

const DEFAULT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  deals: { view: true, create: false, edit: false, delete: false, viewAll: false },
  contacts: { view: true, create: false, edit: false, delete: false, viewAll: false },
  activities: { view: true, create: false, edit: false, delete: false, viewAll: false },
  reports: { view: true, create: false, edit: false, delete: false, viewAll: false },
  settings: { view: false, create: false, edit: false, delete: false, viewAll: false },
  automation: { view: false, create: false, edit: false, delete: false, viewAll: false },
  teams: { view: true, create: false, edit: false, delete: false, viewAll: false },
};

export default function PermissionSettings() {
  const navigate = useNavigate();
  const { organization } = useCurrentUser();
  
  const [loading, setLoading] = useState(true);
  const [permissionSets, setPermissionSets] = useState<PermissionSet[]>([]);
  const [editingSet, setEditingSet] = useState<PermissionSet | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [deleteSetId, setDeleteSetId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDashboard, setFormDashboard] = useState('RepDashboard');
  const [formMenus, setFormMenus] = useState<string[]>(['principal', 'gestao']);
  const [formPermissions, setFormPermissions] = useState<Record<string, Record<string, boolean>>>(DEFAULT_PERMISSIONS);

  useEffect(() => {
    if (organization?.id) {
      fetchPermissionSets();
    }
  }, [organization?.id]);

  const fetchPermissionSets = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('permission_sets')
        .select('*')
        .eq('organization_id', organization!.id)
        .order('name');

      if (error) throw error;

      setPermissionSets(data.map(ps => ({
        ...ps,
        permissions: ps.permissions as Record<string, Record<string, boolean>> || DEFAULT_PERMISSIONS,
        visible_menus: (ps.visible_menus as string[]) || ['principal', 'gestao'],
      })));
    } catch (error) {
      console.error('Error fetching permission sets:', error);
      toast.error('Erro ao carregar conjuntos de permissões');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (set?: PermissionSet) => {
    if (set) {
      setEditingSet(set);
      setFormName(set.name);
      setFormDescription(set.description || '');
      setFormDashboard(set.default_dashboard);
      setFormMenus(set.visible_menus);
      setFormPermissions(set.permissions);
    } else {
      setEditingSet(null);
      setFormName('');
      setFormDescription('');
      setFormDashboard('RepDashboard');
      setFormMenus(['principal', 'gestao']);
      setFormPermissions(DEFAULT_PERMISSIONS);
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSet(null);
  };

  const handlePermissionChange = (module: string, action: string, value: boolean) => {
    setFormPermissions(prev => ({
      ...prev,
      [module]: {
        ...prev[module],
        [action]: value,
      },
    }));
  };

  const handleMenuToggle = (menuKey: string) => {
    setFormMenus(prev => 
      prev.includes(menuKey) 
        ? prev.filter(m => m !== menuKey)
        : [...prev, menuKey]
    );
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDescription || null,
        permissions: formPermissions,
        default_dashboard: formDashboard,
        visible_menus: formMenus,
        organization_id: organization!.id,
      };

      if (editingSet) {
        const { error } = await supabase
          .from('permission_sets')
          .update(payload)
          .eq('id', editingSet.id);

        if (error) throw error;
        toast.success('Conjunto atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('permission_sets')
          .insert(payload);

        if (error) throw error;
        toast.success('Conjunto criado com sucesso');
      }

      handleCloseDialog();
      fetchPermissionSets();
    } catch (error) {
      console.error('Error saving permission set:', error);
      toast.error('Erro ao salvar conjunto de permissões');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteSetId) return;

    try {
      const { error } = await supabase
        .from('permission_sets')
        .delete()
        .eq('id', deleteSetId);

      if (error) throw error;

      toast.success('Conjunto excluído com sucesso');
      setDeleteSetId(null);
      fetchPermissionSets();
    } catch (error) {
      console.error('Error deleting permission set:', error);
      toast.error('Erro ao excluir conjunto de permissões');
    }
  };

  const getDashboardLabel = (value: string) => {
    return DASHBOARDS.find(d => d.value === value)?.label || value;
  };

  if (loading) {
    return (
      <Layout>
        <div className="p-8 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/app/settings')}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Conjuntos de Permissões
              </h1>
              <p className="text-sm text-muted-foreground">
                Configure níveis de acesso, dashboards e menus para cada tipo de usuário
              </p>
            </div>
          </div>
          <Button onClick={() => handleOpenDialog()} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Conjunto
          </Button>
        </div>

        {/* Permission Sets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {permissionSets.map((set) => (
            <Card key={set.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{set.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {set.description || 'Sem descrição'}
                    </CardDescription>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenDialog(set)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteSetId(set.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Dashboard: </span>
                  <Badge variant="secondary">{getDashboardLabel(set.default_dashboard)}</Badge>
                </div>
                <div className="flex flex-wrap gap-1">
                  {set.visible_menus.map(menu => (
                    <Badge key={menu} variant="outline" className="text-xs capitalize">
                      {menu}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {permissionSets.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Shield className="h-12 w-12 mb-4 opacity-50" />
                <p className="font-medium mb-2">Nenhum conjunto de permissões</p>
                <p className="text-sm mb-4">Crie conjuntos para definir níveis de acesso</p>
                <Button onClick={() => handleOpenDialog()} variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Criar Primeiro Conjunto
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {editingSet ? 'Editar Conjunto de Permissões' : 'Novo Conjunto de Permissões'}
            </DialogTitle>
            <DialogDescription>
              Configure o nome, dashboard padrão, menus visíveis e permissões granulares
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="geral" className="flex-1 overflow-hidden flex flex-col">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="geral">Geral</TabsTrigger>
              <TabsTrigger value="menus">Menus & Dashboard</TabsTrigger>
              <TabsTrigger value="permissoes">Permissões</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 mt-4">
              <TabsContent value="geral" className="space-y-4 pr-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Vendedor, Gerente, Financeiro"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Descreva as responsabilidades deste conjunto"
                    rows={3}
                  />
                </div>
              </TabsContent>

              <TabsContent value="menus" className="space-y-6 pr-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-semibold">Dashboard Padrão</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Qual dashboard o usuário verá ao acessar o sistema
                    </p>
                    <Select value={formDashboard} onValueChange={setFormDashboard}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DASHBOARDS.map(dash => (
                          <SelectItem key={dash.value} value={dash.value}>
                            {dash.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-base font-semibold">Seções de Menu Visíveis</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Quais seções do menu lateral o usuário poderá ver
                    </p>
                    <div className="space-y-3">
                      {MENU_SECTIONS.map(section => (
                        <div key={section.key} className="flex items-start space-x-3 p-3 rounded-lg border">
                          <Checkbox
                            id={`menu-${section.key}`}
                            checked={formMenus.includes(section.key)}
                            onCheckedChange={() => handleMenuToggle(section.key)}
                          />
                          <div className="flex-1">
                            <label
                              htmlFor={`menu-${section.key}`}
                              className="font-medium cursor-pointer"
                            >
                              {section.label}
                            </label>
                            <p className="text-sm text-muted-foreground">
                              {section.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="permissoes" className="space-y-4 pr-4">
                <p className="text-sm text-muted-foreground">
                  Configure permissões granulares para cada módulo do sistema
                </p>

                <div className="space-y-4">
                  {MODULES.map(mod => (
                    <Card key={mod.key}>
                      <CardHeader className="py-3">
                        <CardTitle className="text-base">{mod.label}</CardTitle>
                        <CardDescription className="text-xs">{mod.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex flex-wrap gap-4">
                          {ACTIONS.map(action => (
                            <div key={action.key} className="flex items-center space-x-2">
                              <Switch
                                id={`${mod.key}-${action.key}`}
                                checked={formPermissions[mod.key]?.[action.key] || false}
                                onCheckedChange={(checked) => handlePermissionChange(mod.key, action.key, checked)}
                              />
                              <Label htmlFor={`${mod.key}-${action.key}`} className="text-sm">
                                {action.label}
                              </Label>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </ScrollArea>
          </Tabs>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteSetId} onOpenChange={() => setDeleteSetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conjunto de permissões?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Usuários com este conjunto precisarão ter um novo conjunto atribuído.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}
