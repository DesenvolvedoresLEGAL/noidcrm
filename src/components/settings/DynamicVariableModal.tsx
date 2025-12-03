import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDynamicVariableMutations } from '@/hooks/useDynamicVariables';
import type { DynamicVariable } from '@/services/crm/dynamic-variables';

const schema = z.object({
  variable_key: z.string().min(1, 'Chave é obrigatória').regex(/^[a-z_]+$/, 'Use apenas letras minúsculas e underscore'),
  label: z.string().min(1, 'Nome é obrigatório'),
  category: z.string().min(1, 'Categoria é obrigatória'),
  description: z.string().nullable().optional(),
  source_entity: z.string().nullable().optional(),
  source_field: z.string().nullable().optional(),
  format_type: z.string().nullable().optional(),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

const CATEGORIES = [
  'Organização',
  'Cliente',
  'Contato',
  'Proposta',
  'Vendedor',
  'Oportunidade',
  'Produto',
  'Data',
  'Personalizado',
];

const SOURCE_ENTITIES = [
  { value: 'organization', label: 'Organização' },
  { value: 'account', label: 'Empresa/Cliente' },
  { value: 'contact', label: 'Contato' },
  { value: 'proposal', label: 'Proposta' },
  { value: 'owner', label: 'Vendedor' },
  { value: 'opportunity', label: 'Oportunidade' },
  { value: 'product', label: 'Produto' },
  { value: 'custom_field', label: 'Campo Personalizado' },
];

interface DynamicVariableModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variable: DynamicVariable | null;
}

export function DynamicVariableModal({
  open,
  onOpenChange,
  variable,
}: DynamicVariableModalProps) {
  const { createVariable, updateVariable, isCreating, isUpdating } = useDynamicVariableMutations();
  const isEditing = !!variable;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      variable_key: '',
      label: '',
      category: 'Personalizado',
      description: null,
      source_entity: null,
      source_field: null,
      format_type: null,
      is_active: true,
    },
  });

  const watchedCategory = watch('category');
  const watchedSourceEntity = watch('source_entity');

  useEffect(() => {
    if (variable) {
      reset({
        variable_key: variable.variable_key,
        label: variable.label,
        category: variable.category,
        description: variable.description,
        source_entity: variable.source_entity,
        source_field: variable.source_field,
        format_type: variable.format_type,
        is_active: variable.is_active,
      });
    } else {
      reset({
        variable_key: '',
        label: '',
        category: 'Personalizado',
        description: null,
        source_entity: null,
        source_field: null,
        format_type: null,
        is_active: true,
      });
    }
  }, [variable, reset, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await updateVariable({
          id: variable.id,
          updates: data,
        });
      } else {
        await createVariable(data as any);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Variável' : 'Nova Variável Dinâmica'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="label">Nome da Variável *</Label>
              <Input
                id="label"
                {...register('label')}
                placeholder="Ex: Taxa de Desconto"
              />
              {errors.label && (
                <p className="text-sm text-destructive">{errors.label.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="variable_key">Chave *</Label>
              <Input
                id="variable_key"
                {...register('variable_key')}
                placeholder="Ex: taxa_desconto"
                disabled={isEditing}
              />
              {errors.variable_key && (
                <p className="text-sm text-destructive">{errors.variable_key.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Categoria *</Label>
            <Select value={watchedCategory} onValueChange={(v) => setValue('category', v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descreva o que esta variável representa"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Entidade Fonte</Label>
              <Select 
                value={watchedSourceEntity || ''} 
                onValueChange={(v) => setValue('source_entity', v || null)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhuma</SelectItem>
                  {SOURCE_ENTITIES.map((entity) => (
                    <SelectItem key={entity.value} value={entity.value}>
                      {entity.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="source_field">Campo Fonte</Label>
              <Input
                id="source_field"
                {...register('source_field')}
                placeholder="Ex: discount_rate"
              />
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Preview da Variável:</p>
            <code className="text-sm bg-background px-2 py-1 rounded">
              {`{{${watch('variable_key') || 'sua_variavel'}}}`}
            </code>
          </div>

          <DialogFooter>
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
