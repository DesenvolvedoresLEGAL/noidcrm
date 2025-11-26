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
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

const activitySchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(100),
  type: z.enum(['call', 'meeting', 'email', 'whatsapp', 'task', 'note']),
  account_id: z.string().uuid().optional(),
  contact_id: z.string().optional(),
  opportunity_id: z.string().optional(),
  assigned_to: z.string().min(1, 'Responsável é obrigatório'),
  scheduled_date: z.string().min(1, 'Selecione uma data'),
  scheduled_time: z.string().min(1, 'Selecione um horário'),
  duration_minutes: z.string().min(1, 'Selecione uma duração'),
  description: z.string().optional(),
  participant_ids: z.array(z.string()).optional(),
});

type ActivityFormData = z.infer<typeof activitySchema>;

interface EditActivityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activity: Activity | null;
  onSubmit: (id: string, data: Partial<Activity>) => void;
}

export function EditActivityModal({ open, onOpenChange, activity, onSubmit }: EditActivityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const { users, loading: loadingUsers } = useOrganizationUsers();

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      type: 'call',
      assigned_to: '',
      scheduled_date: new Date().toISOString().split('T')[0],
      scheduled_time: '09:00',
      duration_minutes: '30',
      description: '',
    },
  });

  useEffect(() => {
    if (activity) {
      form.reset({
        title: activity.title,
        type: activity.type,
        account_id: activity.account_id || '',
        contact_id: activity.contact_id || '',
        opportunity_id: activity.opportunity_id || '',
        assigned_to: activity.assigned_to || '',
        scheduled_date: activity.scheduled_date || new Date().toISOString().split('T')[0],
        scheduled_time: activity.scheduled_time || '09:00',
        duration_minutes: String(activity.duration_minutes || 30),
        description: activity.description || '',
      });
      setSelectedParticipants(activity.participant_ids || []);
    }
  }, [activity, form]);

  const handleSubmit = async (data: ActivityFormData) => {
    if (!activity) return;
    
    setIsSubmitting(true);
    try {
      await onSubmit(activity.id, {
        ...data,
        duration_minutes: parseInt(data.duration_minutes),
        participant_ids: selectedParticipants,
      });
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
          <DialogTitle>Editar Atividade</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Título da atividade *</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: Reunião de apresentação" {...field} />
                  </FormControl>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
