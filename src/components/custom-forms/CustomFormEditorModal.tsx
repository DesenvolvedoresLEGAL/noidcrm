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
  Asterisk 
} from 'lucide-react';
import { useOrganizationPipelines } from '@/hooks/useOrganizationPipelines';
import { useCustomFields } from '@/hooks/useCustomFields';
import { useCustomFormMutations, CustomForm, CustomFormField } from '@/hooks/useCustomForms';
import { NATIVE_FIELDS } from '@/services/crm/native-fields';

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
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [entityType, setEntityType] = useState<'opportunity' | 'account' | 'contact'>('opportunity');
  const [selectedPipelines, setSelectedPipelines] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<CustomFormField[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');

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
    } else if (open && !form) {
      setName('');
      setDescription('');
      setEntityType('opportunity');
      setSelectedPipelines([]);
      setIsActive(true);
      setFields([]);
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
    };

    if (form) {
      await updateForm.mutateAsync({ id: form.id, ...formData });
    } else {
      await createForm.mutateAsync(formData);
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            {form ? 'Editar Formulário' : 'Novo Formulário'}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 grid grid-cols-3 gap-4 min-h-0 overflow-hidden">
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
                {fields.length} campo(s) selecionado(s)
              </p>
            </div>
            <ScrollArea className="flex-1 p-2">
              {fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                  <Plus className="h-8 w-8 mb-2 opacity-50" />
                  Clique em um campo ao lado para adicionar
                </div>
              ) : (
                <div className="space-y-2">
                  {fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="flex items-center gap-2 p-2 border rounded-md bg-background"
                    >
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          {field.is_required && (
                            <Asterisk className="h-3 w-3 text-destructive" />
                          )}
                          <span className="text-sm font-medium truncate">
                            {field.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          {getEntityIcon(field.entity_source)}
                          <span>{getEntityLabel(field.entity_source)}</span>
                          <span>•</span>
                          <span>{field.source === 'native' ? 'Nativo' : 'Custom'}</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleRequired(field.id)}
                        className={field.is_required ? 'text-destructive' : 'text-muted-foreground'}
                      >
                        <Asterisk className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeField(field.id)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Right Column - Available Fields */}
          <div className="border rounded-lg flex flex-col min-h-0">
            <div className="p-3 border-b bg-muted/50">
              <h4 className="font-medium">Campos Disponíveis</h4>
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
              {/* Opportunity Fields */}
              {groupedFields.opportunity.length > 0 && (
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-2 text-sm font-medium text-muted-foreground">
                    <Target className="h-4 w-4" />
                    Oportunidades
                  </div>
                  <div className="space-y-1">
                    {groupedFields.opportunity.map(field => (
                      <button
                        key={field.id}
                        onClick={() => addField(field)}
                        className="w-full text-left p-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>{field.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {field.source === 'native' ? 'Nativo' : 'Custom'}
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
                  </div>
                  <div className="space-y-1">
                    {groupedFields.account.map(field => (
                      <button
                        key={field.id}
                        onClick={() => addField(field)}
                        className="w-full text-left p-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>{field.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {field.source === 'native' ? 'Nativo' : 'Custom'}
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
                  </div>
                  <div className="space-y-1">
                    {groupedFields.contact.map(field => (
                      <button
                        key={field.id}
                        onClick={() => addField(field)}
                        className="w-full text-left p-2 text-sm rounded-md hover:bg-muted transition-colors flex items-center justify-between"
                      >
                        <span>{field.label}</span>
                        <Badge variant="outline" className="text-xs">
                          {field.source === 'native' ? 'Nativo' : 'Custom'}
                        </Badge>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredAvailableFields.length === 0 && (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  Nenhum campo disponível
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

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
