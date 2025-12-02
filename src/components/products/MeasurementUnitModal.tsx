import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  createMeasurementUnit,
  updateMeasurementUnit,
  type MeasurementUnit,
} from '@/services/crm/measurement-units';

const unitSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  abbreviation: z.string().min(1, 'Abreviação é obrigatória').max(10, 'Máximo 10 caracteres'),
  is_default: z.boolean(),
});

type UnitFormData = z.infer<typeof unitSchema>;

interface MeasurementUnitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  unit?: MeasurementUnit;
}

export function MeasurementUnitModal({ open, onOpenChange, unit }: MeasurementUnitModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<UnitFormData>({
    resolver: zodResolver(unitSchema),
    defaultValues: {
      name: '',
      abbreviation: '',
      is_default: false,
    },
  });

  useEffect(() => {
    if (open && unit) {
      form.reset({
        name: unit.name,
        abbreviation: unit.abbreviation,
        is_default: unit.is_default,
      });
    } else if (!open) {
      form.reset({
        name: '',
        abbreviation: '',
        is_default: false,
      });
    }
  }, [open, unit, form]);

  const mutation = useMutation({
    mutationFn: async (data: UnitFormData) => {
      if (unit) {
        return updateMeasurementUnit(unit.id, {
          name: data.name,
          abbreviation: data.abbreviation,
          is_default: data.is_default,
        });
      }
      return createMeasurementUnit({
        name: data.name,
        abbreviation: data.abbreviation,
        is_default: data.is_default,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['measurement-units'] });
      toast({
        title: unit ? 'Unidade atualizada' : 'Unidade criada',
        description: 'Operação realizada com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const onSubmit = (data: UnitFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {unit ? 'Editar Unidade de Medida' : 'Nova Unidade de Medida'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input
              id="name"
              {...form.register('name')}
              placeholder="Ex: Quilograma"
            />
            {form.formState.errors.name && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.name.message}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="abbreviation">Abreviação *</Label>
            <Input
              id="abbreviation"
              {...form.register('abbreviation')}
              placeholder="Ex: kg"
              maxLength={10}
            />
            {form.formState.errors.abbreviation && (
              <p className="text-sm text-destructive mt-1">
                {form.formState.errors.abbreviation.message}
              </p>
            )}
          </div>

          <div className="flex items-center justify-between border rounded-lg p-4 bg-muted/30">
            <div>
              <Label>Unidade Padrão</Label>
              <p className="text-sm text-muted-foreground">
                Definir como padrão ao criar novos produtos
              </p>
            </div>
            <Switch
              checked={form.watch('is_default')}
              onCheckedChange={(checked) => form.setValue('is_default', checked)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : unit ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
