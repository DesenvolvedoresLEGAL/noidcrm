import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { rubricSchema, type RubricFormData } from '@/schemas/roleplay';
import { Plus, X } from 'lucide-react';
import type { Rubric } from '@/services/roleplay/rubrics';

interface RubricModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: RubricFormData) => Promise<void>;
  rubric?: Rubric;
}

export function RubricModal({ open, onClose, onSave, rubric }: RubricModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RubricFormData>({
    resolver: zodResolver(rubricSchema),
    defaultValues: {
      name: '',
      passing_score: 8,
      dimensions: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (rubric) {
        reset({
          name: rubric.name,
          passing_score: rubric.passing_score,
          dimensions: rubric.dimensions,
        });
      } else {
        reset({
          name: '',
          passing_score: 8,
          dimensions: [],
        });
      }
    }
  }, [open, rubric, reset]);

  const dimensions = watch('dimensions') || [];
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);

  const addDimension = () => {
    setValue('dimensions', [...dimensions, { name: '', weight: 0, description: '' }]);
  };

  const removeDimension = (index: number) => {
    setValue('dimensions', dimensions.filter((_, i) => i !== index));
  };

  const updateDimension = (index: number, field: 'name' | 'weight' | 'description', value: string | number) => {
    const updated = [...dimensions];
    updated[index] = { ...updated[index], [field]: value };
    setValue('dimensions', updated);
  };

  const onSubmit = async (data: RubricFormData) => {
    await onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{rubric ? 'Editar Rubrica' : 'Nova Rubrica'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="passing_score">Nota de Aprovação (0-10) *</Label>
            <Input
              id="passing_score"
              type="number"
              step="0.1"
              {...register('passing_score', { valueAsNumber: true })}
              min={0}
              max={10}
            />
            {errors.passing_score && <p className="text-sm text-destructive mt-1">{errors.passing_score.message}</p>}
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Dimensões de Avaliação</Label>
              <Button type="button" onClick={addDimension} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {dimensions.map((dimension, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 space-y-2">
                    <Input
                      placeholder="Nome da dimensão"
                      value={dimension.name}
                      onChange={(e) => updateDimension(index, 'name', e.target.value)}
                    />
                    <div className="grid grid-cols-4 gap-2">
                      <Input
                        type="number"
                        placeholder="Peso %"
                        value={dimension.weight || ''}
                        onChange={(e) => updateDimension(index, 'weight', parseFloat(e.target.value) || 0)}
                        min={0}
                        max={100}
                      />
                      <Textarea
                        placeholder="Descrição"
                        value={dimension.description}
                        onChange={(e) => updateDimension(index, 'description', e.target.value)}
                        className="col-span-3"
                        rows={2}
                      />
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDimension(index)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}

            {dimensions.length > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Distribuição de Pesos</span>
                  <span className={totalWeight !== 100 ? 'text-destructive font-medium' : 'text-success'}>
                    {totalWeight.toFixed(1)}%
                  </span>
                </div>
                <Progress value={totalWeight} className="h-2" />
                {totalWeight !== 100 && (
                  <p className="text-xs text-destructive">Os pesos devem somar 100%</p>
                )}
              </div>
            )}

            {errors.dimensions && <p className="text-sm text-destructive">{errors.dimensions.message}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
