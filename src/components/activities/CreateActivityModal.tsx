import { useState, useEffect, useRef } from 'react';
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
import { useOrganizationAccounts } from '@/hooks/useOrganizationAccounts';
import { useOrganizationContacts } from '@/hooks/useOrganizationContacts';
import { useOrganizationOpportunities } from '@/hooks/useOrganizationOpportunities';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { X, Sparkles, Video, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const activitySchema = z.object({
  title: z.string().min(3, 'Título deve ter no mínimo 3 caracteres').max(100),
  type: z.enum(['call', 'meeting', 'email', 'whatsapp', 'task', 'note']),
  account_id: z.string().uuid().min(1, 'Selecione uma conta/cliente'),
  contact_id: z.string().optional(),
  opportunity_id: z.string().optional(),
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
  defaultAccountId?: string;
  prefillData?: {
    type?: string;
    title?: string;
    description?: string;
    scheduled_date?: string;
    account_id?: string;
    contact_id?: string;
    opportunity_id?: string;
  } | null;
}

interface ActivitySuggestions {
  suggestedTime: string;
  suggestedDuration: number;
  titleSuggestion?: string;
  descriptionTemplate: string;
  tips: string[];
}

export function CreateActivityModal({ open, onOpenChange, onSubmit, defaultAccountId, prefillData }: CreateActivityModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<ActivitySuggestions | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [generatingMeetLink, setGeneratingMeetLink] = useState(false);
  const [googleMeetLink, setGoogleMeetLink] = useState<string>('');
  
  const { users, loading: loadingUsers } = useOrganizationUsers();
  const { accounts, loading: loadingAccounts } = useOrganizationAccounts();
  const { data: currentUser } = useCurrentUser();
  const { toast } = useToast();

  const form = useForm<ActivityFormData>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      title: '',
      type: 'call',
      account_id: defaultAccountId || '',
      contact_id: '',
      opportunity_id: '',
      scheduled_date: (() => {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      })(),
      scheduled_time: '09:00',
      duration_minutes: '30',
      description: '',
    },
  });

  const selectedAccountId = form.watch('account_id');
  const activityType = form.watch('type');
  
  const { contacts, loading: loadingContacts } = useOrganizationContacts(selectedAccountId);
  const { opportunities, loading: loadingOpportunities } = useOrganizationOpportunities(selectedAccountId);

  // Track if prefill has been applied for the current modal session
  const prefillAppliedRef = useRef({ account: false, contact: false, opportunity: false });
  // Track the last account set by user to detect manual changes
  const lastManualAccountRef = useRef<string | null>(null);

  // Reset prefill tracking when modal closes
  useEffect(() => {
    if (!open) {
      prefillAppliedRef.current = { account: false, contact: false, opportunity: false };
      lastManualAccountRef.current = null;
    }
  }, [open]);

  // STEP 1: Pré-preencher account_id - com verificação de existência na lista
  useEffect(() => {
    if (!open || !prefillData?.account_id || loadingAccounts) return;
    if (accounts.length === 0) return;
    
    // Verificar que o account existe na lista carregada
    const accountExists = accounts.some(a => a.id === prefillData.account_id);
    if (!accountExists) return;
    
    const currentValue = form.getValues('account_id');
    if (!currentValue || currentValue !== prefillData.account_id) {
      form.setValue('account_id', prefillData.account_id, { shouldValidate: true });
      lastManualAccountRef.current = prefillData.account_id;
      console.log('[Prefill] account_id setado:', prefillData.account_id);
    }
  }, [open, prefillData?.account_id, loadingAccounts, accounts, form]);

  // STEP 2: Pré-preencher contact_id após contacts carregarem
  useEffect(() => {
    if (!open || !prefillData?.contact_id || prefillAppliedRef.current.contact) return;
    if (loadingContacts || contacts.length === 0) return;
    
    const contactExists = contacts.some(c => c.id === prefillData.contact_id);
    if (contactExists) {
      form.setValue('contact_id', prefillData.contact_id);
      prefillAppliedRef.current.contact = true;
      console.log('[Prefill] contact_id setado:', prefillData.contact_id);
    }
  }, [open, prefillData?.contact_id, loadingContacts, contacts, form]);

  // STEP 3: Pré-preencher opportunity_id após opportunities carregarem
  useEffect(() => {
    if (!open || !prefillData?.opportunity_id || prefillAppliedRef.current.opportunity) return;
    if (loadingOpportunities || opportunities.length === 0) return;
    
    const oppExists = opportunities.some(o => o.id === prefillData.opportunity_id);
    if (oppExists) {
      form.setValue('opportunity_id', prefillData.opportunity_id);
      prefillAppliedRef.current.opportunity = true;
      console.log('[Prefill] opportunity_id setado:', prefillData.opportunity_id);
    }
  }, [open, prefillData?.opportunity_id, loadingOpportunities, opportunities, form]);

  // Pré-preencher outros campos (type, title, description, scheduled_date)
  useEffect(() => {
    if (!prefillData || !open) return;
    
    if (prefillData.type) {
      const validTypes = ['call', 'meeting', 'email', 'whatsapp', 'task', 'note'] as const;
      const typeToSet = validTypes.includes(prefillData.type as any) 
        ? prefillData.type as typeof validTypes[number]
        : 'task';
      form.setValue('type', typeToSet);
    }
    if (prefillData.title) {
      form.setValue('title', prefillData.title);
    }
    if (prefillData.description) {
      form.setValue('description', prefillData.description);
    }
    if (prefillData.scheduled_date) {
      form.setValue('scheduled_date', prefillData.scheduled_date);
    }
  }, [prefillData, open, form]);

  // Limpar contato e oportunidade SOMENTE quando conta muda MANUALMENTE pelo usuário
  useEffect(() => {
    // Ignorar se não há account selecionado
    if (!selectedAccountId) return;
    
    // Ignorar se é o account do prefill sendo aplicado
    if (prefillData?.account_id === selectedAccountId) return;
    
    // Ignorar na primeira mudança (lastManualAccountRef ainda é null)
    if (lastManualAccountRef.current === null) {
      lastManualAccountRef.current = selectedAccountId;
      return;
    }
    
    // Se o account mudou manualmente, limpar contato e oportunidade
    if (lastManualAccountRef.current !== selectedAccountId) {
      form.setValue('contact_id', '');
      form.setValue('opportunity_id', '');
      lastManualAccountRef.current = selectedAccountId;
      console.log('[Clear] Limpando contato e oportunidade - account mudou manualmente');
    }
  }, [selectedAccountId, prefillData?.account_id, form]);

  // Buscar sugestões da IA quando tipo muda
  useEffect(() => {
    const subscription = form.watch((value, { name }) => {
      if (name === 'type' && value.type) {
        fetchAISuggestions(value.type);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const fetchAISuggestions = async (activityType: string) => {
    setLoadingSuggestions(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-activity-suggestions', {
        body: { activityType, context: {} }
      });

      if (error) throw error;

      if (data?.suggestions) {
        setSuggestions(data.suggestions);
        
        // Auto-aplicar sugestões
        if (data.suggestions.suggestedTime) {
          form.setValue('scheduled_time', data.suggestions.suggestedTime);
        }
        if (data.suggestions.suggestedDuration) {
          form.setValue('duration_minutes', String(data.suggestions.suggestedDuration));
        }
        if (data.suggestions.descriptionTemplate) {
          form.setValue('description', data.suggestions.descriptionTemplate);
        }
      }
    } catch (error) {
      console.error('Error fetching AI suggestions:', error);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleGenerateGoogleMeet = async () => {
    setGeneratingMeetLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-google-meet', {
        body: {
          title: form.getValues('title') || 'Reunião de Vendas',
          date: form.getValues('scheduled_date'),
          time: form.getValues('scheduled_time'),
          duration: parseInt(form.getValues('duration_minutes'))
        }
      });

      if (error) throw error;

      if (data?.meetLink) {
        setGoogleMeetLink(data.meetLink);
        toast({
          title: 'Link do Google Meet gerado!',
          description: 'O link foi adicionado à atividade',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar Google Meet',
        description: error.message || 'Tente novamente mais tarde',
        variant: 'destructive',
      });
    } finally {
      setGeneratingMeetLink(false);
    }
  };

  const handleSubmit = async (data: ActivityFormData) => {
    setIsSubmitting(true);
    try {
      // Combinar data e hora mantendo o timezone local (Brasil)
      const scheduledDateTime = `${data.scheduled_date}T${data.scheduled_time}:00-03:00`;

      const activityData: any = {
        title: data.title,
        type: data.type,
        account_id: data.account_id,
        contact_id: data.contact_id || undefined,
        opportunity_id: data.opportunity_id || undefined,
        scheduled_date: scheduledDateTime, // Timestamp completo
        assigned_to: currentUser?.user?.id, // Mapeado para owner_user_id pelo serviço
        duration_minutes: parseInt(data.duration_minutes),
        description: data.description || undefined,
        external_link: googleMeetLink || undefined,
      };

      // Adicionar participantes usando o campo correto esperado pelo serviço
      if (selectedParticipants.length > 0) {
        activityData.participant_ids = selectedParticipants;
      }

      await onSubmit(activityData);
      
      // Resetar o formulário apenas se teve sucesso
      form.reset();
      setSelectedParticipants([]);
      setSuggestions(null);
      setGoogleMeetLink('');
      onOpenChange(false);
    } catch (error: any) {
      console.error('Erro ao criar atividade:', error);
      toast({
        title: 'Erro ao criar atividade',
        description: error?.message || 'Verifique os campos e tente novamente.',
        variant: 'destructive',
      });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Nova Atividade</DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Seção Cliente */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <h3 className="font-semibold text-lg">Cliente</h3>
                </div>

                {accounts.length === 0 && !loadingAccounts && (
                  <div className="mb-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <p className="text-sm text-destructive font-medium">
                      ⚠️ Nenhuma conta cadastrada
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cadastre pelo menos uma conta antes de criar atividades.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                   <FormItem>
                        <FormLabel>Conta/Cliente *</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!!defaultAccountId || loadingAccounts || accounts.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger className={defaultAccountId ? 'bg-muted' : ''}>
                              <SelectValue placeholder={
                                loadingAccounts ? "Carregando..." : 
                                accounts.length === 0 ? "Nenhuma conta disponível" : 
                                "Selecione"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="contact_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contato</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedAccountId || loadingContacts}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={!selectedAccountId ? "Selecione a conta" : "Opcional"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {contacts.map((contact) => (
                              <SelectItem key={contact.id} value={contact.id}>
                                {contact.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="opportunity_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Oportunidade</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          value={field.value}
                          disabled={!selectedAccountId || loadingOpportunities}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={!selectedAccountId ? "Selecione a conta" : "Opcional"} />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {opportunities.map((opp) => (
                              <SelectItem key={opp.id} value={opp.id}>
                                {opp.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Seção Detalhes */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <h3 className="font-semibold text-lg">Detalhes da Atividade</h3>
                </div>

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Título *</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Reunião de apresentação" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo *</FormLabel>
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

                  <FormItem>
                    <FormLabel>Responsável</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input 
                          value={
                            loadingUsers 
                              ? 'Carregando...' 
                              : currentUser?.profile?.full_name || 'Usuário atual'
                          }
                          disabled
                          className="bg-muted"
                        />
                        {loadingUsers && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                      </div>
                    </FormControl>
                  </FormItem>
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
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {activityType === 'meeting' && (
                  <div className="space-y-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGenerateGoogleMeet}
                      disabled={generatingMeetLink}
                      className="w-full"
                    >
                      {generatingMeetLink ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Gerando...</>
                      ) : (
                        <><Video className="h-4 w-4 mr-2" /> Gerar Link Google Meet</>
                      )}
                    </Button>
                    {googleMeetLink && (
                      <p className="text-sm text-muted-foreground">
                        Link: <a href={googleMeetLink} target="_blank" rel="noopener noreferrer" className="text-primary underline">{googleMeetLink}</a>
                      </p>
                    )}
                  </div>
                )}

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
              </CardContent>
            </Card>

            {/* Sugestões IA */}
            {suggestions && suggestions.tips.length > 0 && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">Sugestões IA</h3>
                  </div>
                  <ul className="space-y-2">
                    {suggestions.tips.map((tip, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {/* Participantes */}
            <Card className="bg-muted/30">
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <h3 className="font-semibold text-lg">Envolvidos (Opcional)</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Outros membros da equipe que participarão desta atividade
                </p>
                
                {selectedParticipants.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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

                <div className="border rounded-md max-h-[180px] overflow-y-auto">
                  {loadingUsers ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      <span className="ml-2 text-sm text-muted-foreground">Carregando membros da equipe...</span>
                    </div>
                  ) : users.length === 0 ? (
                    <div className="p-8 text-center text-sm text-muted-foreground">
                      Nenhum outro membro disponível
                    </div>
                  ) : (
                    users
                      .filter(u => u.id !== currentUser?.user?.id)
                      .map(user => (
                        <div
                          key={user.id}
                          className="flex items-center space-x-2 p-3 hover:bg-accent cursor-pointer"
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
                      ))
                  )}
                </div>
              </CardContent>
            </Card>

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