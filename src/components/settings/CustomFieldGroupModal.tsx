import { useEffect } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCustomFieldGroupMutations } from '@/hooks/useCustomFields';
import { ENTITY_LABELS, type CustomFieldGroup, type EntityType } from '@/services/crm/custom-fields';

const schema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  entity_type: z.string().min(1, 'Entidade é obrigatória'),
  display_order: z.number().default(0),
  is_collapsed_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

type FormData = z.infer<typeof schema>;

interface CustomFieldGroupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: CustomFieldGroup | null;
  defaultEntityType?: EntityType;
}

export function CustomFieldGroupModal({
  open,
  onOpenChange,
  group,
  defaultEntityType,
}: CustomFieldGroupModalProps) {
  const { createGroup, updateGroup, isCreating, isUpdating } = useCustomFieldGroupMutations();
  const isEditing = !!group;

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      entity_type: defaultEntityType || 'account',
      display_order: 0,
      is_collapsed_default: false,
      is_active: true,
    },
  });

  useEffect(() => {
    if (group) {
      reset({
        name: group.name,
        entity_type: group.entity_type,
        display_order: group.display_order,
        is_collapsed_default: group.is_collapsed_default,
        is_active: group.is_active,
      });
    } else {
      reset({
        name: '',
        entity_type: defaultEntityType || 'account',
        display_order: 0,
        is_collapsed_default: false,
        is_active: true,
      });
    }
  }, [group, defaultEntityType, reset, open]);

  const onSubmit = async (data: FormData) => {
    try {
      if (isEditing) {
        await updateGroup({
          id: group.id,
          updates: data,
        });
      } else {
        await createGroup(data as any);
      }
      onOpenChange(false);
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? 'Editar Grupo' : 'Novo Grupo de Campos'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Grupo *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="Ex: Informações Financeiras"
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

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
            <Label htmlFor="display_order">Ordem de Exibição</Label>
            <Input
              id="display_order"
              type="number"
              {...register('display_order', { valueAsNumber: true })}
            />
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="is_collapsed_default"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label>Iniciar colapsado por padrão</Label>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="is_active"
              control={control}
              render={({ field }) => (
                <Switch
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <Label>Grupo ativo</Label>
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
