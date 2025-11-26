import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Activity } from '@/services/crm/types';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Loader2 } from 'lucide-react';
import { getActivitySuggestions } from '@/services/crm/activity-ai';
import type { ActivitySuggestions } from '@/services/crm/activity-ai';
import { toast } from 'sonner';

const activitySchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(100),
  type: z.enum(['call', 'meeting', 'email', 'whatsapp', 'task', 'note']),
  assigned_to: z.string().min(1, 'Selecione um responsável'),
  scheduled_date: z.string().min(1, 'Selecione uma data'),
  scheduled_time: z.string().min(1, 'Selecione um horário'),
  duration_minutes: z.string().min(1, 'Selecione uma duração'),
  description: z.string().optional(),
  participant_ids: z.array(z.string()).optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface CreateActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Activity>) => void;
}

export function CreateActivityModal({ open, onOpenChange, onSubmit }: CreateActivityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<ActivitySuggestions | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const { users, loading: loadingUsers } = useOrganizationUsers();
  const { user: currentUser } = useCurrentUser();

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      type: 'call',
      assigned_to: currentUser?.id || '',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '09:00',
      duration_minutes: '30',
      description: '',
    },
  });

  // Load AI suggestions when activity type changes or modal opens
  useEffect(() => {
    if (!open) {
      setSuggestions(null);
      return;
    }

    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        const loadSuggestions = async () => {
          setLoadingSuggestions(true);
          try {
            const data = await getActivitySuggestions(value.type);
            setSuggestions(data);
            
            // Auto-apply suggestions
            if (data.suggestedTime) {
              form.setValue('scheduled_time', data.suggestedTime);
            }
            if (data.suggestedDuration) {
              form.setValue('duration_minutes', data.suggestedDuration.toString());
            }
            if (data.descriptionTemplate && !form.getValues('description')) {
              form.setValue('description', data.descriptionTemplate);
            }
          } catch (error) {
            console.error('Failed to load suggestions:', error);
            toast.error('Erro ao carregar sugestões de IA');
          } finally {
            setLoadingSuggestions(false);
          }
        };

        loadSuggestions();
      }
    });

    return () => subscription.unsubscribe();
  }, [open, form]);

  const handleSubmit = async (data: ActivityFormData) => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        ...data,
        duration_minutes: parseInt(data.duration_minutes),
        status: 'pending',
        participant_ids: selectedParticipants,
      });
      form.reset();
      setSelectedParticipants([]);
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleParticipant = (userId: string) => {
    setSelectedParticipants(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const removeParticipant = (userId: string) => {
    setSelectedParticipants(prev => prev.filter(id => id !== userId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>Nova Atividade</DialogTitle>
            {loadingSuggestions && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Carregando sugestões...</span>
              </div>
            )}
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            {suggestions && suggestions.tips.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  <span>Sugestões de IA</span>
                </div>
                <ul className="text-sm text-muted-foreground space-y-1">
                  {suggestions.tips.map((tip, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-primary">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da atividade *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Reunião de apresentação" {...field} />
                  </FormControl>
                  {suggestions?.titleSuggestion && (
                    <p className="text-xs text-muted-foreground">
                      💡 Sugestão: {suggestions.titleSuggestion}
                    </p>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de atividade *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="call">Ligação</SelectItem>
                        <SelectItem value="meeting">Reunião</SelectItem>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="task">Tarefa</SelectItem>
                        <SelectItem value="note">Anotação</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="assigned_to"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsável *</FormLabel>
                    <Select 
                      onValueChange={field.onChange} 
                      value={field.value}
                      disabled={loadingUsers}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={loadingUsers ? "Carregando..." : "Selecione o responsável"} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="scheduled_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hora *</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="duration_minutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Duração *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="15">15 min</SelectItem>
                        <SelectItem value="30">30 min</SelectItem>
                        <SelectItem value="45">45 min</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="90">1h 30min</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                        <SelectItem value="180">3 horas</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Descrição</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Descreva os detalhes da atividade..."
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="space-y-3">
              <FormLabel>Envolvidos (Opcional)</FormLabel>
              <p className="text-sm text-muted-foreground">
                Selecione outros membros da equipe que participarão desta atividade
              </p>
              
              {selectedParticipants.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedParticipants.map(userId => {
                    const user = users.find(u => u.id === userId);
                    return user ? (
                      <Badge key={userId} variant="secondary" className="gap-1">
                        {user.name}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeParticipant(userId)}
                        />
                      </Badge>
                    ) : null;
                  })}
                </div>
              )}

              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                {users
                  .filter(u => u.id !== form.watch('assigned_to'))
                  .map(user => (
                    <div
                      key={user.id}
                      className="flex items-center space-x-2 p-3 hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedParticipants.includes(user.id)}
                        onCheckedChange={() => toggleParticipant(user.id)}
                      />
                      <label 
                        className="flex-1 cursor-pointer"
                        onClick={() => toggleParticipant(user.id)}
                      >
                        {user.name}
                      </label>
                    </div>
                  ))}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Criando...' : 'Criar Atividade'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
