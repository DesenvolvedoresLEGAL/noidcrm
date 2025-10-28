import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { videoSchema, type VideoFormData } from '@/schemas/roleplay';
import { ArrayInput } from './ArrayInput';
import type { Video } from '@/services/roleplay/videos';

interface VideoModalProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: VideoFormData) => Promise<void>;
  video?: Video;
}

export function VideoModal({ open, onClose, onSave, video }: VideoModalProps) {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VideoFormData>({
    resolver: zodResolver(videoSchema),
    defaultValues: {
      title: '',
      url: '',
      duration_sec: 60,
      level: undefined,
      source: undefined,
      tags: [],
      language: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (video) {
        reset({
          title: video.title,
          url: video.url,
          duration_sec: video.duration_sec,
          level: video.level,
          source: video.source,
          tags: video.tags || [],
          language: video.language || '',
        });
      } else {
        reset({
          title: '',
          url: '',
          duration_sec: 60,
          level: undefined,
          source: undefined,
          tags: [],
          language: '',
        });
      }
    }
  }, [open, video, reset]);

  const tags = watch('tags') || [];

  const onSubmit = async (data: VideoFormData) => {
    await onSave(data);
    onClose();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{video ? 'Editar Vídeo' : 'Novo Vídeo'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...register('title')} />
            {errors.title && <p className="text-sm text-destructive mt-1">{errors.title.message}</p>}
          </div>

          <div>
            <Label htmlFor="url">URL *</Label>
            <Input id="url" type="url" {...register('url')} placeholder="https://..." />
            {errors.url && <p className="text-sm text-destructive mt-1">{errors.url.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="duration_sec">Duração (segundos) *</Label>
              <Input
                id="duration_sec"
                type="number"
                {...register('duration_sec', { valueAsNumber: true })}
                min={1}
              />
              {watch('duration_sec') && (
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDuration(watch('duration_sec'))}
                </p>
              )}
              {errors.duration_sec && <p className="text-sm text-destructive mt-1">{errors.duration_sec.message}</p>}
            </div>

            <div>
              <Label>Nível *</Label>
              <Select onValueChange={(value) => setValue('level', value as any)} value={watch('level')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Básico">Básico</SelectItem>
                  <SelectItem value="Intermediário">Intermediário</SelectItem>
                  <SelectItem value="Avançado">Avançado</SelectItem>
                </SelectContent>
              </Select>
              {errors.level && <p className="text-sm text-destructive mt-1">{errors.level.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Fonte</Label>
              <Select onValueChange={(value) => setValue('source', value as any)} value={watch('source')}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="YouTube">YouTube</SelectItem>
                  <SelectItem value="Vimeo">Vimeo</SelectItem>
                  <SelectItem value="Internal">Internal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="language">Idioma</Label>
              <Input id="language" {...register('language')} placeholder="Ex: Português" />
            </div>
          </div>

          <ArrayInput
            label="Tags"
            value={tags}
            onChange={(value) => setValue('tags', value)}
            placeholder="Adicione uma tag"
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
