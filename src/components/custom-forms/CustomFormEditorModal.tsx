import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  GripVertical, 
  X, 
  Plus, 
  Search, 
  Building2, 
  Users, 
  Target,
  Asterisk,
  Settings,
  Palette,
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useCustomFormMutations, CustomForm, CustomFormField } from '@/hooks/useCustomForms';
import { NATIVE_FIELDS } from '@/services/crm/native-fields';
import { PublicFormPreview, PublicFormSettings, DEFAULT_PUBLIC_SETTINGS } from './PublicFormPreview';
import { PublicFormSettingsTab } from './PublicFormSettingsTab';

interface SortableFieldItemProps {
  field: CustomFormField;
  onToggleRequired: (id: string) => void;
  onRemove: (id: string) => void;
  getEntityIcon: (entity: string) => React.ReactNode;
  getEntityLabel: (entity: string) => string;
}

function SortableFieldItem({ 
  field, 
  onToggleRequired, 
  onRemove, 
  getEntityIcon, 
  getEntityLabel 
}: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 p-2 border rounded-md bg-background"
    >
      <div 
        {...attributes} 
        {...listeners}
        className="cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {field.is_required && (
            <Asterisk className="h-3 w-3 text-destructive" />
          )}
          <span className="text-sm font-medium truncate">
            {field.label}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {getEntityIcon(field.entity_source)}
          <span>{getEntityLabel(field.entity_source)}</span>
          <span>•</span>
          <Badge 
            variant={field.source === 'custom' ? 'default' : 'secondary'} 
            className={`text-[10px] px-1.5 py-0 h-4 ${field.source === 'custom' ? 'bg-violet-500' : ''}`}
          >
            {field.source === 'native' ? 'Nativo' : 'Personalizado'}
          </Badge>
        </div>
      </div>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onToggleRequired(field.id)}
        className={field.is_required ? 'text-destructive' : 'text-muted-foreground'}
      >
        <Asterisk className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(field.id)}
        className="text-muted-foreground hover:text-destructive"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}

interface CustomFormEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form?: CustomForm | null;
}

export function CustomFormEditorModal({ 
  open, 
  onOpenChange, 
  form 
}: CustomFormEditorModalProps) {
  const [activeTab, setActiveTab] = useState('config');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<'opportunity' | 'account' | 'contact'>('opportunity');
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<CustomFormField[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  
  // Public form settings (only for customization, not for enabling public)
  const [publicSettings, setPublicSettings] = useState<PublicFormSettings>(DEFAULT_PUBLIC_SETTINGS);

  const { pipelines = [] } = useOrganizationPipelines();
  const { data: customFieldsOpp = [] } = useCustomFields('opportunity');
  const { data: customFieldsAcc = [] } = useCustomFields('account');
  const { data: customFieldsCon = [] } = useCustomFields('contact');
  const { createForm, updateForm, isCreating, isUpdating } = useCustomFormMutations();

  // Reset form when opening/closing
  useEffect(() => {
    if (open && form) {
      setName(form.name);
      setDescription(form.description || '');
      setEntityType(form.entity_type as any);
      setSelectedPipelines(form.pipeline_ids || []);
      setIsActive(form.is_active);
      setFields(form.fields || []);
      setPublicSettings((form as any).public_settings || DEFAULT_PUBLIC_SETTINGS);
      setActiveTab('config');
    } else if (open && !form) {
      setName('');
      setDescription('');
      setEntityType('opportunity');
      setSelectedPipelines([]);
      setIsActive(true);
      setFields([]);
      setPublicSettings(DEFAULT_PUBLIC_SETTINGS);
      setActiveTab('config');
    }
  }, [open, form]);

  // Get all available fields (native + custom) for each entity
  const getAvailableFields = () => {
    const result: Array<{
      id: string;
      source: 'native' | 'custom';
      field_key: string;
      entity_source: 'opportunity' | 'account' | 'contact';
      label: string;
      type: string;
    }> = [];

    // Native opportunity fields
    NATIVE_FIELDS.opportunity.forEach(f => {
      result.push({
        id: `native-opportunity-${f.key}`,
        source: 'native',
        field_key: f.key,
        entity_source: 'opportunity',
        label: f.label,
        type: f.type,
      });
    });

    // Native account fields
    NATIVE_FIELDS.account.forEach(f => {
      result.push({
        id: `native-account-${f.key}`,
        source: 'native',
        field_key: f.key,
        entity_source: 'account',
        label: f.label,
        type: f.type,
      });
    });

    // Native contact fields
    NATIVE_FIELDS.contact.forEach(f => {
      result.push({
        id: `native-contact-${f.key}`,
        source: 'native',
        field_key: f.key,
        entity_source: 'contact',
        label: f.label,
        type: f.type,
      });
    });

    // Custom fields
    customFieldsOpp.forEach(f => {
      result.push({
        id: `custom-opportunity-${f.id}`,
        source: 'custom',
        field_key: f.id,
        entity_source: 'opportunity',
        label: f.label,
        type: f.field_type,
      });
    });

    customFieldsAcc.forEach(f => {
      result.push({
        id: `custom-account-${f.id}`,
        source: 'custom',
        field_key: f.id,
        entity_source: 'account',
        label: f.label,
        type: f.field_type,
      });
    });

    customFieldsCon.forEach(f => {
      result.push({
        id: `custom-contact-${f.id}`,
        source: 'custom',
        field_key: f.id,
        entity_source: 'contact',
        label: f.label,
        type: f.field_type,
      });
    });

    return result;
  };

  const availableFields = getAvailableFields();

  // Filter available fields based on search
  const filteredAvailableFields = availableFields.filter(f => {
    const matchSearch = f.label.toLowerCase().includes(fieldSearch.toLowerCase());
    const notSelected = !fields.some(
      sf => sf.source === f.source && sf.field_key === f.field_key && sf.entity_source === f.entity_source
    );
    return matchSearch && notSelected;
  });

  // Group filtered fields by entity
  const groupedFields = {
    opportunity: filteredAvailableFields.filter(f => f.entity_source === 'opportunity'),
    account: filteredAvailableFields.filter(f => f.entity_source === 'account'),
    contact: filteredAvailableFields.filter(f => f.entity_source === 'contact'),
  };

  const addField = (field: typeof availableFields[0]) => {
    const newField: CustomFormField = {
      id: field.id,
      source: field.source,
      field_key: field.field_key,
      entity_source: field.entity_source,
      is_required: false,
      display_order: fields.length,
      label: field.label,
      type: field.type,
    };
    setFields([...fields, newField]);
  };

  const removeField = (id: string) => {
    setFields(fields.filter(f => f.id !== id));
  };

  const toggleRequired = (id: string) => {
    setFields(fields.map(f => 
      f.id === id ? { ...f, is_required: !f.is_required } : f
    ));
  };

  const togglePipeline = (pipelineId: string) => {
    if (selectedPipelines.includes(pipelineId)) {
      setSelectedPipelines(selectedPipelines.filter(id => id !== pipelineId));
    } else {
      setSelectedPipelines([...selectedPipelines, pipelineId]);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) return;

    const formData = {
      name,
      description: description || null,
      entity_type: entityType,
      pipeline_ids: selectedPipelines,
      activity_type_ids: [],
      fields: fields.map((f, i) => ({ ...f, display_order: i })),
      is_active: isActive,
      display_order: 0,
      public_settings: publicSettings,
    };

    if (form) {
      await updateForm.mutateAsync({ id: form.id, ...formData });
    } else {
      await createForm.mutateAsync(formData as any);
    }

    onOpenChange(false);
  };

  const getEntityIcon = (entity: string) => {
    switch (entity) {
      case 'opportunity': return <Target className="h-4 w-4" />;
      case 'account': return <Building2 className="h-4 w-4" />;
      case 'contact': return <Users className="h-4 w-4" />;
      default: return null;
    }
  };

  const getEntityLabel = (entity: string) => {
    switch (entity) {
      case 'opportunity': return 'Oportunidades';
      case 'account': return 'Empresas';
      case 'contact': return 'Pessoas';
      default: return entity;
    }
  };

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setFields((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {form ? 'Editar Formulário' : 'Novo Formulário'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Configuração
            </TabsTrigger>
            <TabsTrigger value="personalization" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Personalização
            </TabsTrigger>
          </TabsList>

          <TabsContent value="config" className="flex-1 min-h-0 mt-4">
            <div className="grid grid-cols-[280px_1fr_300px] gap-6 h-full overflow-hidden">
              {/* Left Column - Settings */}
              <div className="space-y-4 overflow-auto pr-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Formulário *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Checklist Alugue"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Descrição</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Descrição do formulário..."
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Vincular à</Label>
                  <Select value={entityType} onValueChange={(v: any) => setEntityType(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="opportunity">Oportunidade</SelectItem>
                      <SelectItem value="account">Empresa</SelectItem>
                      <SelectItem value="contact">Contato</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {entityType === 'opportunity' && (
                  <div className="space-y-2">
                    <Label>Exibir nos Funis</Label>
                    <div className="space-y-2 max-h-40 overflow-auto border rounded-md p-2">
                      {pipelines.map(pipeline => (
                        <div key={pipeline.id} className="flex items-center gap-2">
                          <Checkbox
                            id={`pipeline-${pipeline.id}`}
                            checked={selectedPipelines.includes(pipeline.id)}
                            onCheckedChange={() => togglePipeline(pipeline.id)}
                          />
                          <label 
                            htmlFor={`pipeline-${pipeline.id}`}
                            className="text-sm cursor-pointer"
                          >
                            {pipeline.name}
                          </label>
                        </div>
                      ))}
                      {pipelines.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhum funil encontrado</p>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Deixe vazio para exibir em todos os funis
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Formulário Ativo</Label>
                  <Switch
                    id="active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>
              </div>

              {/* Center Column - Selected Fields */}
              <div className="border rounded-lg flex flex-col min-h-0">
                <div className="p-3 border-b bg-muted/50">
                  <h4 className="font-medium">Campos do Formulário</h4>
                  <p className="text-xs text-muted-foreground">
                    {fields.length} campo(s) selecionado(s) • Arraste para reordenar
                  </p>
                </div>
                <ScrollArea className="flex-1 p-3">
                  {fields.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                      <Plus className="h-8 w-8 mb-2 opacity-50" />
                      Clique em um campo ao lado para adicionar
                    </div>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={fields.map(f => f.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <div className="space-y-2">
                          {fields.map((field) => (
                            <SortableFieldItem
                              key={field.id}
                              field={field}
                              onToggleRequired={toggleRequired}
                              onRemove={removeField}
                              getEntityIcon={getEntityIcon}
                              getEntityLabel={getEntityLabel}
                            />
                          ))}
                        </div>
                      </SortableContext>
                    </DndContext>
                  )}
                </ScrollArea>
              </div>

              {/* Right Column - Available Fields */}
              <div className="border rounded-lg flex flex-col min-h-0">
                <div className="p-3 border-b bg-muted/50">
                  <h4 className="font-medium">Campos Disponíveis</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filteredAvailableFields.filter(f => f.source === 'native').length} nativos • {filteredAvailableFields.filter(f => f.source === 'custom').length} personalizados
                  </p>
                  <div className="relative mt-2">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar campo..."
                      value={fieldSearch}
                      onChange={(e) => setFieldSearch(e.target.value)}
                      className="pl-8 h-8"
                    />
                  </div>
                </div>
                <ScrollArea className="flex-1 p-2">
                  {filteredAvailableFields.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-20 text-muted-foreground text-sm">
                      Nenhum campo disponível
                    </div>
                  )}
                  
                  {/* Opportunity Fields */}
                  {groupedFields.opportunity.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                        <Target className="h-4 w-4" />
                        Oportunidades
                        <span className="text-xs">({groupedFields.opportunity.length})</span>
                      </div>
                      <div className="space-y-1">
                        {groupedFields.opportunity.map(field => (
                          <button
                            key={field.id}
                            onClick={() => addField(field)}
                            className="w-full text-left p-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <span>{field.label}</span>
                            <Badge 
                              variant={field.source === 'custom' ? 'default' : 'outline'} 
                              className={`text-xs ${field.source === 'custom' ? 'bg-violet-500 hover:bg-violet-600' : ''}`}
                            >
                              {field.source === 'native' ? 'Nativo' : 'Personalizado'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Account Fields */}
                  {groupedFields.account.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                        <Building2 className="h-4 w-4" />
                        Empresas
                        <span className="text-xs">({groupedFields.account.length})</span>
                      </div>
                      <div className="space-y-1">
                        {groupedFields.account.map(field => (
                          <button
                            key={field.id}
                            onClick={() => addField(field)}
                            className="w-full text-left p-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <span>{field.label}</span>
                            <Badge 
                              variant={field.source === 'custom' ? 'default' : 'outline'} 
                              className={`text-xs ${field.source === 'custom' ? 'bg-violet-500 hover:bg-violet-600' : ''}`}
                            >
                              {field.source === 'native' ? 'Nativo' : 'Personalizado'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact Fields */}
                  {groupedFields.contact.length > 0 && (
                    <div className="mb-4">
                      <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Pessoas
                        <span className="text-xs">({groupedFields.contact.length})</span>
                      </div>
                      <div className="space-y-1">
                        {groupedFields.contact.map(field => (
                          <button
                            key={field.id}
                            onClick={() => addField(field)}
                            className="w-full text-left p-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                          >
                            <span>{field.label}</span>
                            <Badge 
                              variant={field.source === 'custom' ? 'default' : 'outline'} 
                              className={`text-xs ${field.source === 'custom' ? 'bg-violet-500 hover:bg-violet-600' : ''}`}
                            >
                              {field.source === 'native' ? 'Nativo' : 'Personalizado'}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="personalization" className="flex-1 min-h-0 mt-4">
            <div className="grid grid-cols-[1fr_400px] gap-6 h-full overflow-hidden">
              {/* Left - Settings */}
              <ScrollArea className="h-full pr-4">
                <PublicFormSettingsTab
                  settings={publicSettings}
                  onSettingsChange={setPublicSettings}
                />
              </ScrollArea>

              {/* Right - Preview */}
              <div className="border rounded-lg overflow-hidden bg-muted/20">
                <div className="p-2 border-b bg-muted/50 text-center">
                  <span className="text-xs font-medium text-muted-foreground">
                    Preview do Formulário Público
                  </span>
                </div>
                <div className="h-[calc(100%-40px)]">
                  <PublicFormPreview 
                    settings={publicSettings}
                    fields={fields}
                    formName={name || 'Novo Formulário'}
                  />
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Separator />

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!name.trim() || isCreating || isUpdating}
          >
            {isCreating || isUpdating ? 'Salvando...' : form ? 'Salvar' : 'Criar Formulário'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
