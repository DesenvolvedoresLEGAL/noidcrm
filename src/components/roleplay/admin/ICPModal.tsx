import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { icpSchema, type ICPFormData } from '@/schemas/roleplay';
import { ArrayInput } from './ArrayInput';
import type { ICP } from '@/services/roleplay/icps';

interface ICPModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ICPFormData) => Promise<void>;
  icp?: ICP;
}

export function ICPModal({ open, onClose, onSave, icp }: ICPModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ICPFormData>({
    resolver: zodResolver(icpSchema),
    defaultValues: {
      name: '',
      segment: '',
      company_size: '',
      revenue_band: '',
      tech_maturity: 3,
      pain_points: [],
      buying_triggers: [],
      success_criteria: [],
      competing_alternatives: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (icp) {
        reset({
          name: icp.name,
          segment: icp.segment,
          company_size: icp.company_size || '',
          revenue_band: icp.revenue_band || '',
          tech_maturity: icp.tech_maturity || 3,
          pain_points: icp.pain_points || [],
          buying_triggers: icp.buying_triggers || [],
          success_criteria: icp.success_criteria || [],
          competing_alternatives: icp.competing_alternatives || [],
        });
      } else {
        reset({
          name: '',
          segment: '',
          company_size: '',
          revenue_band: '',
          tech_maturity: 3,
          pain_points: [],
          buying_triggers: [],
          success_criteria: [],
          competing_alternatives: [],
        });
      }
    }
  }, [open, icp, reset]);

  const painPoints = watch('pain_points') || [];
  const buyingTriggers = watch('buying_triggers') || [];
  const successCriteria = watch('success_criteria') || [];
  const competingAlternatives = watch('competing_alternatives') || [];
  const techMaturity = watch('tech_maturity') || 3;

  const onSubmit = async (data: ICPFormData) => {
    await onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{icp ? 'Editar ICP' : 'Novo ICP'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div>
            <Label htmlFor="segment">Segmento *</Label>
            <Input id="segment" {...register('segment')} />
            {errors.segment && <p className="text-sm text-destructive mt-1">{errors.segment.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="company_size">Tamanho da Empresa</Label>
              <Input id="company_size" {...register('company_size')} placeholder="Ex: 50-200 funcionários" />
            </div>
            <div>
              <Label htmlFor="revenue_band">Faixa de Receita</Label>
              <Input id="revenue_band" {...register('revenue_band')} placeholder="Ex: R$ 5M - R$ 20M" />
            </div>
          </div>

          <div>
            <Label>Maturidade Tecnológica: {techMaturity}</Label>
            <Slider
              value={[techMaturity]}
              onValueChange={(value) => setValue('tech_maturity', value[0])}
              min={1}
              max={5}
              step={1}
              className="mt-2"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Baixa</span>
              <span>Alta</span>
            </div>
          </div>

          <ArrayInput
            label="Pain Points"
            value={painPoints}
            onChange={(value) => setValue('pain_points', value)}
            placeholder="Adicione um pain point"
            required
          />
          {errors.pain_points && <p className="text-sm text-destructive">{errors.pain_points.message}</p>}

          <ArrayInput
            label="Gatilhos de Compra"
            value={buyingTriggers}
            onChange={(value) => setValue('buying_triggers', value)}
            placeholder="Adicione um gatilho"
          />

          <ArrayInput
            label="Critérios de Sucesso"
            value={successCriteria}
            onChange={(value) => setValue('success_criteria', value)}
            placeholder="Adicione um critério"
          />

          <ArrayInput
            label="Alternativas Concorrentes"
            value={competingAlternatives}
            onChange={(value) => setValue('competing_alternatives', value)}
            placeholder="Adicione uma alternativa"
          />

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
