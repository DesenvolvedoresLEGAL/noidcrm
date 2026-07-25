import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { archetypeSchema, type ArchetypeFormData } from '@/schemas/roleplay';
import { ArrayInput } from './ArrayInput';
import type { Archetype } from '@/services/roleplay/archetypes';
import {
  EVENTS_ARCHETYPE_TYPE_OPTIONS,
  isEventsArchetypeType,
} from '@/vertical-packs/events/roleplay';

interface ArchetypeModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: ArchetypeFormData) => Promise<void>;
  archetype?: Archetype;
}

export function ArchetypeModal({ open, onClose, onSave, archetype }: ArchetypeModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ArchetypeFormData>({
    resolver: zodResolver(archetypeSchema),
    defaultValues: {
      name: '',
      type: undefined,
      level: undefined,
      tone_style: undefined,
      decision_role: undefined,
      complexity_score: 3,
      min_message_exchanges: 50,
      objection_set: [],
    },
  });

  useEffect(() => {
    if (open) {
      if (archetype) {
        reset({
          name: archetype.name,
          type: archetype.type,
          level: archetype.level,
          tone_style: archetype.tone_style,
          decision_role: archetype.decision_role,
          complexity_score: archetype.complexity_score,
          min_message_exchanges: archetype.min_message_exchanges,
          objection_set: archetype.objection_set || [],
        });
      } else {
        reset({
          name: '',
          type: undefined,
          level: undefined,
          tone_style: undefined,
          decision_role: undefined,
          complexity_score: 3,
          min_message_exchanges: 50,
          objection_set: [],
        });
      }
    }
  }, [open, archetype, reset]);

  const objectionSet = watch('objection_set') || [];
  const complexityScore = watch('complexity_score') || 3;
  const minMessageExchanges = watch('min_message_exchanges') || 50;

  const onSubmit = async (data: ArchetypeFormData) => {
    await onSave(data);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{archetype ? 'Editar Arquétipo' : 'Novo Arquétipo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-sm text-destructive mt-1">{errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Tipo *</Label>
              <Select onValueChange={(value) => setValue('type', value)} value={watch('type')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {EVENTS_ARCHETYPE_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                  {(() => {
                    const current = watch('type');
                    if (current && !isEventsArchetypeType(current)) {
                      return (
                        <SelectItem key={current} value={current}>
                          {current} <span className="text-xs text-muted-foreground">(tipo existente)</span>
                        </SelectItem>
                      );
                    }
                    return null;
                  })()}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-destructive mt-1">{errors.type.message}</p>}
            </div>

            <div>
              <Label>Nível *</Label>
              <Select onValueChange={(value) => setValue('level', value as any)} value={watch('level')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Entrada">Entrada</SelectItem>
                  <SelectItem value="Intermediário">Intermediário</SelectItem>
                  <SelectItem value="Avançado">Avançado</SelectItem>
                  <SelectItem value="Enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
              {errors.level && <p className="text-sm text-destructive mt-1">{errors.level.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Estilo de Tom *</Label>
              <Select onValueChange={(value) => setValue('tone_style', value as any)} value={watch('tone_style')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="técnico">Técnico</SelectItem>
                  <SelectItem value="apressado">Apressado</SelectItem>
                  <SelectItem value="cético">Cético</SelectItem>
                  <SelectItem value="indeciso">Indeciso</SelectItem>
                  <SelectItem value="agressivo">Agressivo</SelectItem>
                  <SelectItem value="metódico">Metódico</SelectItem>
                </SelectContent>
              </Select>
              {errors.tone_style && <p className="text-sm text-destructive mt-1">{errors.tone_style.message}</p>}
            </div>

            <div>
              <Label>Papel na Decisão *</Label>
              <Select onValueChange={(value) => setValue('decision_role', value as any)} value={watch('decision_role')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Decisor">Decisor</SelectItem>
                  <SelectItem value="Influenciador">Influenciador</SelectItem>
                  <SelectItem value="Usuário-Chave">Usuário-Chave</SelectItem>
                </SelectContent>
              </Select>
              {errors.decision_role && <p className="text-sm text-destructive mt-1">{errors.decision_role.message}</p>}
            </div>
          </div>

          <div>
            <Label>Complexidade: {complexityScore}</Label>
            <Slider
              value={[complexityScore]}
              onValueChange={(value) => setValue('complexity_score', value[0])}
              min={1}
              max={5}
              step={1}
              className="mt-2"
            />
          </div>

          <div>
            <Label htmlFor="min_exchanges">Mensagens Mínimas *</Label>
            <Input
              id="min_exchanges"
              type="number"
              {...register('min_message_exchanges', { valueAsNumber: true })}
              min={10}
              max={200}
            />
            {errors.min_message_exchanges && <p className="text-sm text-destructive mt-1">{errors.min_message_exchanges.message}</p>}
          </div>

          <ArrayInput
            label="Conjunto de Objeções"
            value={objectionSet}
            onChange={(value) => setValue('objection_set', value)}
            placeholder="Adicione uma objeção"
            required
          />
          {errors.objection_set && <p className="text-sm text-destructive">{errors.objection_set.message}</p>}

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
