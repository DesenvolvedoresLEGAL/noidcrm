import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2 } from 'lucide-react';
import { useCustomFieldMutations, useCustomFieldGroups } from '@/hooks/useCustomFields';
import {
  ENTITY_LABELS,
  FIELD_TYPE_LABELS,
  LOCATION_LABELS,
  type CustomField,
  type EntityType,
  type FieldType,
} from '@/services/crm/custom-fields';

const schema = z.object({
  field_key: z.string().min(1, 'Chave é obrigatória').regex(/^[a-z_]+$/, 'Use apenas letras minúsculas e underscore'),
  label: z.string().min(1, 'Nome é obrigatório'),
  field_type: z.string().min(1, 'Tipo é obrigatório'),
  entity_type: z.string().min(1, 'Entidade é obrigatória'),
  group_id: z.string().nullable().optional(),
  is_required: z.boolean().default(false),
  default_value: z.string().nullable().optional(),
  help_text: z.string().nullable().optional(),
  options: z.array(z.object({ label: z.string(), value: z.string() })).default([]),
  validation_rules: z.object({
    min: z.number().nullable().optional(),
    max: z.number().nullable().optional(),
    minLength: z.number().nullable().optional(),
    maxLength: z.number().nullable().optional(),
    pattern: z.string().nullable().optional(),
    patternMessage: z.string().nullable().optional(),
  }).default({}),
  visibility_config: z.object({
    locations: z.array(z.string()).default(['form_create', 'form_edit', 'detail_page']),
    permissions: z.object({
      view: z.array(z.string()).default(['all']),
      edit: z.array(z.string()).default(['all']),
    }).default({ view: ['all'], edit: ['all'] }),
  }).default({ locations: ['form_create', 'form_edit', 'detail_page'], permissions: { view: ['all'], edit: ['all'] } }),
});

type FormData = z.infer<typeof schema>;

interface CustomFieldModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomField | null;
  defaultEntityType?: EntityType;
}

export function CustomFieldModal({ open, onOpenChange, field, defaultEntityType }: CustomFieldModalProps) {
  const [activeTab, setActiveTab] = useState('general');
  const { createField, updateField, isCreating, isUpdating } = useCustomFieldMutations();
  const isEditing = !!field;

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      field_key: '',
      label: '',
      field_type: 'text',
      entity_type: defaultEntityType || 'account',
      group_id: null,
      is_required: false,
      default_value: null,
      help_text: null,
      options: [],
      validation_rules: {},
      visibility_config: {
        locations: ['form_create', 'form_edit', 'detail_page'],
        permissions: { view: ['all'], edit: ['all'] },
      },
    },
  });

  const watchedEntityType = watch('entity_type') as EntityType;
  const watchedFieldType = watch('field_type') as FieldType;
  const watchedOptions = watch('options');
  const watchedLocations = watch('visibility_config.locations');

  const { data: groups = [] } = useCustomFieldGroups(watchedEntityType);

  useEffect(() => {
    if (field) {
      reset({
        field_key: field.field_key,
        label: field.label,
        field_type: field.field_type,
        entity_type: field.entity_type,
        group_id: field.group_id,
        is_required: field.is_required,
        default_value: field.default_value,
        help_text: field.help_text,
        options: field.options || [],
        validation_rules: field.validation_rules || {},
        visibility_config: field.visibility_config || {
          locations: ['form_create', 'form_edit', 'detail_page'],
          permissions: { view: ['all'], edit: ['all'] },
        },
      });
    } else {
      reset({
        field_key: '',
        label: '',
        field_type: 'text',
        entity_type: defaultEntityType || 'account',
        group_id: null,
        is_required: false,
        default_value: null,
        help_text: null,
        options: [],
        validation_rules: {},
        visibility_config: {
          locations: ['form_create', 'form_edit', 'detail_page'],
          permissions: { view: ['all'], edit: ['all'] },
        },
      });
    }
    setActiveTab('general');
  }, [field, defaultEntityType, reset, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await updateField({
          id: field.id,
          updates: data as any,
        });
      } else {
        await createField(data as any);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  const addOption = () => {
    const currentOptions = watchedOptions || [];
    setValue('options', [...currentOptions, { label: '', value: '' }]);
  };

  const removeOption = (index: number) => {
    const currentOptions = watchedOptions || [];
    setValue('options', currentOptions.filter((_, i) => i !== index));
  };

  const toggleLocation = (location: string) => {
    const current = watchedLocations || [];
    if (current.includes(location)) {
      setValue('visibility_config.locations', current.filter((l) => l !== location));
    } else {
      setValue('visibility_config.locations', [...current, location]);
    }
  };

  const showOptionsField = ['select', 'multi_select'].includes(watchedFieldType);
  const showNumericValidation = ['number', 'currency'].includes(watchedFieldType);
  const showTextValidation = ['text', 'textarea'].includes(watchedFieldType);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Campo' : 'Novo Campo Personalizado'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full">
              <TabsTrigger value="general" className="flex-1">Geral</TabsTrigger>
              <TabsTrigger value="options" className="flex-1">Opções</TabsTrigger>
              <TabsTrigger value="visibility" className="flex-1">Visibilidade</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="label">Nome do Campo *</Label>
                  <Input
                    id="label"
                    {...register('label')}
                    placeholder="Ex: Setor de Atuação"
                  />
                  {errors.label && (
                    <p className="text-sm text-destructive">{errors.label.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="field_key">Chave (identificador) *</Label>
                  <Input
                    id="field_key"
                    {...register('field_key')}
                    placeholder="Ex: setor_atuacao"
                    disabled={isEditing}
                  />
                  {errors.field_key && (
                    <p className="text-sm text-destructive">{errors.field_key.message}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Entidade *</Label>
                  <Controller
                    name="entity_type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange} disabled={isEditing}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(ENTITY_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tipo de Campo *</Label>
                  <Controller
                    name="field_type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(FIELD_TYPE_LABELS).map(([key, label]) => (
                            <SelectItem key={key} value={key}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Grupo</Label>
                  <Controller
                    name="group_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={(v) => field.onChange(v || null)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sem grupo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Sem grupo</SelectItem>
                          {groups.map((group) => (
                            <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="default_value">Valor Padrão</Label>
                  <Input
                    id="default_value"
                    {...register('default_value')}
                    placeholder="Valor inicial do campo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="help_text">Texto de Ajuda</Label>
                <Textarea
                  id="help_text"
                  {...register('help_text')}
                  placeholder="Instruções para preenchimento do campo"
                  rows={2}
                />
              </div>

              <div className="flex items-center gap-2">
                <Controller
                  name="is_required"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label>Campo obrigatório</Label>
              </div>
            </TabsContent>

            <TabsContent value="options" className="space-y-4 mt-4">
              {showOptionsField && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Opções da Lista</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addOption}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>

                  {(watchedOptions || []).map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        placeholder="Rótulo"
                        value={option.label}
                        onChange={(e) => {
                          const newOptions = [...(watchedOptions || [])];
                          newOptions[index] = { ...newOptions[index], label: e.target.value };
                          setValue('options', newOptions);
                        }}
                      />
                      <Input
                        placeholder="Valor"
                        value={option.value}
                        onChange={(e) => {
                          const newOptions = [...(watchedOptions || [])];
                          newOptions[index] = { ...newOptions[index], value: e.target.value };
                          setValue('options', newOptions);
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOption(index)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}

                  {(watchedOptions || []).length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      Adicione opções para o campo de seleção
                    </p>
                  )}
                </div>
              )}

              {showNumericValidation && (
                <div className="space-y-4">
                  <Label>Validação Numérica</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="min">Valor Mínimo</Label>
                      <Input
                        id="min"
                        type="number"
                        {...register('validation_rules.min', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="max">Valor Máximo</Label>
                      <Input
                        id="max"
                        type="number"
                        {...register('validation_rules.max', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showTextValidation && (
                <div className="space-y-4">
                  <Label>Validação de Texto</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="minLength">Caracteres Mínimos</Label>
                      <Input
                        id="minLength"
                        type="number"
                        {...register('validation_rules.minLength', { valueAsNumber: true })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="maxLength">Caracteres Máximos</Label>
                      <Input
                        id="maxLength"
                        type="number"
                        {...register('validation_rules.maxLength', { valueAsNumber: true })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pattern">Padrão (Regex)</Label>
                    <Input
                      id="pattern"
                      {...register('validation_rules.pattern')}
                      placeholder="Ex: ^[A-Z]{2}\\d{4}$"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patternMessage">Mensagem de Erro do Padrão</Label>
                    <Input
                      id="patternMessage"
                      {...register('validation_rules.patternMessage')}
                      placeholder="Ex: Formato inválido. Use XX0000"
                    />
                  </div>
                </div>
              )}

              {!showOptionsField && !showNumericValidation && !showTextValidation && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Este tipo de campo não possui opções de validação adicionais.
                </p>
              )}
            </TabsContent>

            <TabsContent value="visibility" className="space-y-4 mt-4">
              <div className="space-y-4">
                <Label>Locais de Exibição</Label>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(LOCATION_LABELS).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2">
                      <Checkbox
                        id={key}
                        checked={(watchedLocations || []).includes(key)}
                        onCheckedChange={() => toggleLocation(key)}
                      />
                      <Label htmlFor={key} className="font-normal cursor-pointer">
                        {label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Preview:</strong> Este campo aparecerá em:
                </p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(watchedLocations || []).map((loc) => (
                    <Badge key={loc} variant="secondary">
                      {LOCATION_LABELS[loc] || loc}
                    </Badge>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isCreating || isUpdating}>
              {isCreating || isUpdating ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
