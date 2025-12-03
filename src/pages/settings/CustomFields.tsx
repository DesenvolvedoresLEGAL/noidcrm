import { useState } from 'react';
import { Layout } from '@/components/Layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Plus, 
  Search, 
  Pencil, 
  Trash2, 
  GripVertical,
  Copy,
  ArrowLeft,
  Layers,
  Variable,
  FolderOpen,
  Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCustomFields, useCustomFieldGroups, useCustomFieldMutations, useCustomFieldGroupMutations } from '@/hooks/useCustomFields';
import { useDynamicVariables, useDynamicVariableMutations } from '@/hooks/useDynamicVariables';
import { ENTITY_LABELS, FIELD_TYPE_LABELS, type EntityType, type CustomField, type CustomFieldGroup } from '@/services/crm/custom-fields';
import { CustomFieldModal } from '@/components/settings/CustomFieldModal';
import { CustomFieldGroupModal } from '@/components/settings/CustomFieldGroupModal';
import { DynamicVariableModal } from '@/components/settings/DynamicVariableModal';
import { toast } from 'sonner';
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

export default function CustomFields() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('fields');
  const [selectedEntity, setSelectedEntity] = useState<EntityType | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Field Modal State
  const [fieldModalOpen, setFieldModalOpen] = useState(false);
  const [selectedField, setSelectedField] = useState<CustomField | null>(null);
  
  // Group Modal State
  const [groupModalOpen, setGroupModalOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<CustomFieldGroup | null>(null);
  
  // Variable Modal State
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [selectedVariable, setSelectedVariable] = useState<any>(null);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: 'field' | 'group' | 'variable'; id: string } | null>(null);

  // Data hooks
  const { data: fields = [], isLoading: fieldsLoading } = useCustomFields(
    selectedEntity === 'all' ? undefined : selectedEntity
  );
  const { data: groups = [], isLoading: groupsLoading } = useCustomFieldGroups(
    selectedEntity === 'all' ? undefined : selectedEntity
  );
  const { data: variables = [], isLoading: variablesLoading } = useDynamicVariables();
  
  // Mutation hooks
  const { deleteField, updateField } = useCustomFieldMutations();
  const { deleteGroup } = useCustomFieldGroupMutations();
  const { deleteVariable } = useDynamicVariableMutations();

  // Filter data
  const filteredFields = fields.filter((field) =>
    field.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    field.field_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGroups = groups.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredVariables = variables.filter((variable) =>
    variable.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    variable.variable_key.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handlers
  const handleEditField = (field: CustomField) => {
    setSelectedField(field);
    setFieldModalOpen(true);
  };

  const handleCreateField = () => {
    setSelectedField(null);
    setFieldModalOpen(true);
  };

  const handleEditGroup = (group: CustomFieldGroup) => {
    setSelectedGroup(group);
    setGroupModalOpen(true);
  };

  const handleCreateGroup = () => {
    setSelectedGroup(null);
    setGroupModalOpen(true);
  };

  const handleEditVariable = (variable: any) => {
    if (variable.is_system) {
      toast.error('Variáveis do sistema não podem ser editadas');
      return;
    }
    setSelectedVariable(variable);
    setVariableModalOpen(true);
  };

  const handleCreateVariable = () => {
    setSelectedVariable(null);
    setVariableModalOpen(true);
  };

  const handleCopyVariable = (variableKey: string) => {
    navigator.clipboard.writeText(`{{${variableKey}}}`);
    toast.success('Variável copiada!');
  };

  const handleDeleteConfirm = (type: 'field' | 'group' | 'variable', id: string) => {
    setItemToDelete({ type, id });
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      switch (itemToDelete.type) {
        case 'field':
          await deleteField(itemToDelete.id);
          break;
        case 'group':
          await deleteGroup(itemToDelete.id);
          break;
        case 'variable':
          await deleteVariable(itemToDelete.id);
          break;
      }
    } catch (error) {
      console.error('Delete error:', error);
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleToggleFieldActive = async (field: CustomField) => {
    try {
      await updateField({ id: field.id, updates: { is_active: !field.is_active } });
    } catch (error) {
      console.error('Toggle error:', error);
    }
  };

  return (
    <Layout>
      <div className="p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/app/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-foreground">
              Campos Personalizados
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure campos customizados e variáveis dinâmicas para o CRM
            </p>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <TabsList>
              <TabsTrigger value="fields" className="gap-2">
                <Layers className="h-4 w-4" />
                Campos
              </TabsTrigger>
              <TabsTrigger value="variables" className="gap-2">
                <Variable className="h-4 w-4" />
                Variáveis
              </TabsTrigger>
              <TabsTrigger value="groups" className="gap-2">
                <FolderOpen className="h-4 w-4" />
                Grupos
              </TabsTrigger>
            </TabsList>

            <div className="flex gap-2">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              {activeTab !== 'variables' && (
                <Select value={selectedEntity} onValueChange={(v) => setSelectedEntity(v as any)}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Entidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Fields Tab */}
          <TabsContent value="fields" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleCreateField}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Campo
              </Button>
            </div>

            {fieldsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredFields.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum campo personalizado encontrado.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {filteredFields.map((field) => (
                  <Card key={field.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium truncate">{field.label}</span>
                            {field.is_required && (
                              <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {ENTITY_LABELS[field.entity_type as EntityType]}
                            </Badge>
                            <Badge variant="secondary" className="text-xs">
                              {FIELD_TYPE_LABELS[field.field_type as keyof typeof FIELD_TYPE_LABELS]}
                            </Badge>
                            {field.group && (
                              <Badge className="text-xs bg-primary/10 text-primary">
                                {field.group.name}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={field.is_active}
                            onCheckedChange={() => handleToggleFieldActive(field)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => handleEditField(field)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteConfirm('field', field.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Variables Tab */}
          <TabsContent value="variables" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleCreateVariable}>
                <Plus className="h-4 w-4 mr-2" />
                Nova Variável
              </Button>
            </div>

            {variablesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : (
              <div className="grid gap-4">
                {/* Group by category */}
                {Object.entries(
                  filteredVariables.reduce((acc, v) => {
                    if (!acc[v.category]) acc[v.category] = [];
                    acc[v.category].push(v);
                    return acc;
                  }, {} as Record<string, typeof filteredVariables>)
                ).map(([category, vars]) => (
                  <Card key={category}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-lg">{category}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        {vars.map((variable) => (
                          <div
                            key={variable.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                                  {`{{${variable.variable_key}}}`}
                                </code>
                                {variable.is_system && (
                                  <Lock className="h-3 w-3 text-muted-foreground" />
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {variable.label}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCopyVariable(variable.variable_key)}
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              {!variable.is_system && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditVariable(variable)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteConfirm('variable', variable.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Groups Tab */}
          <TabsContent value="groups" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={handleCreateGroup}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Grupo
              </Button>
            </div>

            {groupsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : filteredGroups.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhum grupo encontrado.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-2">
                {filteredGroups.map((group) => (
                  <Card key={group.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center gap-4">
                        <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab" />
                        
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{group.name}</span>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {ENTITY_LABELS[group.entity_type as EntityType]}
                            </Badge>
                            {group.is_collapsed_default && (
                              <Badge variant="secondary" className="text-xs">
                                Colapsado por padrão
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditGroup(group)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => handleDeleteConfirm('group', group.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <CustomFieldModal
          open={fieldModalOpen}
          onOpenChange={setFieldModalOpen}
          field={selectedField}
          defaultEntityType={selectedEntity === 'all' ? undefined : selectedEntity}
        />

        <CustomFieldGroupModal
          open={groupModalOpen}
          onOpenChange={setGroupModalOpen}
          group={selectedGroup}
          defaultEntityType={selectedEntity === 'all' ? undefined : selectedEntity}
        />

        <DynamicVariableModal
          open={variableModalOpen}
          onOpenChange={setVariableModalOpen}
          variable={selectedVariable}
        />

        {/* Delete Confirmation */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. Tem certeza que deseja excluir este item?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}
