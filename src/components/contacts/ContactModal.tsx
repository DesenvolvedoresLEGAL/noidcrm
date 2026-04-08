import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createContact, updateContact, type Contact, type ContactEmail, type ContactPhone } from '@/services/supabase/contacts';
import { searchAccounts } from '@/services/supabase/accounts';
import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, X, Loader2, Star } from 'lucide-react';
import { cn } from '@/lib/utils';

const EMAIL_TYPES = [
  { value: 'work', label: 'Trabalho' },
  { value: 'personal', label: 'Pessoal' },
  { value: 'other', label: 'Outro' },
] as const;

const PHONE_TYPES = [
  { value: 'mobile', label: 'Celular' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'landline', label: 'Fixo' },
  { value: 'other', label: 'Outro' },
] as const;

const contactSchema = z.object({
  account_id: z.string().uuid().optional(),
  primeiro_nome: z.string().min(1, 'Primeiro nome é obrigatório'),
  ultimo_nome: z.string().optional(),
  cargo: z.string().optional(),
  departamento: z.string().optional(),
  linkedin: z.string().optional(),
  observacoes: z.string().optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
  defaultAccountId?: string;
}

export function ContactModal({ open, onOpenChange, contact, defaultAccountId }: ContactModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!contact;
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  
  // Email state
  const [emails, setEmails] = useState<ContactEmail[]>([]);
  const [newEmailValue, setNewEmailValue] = useState('');
  const [newEmailType, setNewEmailType] = useState<ContactEmail['type']>('work');
  
  // Phone state
  const [phones, setPhones] = useState<ContactPhone[]>([]);
  const [newPhoneValue, setNewPhoneValue] = useState('');
  const [newPhoneType, setNewPhoneType] = useState<ContactPhone['type']>('mobile');

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      primeiro_nome: '',
      ultimo_nome: '',
      cargo: '',
      departamento: '',
      linkedin: '',
      observacoes: '',
      account_id: '',
    },
  });

  // Reset form and local state when contact or modal state changes
  useEffect(() => {
    if (open) {
      const accountId = contact?.account_id || defaultAccountId || '';
      setSelectedAccountId(accountId);
      
      // Parse and normalize emails from JSONB (handles legacy formats)
      const rawEmails = contact?.emails;
      const normalizedEmails: ContactEmail[] = [];
      if (Array.isArray(rawEmails)) {
        rawEmails.forEach((e: any, idx: number) => {
          if (typeof e === 'string') {
            normalizedEmails.push({ value: e, type: 'work', is_primary: idx === 0 });
          } else if (e && typeof e === 'object' && e.value) {
            normalizedEmails.push({
              value: e.value,
              type: (['work', 'personal', 'other'].includes(e.type) ? e.type : 'work') as ContactEmail['type'],
              is_primary: !!e.is_primary,
            });
          } else if (e && typeof e === 'object' && (e.email || e.numero)) {
            normalizedEmails.push({ value: e.email || e.numero || '', type: 'work', is_primary: idx === 0 });
          }
        });
      }
      if (normalizedEmails.length > 0 && !normalizedEmails.some(e => e.is_primary)) {
        normalizedEmails[0].is_primary = true;
      }
      setEmails(normalizedEmails);
      
      // Parse and normalize phones from JSONB (handles legacy formats)
      const rawPhones = contact?.telefones;
      const normalizedPhones: ContactPhone[] = [];
      if (Array.isArray(rawPhones)) {
        rawPhones.forEach((p: any, idx: number) => {
          if (typeof p === 'string') {
            normalizedPhones.push({ value: p, type: 'mobile', is_primary: idx === 0 });
          } else if (p && typeof p === 'object' && p.value) {
            normalizedPhones.push({
              value: p.value,
              type: (['mobile', 'whatsapp', 'landline', 'other'].includes(p.type) ? p.type : 'mobile') as ContactPhone['type'],
              is_primary: !!p.is_primary,
            });
          } else if (p && typeof p === 'object' && (p.numero || p.phone)) {
            normalizedPhones.push({ value: p.numero || p.phone || '', type: 'mobile', is_primary: idx === 0 });
          }
        });
      }
      if (normalizedPhones.length > 0 && !normalizedPhones.some(p => p.is_primary)) {
        normalizedPhones[0].is_primary = true;
      }
      setPhones(normalizedPhones);
      
      setNewEmailValue('');
      setNewEmailType('work');
      setNewPhoneValue('');
      setNewPhoneType('mobile');
      
      reset({
        primeiro_nome: (contact as any)?.primeiro_nome || contact?.nome?.split(' ')[0] || '',
        ultimo_nome: (contact as any)?.ultimo_nome || (contact?.nome?.includes(' ') ? contact.nome.substring(contact.nome.indexOf(' ') + 1) : '') || '',
        cargo: contact?.cargo || '',
        departamento: (contact as any)?.departamento || '',
        linkedin: (contact as any)?.linkedin || '',
        observacoes: (contact as any)?.observacoes || '',
        account_id: accountId,
      });
    }
  }, [open, contact, defaultAccountId, reset]);

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-search', accountSearch],
    queryFn: () => searchAccounts(accountSearch),
    enabled: accountSearch.length > 0,
  });

  const mutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const payload: Record<string, any> = {
        primeiro_nome: data.primeiro_nome,
        ultimo_nome: data.ultimo_nome || '',
        cargo: data.cargo || null,
        departamento: data.departamento || null,
        linkedin: data.linkedin || null,
        observacoes: data.observacoes || null,
        account_id: selectedAccountId || null,
        emails: emails.length > 0 ? emails : [],
        telefones: phones.length > 0 ? phones : [],
      };

      if (isEditing && contact) {
        return updateContact(contact.id, payload);
      }
      return createContact(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['account-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      if (defaultAccountId) {
        queryClient.invalidateQueries({ queryKey: ['account-details', defaultAccountId] });
      }
      if (selectedAccountId) {
        queryClient.invalidateQueries({ queryKey: ['account-details', selectedAccountId] });
      }
      
      toast({
        title: isEditing ? 'Contato atualizado' : 'Contato criado',
        description: isEditing
          ? 'O contato foi atualizado com sucesso.'
          : 'O contato foi criado com sucesso.',
      });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('Error saving contact:', error);
      toast({
        variant: 'destructive',
        title: 'Erro',
        description: error.message,
      });
    },
  });

  const onSubmit = (data: ContactFormData) => {
    mutation.mutate(data);
  };

  const selectedAccount = accounts.find(a => a.id === selectedAccountId);

  // Email handlers
  const addEmail = () => {
    if (newEmailValue && !emails.some(e => e.value === newEmailValue)) {
      const isFirst = emails.length === 0;
      setEmails([...emails, { 
        value: newEmailValue, 
        type: newEmailType, 
        is_primary: isFirst 
      }]);
      setNewEmailValue('');
    }
  };

  const removeEmail = (index: number) => {
    const wasPrimary = emails[index].is_primary;
    const newEmails = emails.filter((_, i) => i !== index);
    // If removed was primary and there are still emails, make first one primary
    if (wasPrimary && newEmails.length > 0) {
      newEmails[0].is_primary = true;
    }
    setEmails(newEmails);
  };

  const setEmailPrimary = (index: number) => {
    setEmails(emails.map((email, i) => ({
      ...email,
      is_primary: i === index
    })));
  };

  const updateEmailType = (index: number, type: ContactEmail['type']) => {
    setEmails(emails.map((email, i) => 
      i === index ? { ...email, type } : email
    ));
  };

  // Phone handlers
  const addPhone = () => {
    if (newPhoneValue && !phones.some(p => p.value === newPhoneValue)) {
      const isFirst = phones.length === 0;
      setPhones([...phones, { 
        value: newPhoneValue, 
        type: newPhoneType, 
        is_primary: isFirst 
      }]);
      setNewPhoneValue('');
    }
  };

  const removePhone = (index: number) => {
    const wasPrimary = phones[index].is_primary;
    const newPhones = phones.filter((_, i) => i !== index);
    if (wasPrimary && newPhones.length > 0) {
      newPhones[0].is_primary = true;
    }
    setPhones(newPhones);
  };

  const setPhonePrimary = (index: number) => {
    setPhones(phones.map((phone, i) => ({
      ...phone,
      is_primary: i === index
    })));
  };

  const updatePhoneType = (index: number, type: ContactPhone['type']) => {
    setPhones(phones.map((phone, i) => 
      i === index ? { ...phone, type } : phone
    ));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="primeiro_nome">Primeiro Nome *</Label>
              <Input id="primeiro_nome" {...register('primeiro_nome')} />
              {errors.primeiro_nome && (
                <p className="text-sm text-destructive">{errors.primeiro_nome.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="ultimo_nome">Último Nome</Label>
              <Input id="ultimo_nome" {...register('ultimo_nome')} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cargo">Cargo</Label>
              <Input id="cargo" {...register('cargo')} placeholder="Ex: Diretor de TI" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="departamento">Departamento</Label>
              <Input id="departamento" {...register('departamento')} placeholder="Ex: Comercial" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Empresa {defaultAccountId && <span className="text-muted-foreground">(pré-selecionada)</span>}</Label>
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={accountOpen}
                  className="w-full justify-between"
                  disabled={!!defaultAccountId}
                >
                  {selectedAccount ? selectedAccount.razao_social : "Selecionar empresa..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput
                    placeholder="Buscar empresa..."
                    value={accountSearch}
                    onValueChange={setAccountSearch}
                  />
                  <CommandEmpty>Nenhuma empresa encontrada.</CommandEmpty>
                  <CommandGroup>
                    {accounts.map((account) => (
                      <CommandItem
                        key={account.id}
                        value={account.id}
                        onSelect={() => {
                          setSelectedAccountId(account.id);
                          setAccountOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedAccountId === account.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {account.razao_social}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Emails Section */}
          <div className="space-y-3">
            <Label>E-mails</Label>
            
            {/* Existing emails */}
            {emails.length > 0 && (
              <div className="space-y-2">
                {emails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <button
                      type="button"
                      onClick={() => setEmailPrimary(idx)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        email.is_primary 
                          ? "text-yellow-500" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={email.is_primary ? "E-mail principal" : "Definir como principal"}
                    >
                      <Star className={cn("h-4 w-4", email.is_primary && "fill-current")} />
                    </button>
                    <span className="flex-1 text-sm">{email.value}</span>
                    <Select
                      value={email.type}
                      onValueChange={(value) => updateEmailType(idx, value as ContactEmail['type'])}
                    >
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EMAIL_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removeEmail(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new email */}
            <div className="flex gap-2">
              <Input
                type="email"
                value={newEmailValue}
                onChange={(e) => setNewEmailValue(e.target.value)}
                placeholder="novo@email.com"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
                className="flex-1"
              />
              <Select value={newEmailType} onValueChange={(v) => setNewEmailType(v as ContactEmail['type'])}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EMAIL_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addEmail} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Phones Section */}
          <div className="space-y-3">
            <Label>Telefones</Label>
            
            {/* Existing phones */}
            {phones.length > 0 && (
              <div className="space-y-2">
                {phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-md">
                    <button
                      type="button"
                      onClick={() => setPhonePrimary(idx)}
                      className={cn(
                        "p-1 rounded transition-colors",
                        phone.is_primary 
                          ? "text-yellow-500" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                      title={phone.is_primary ? "Telefone principal" : "Definir como principal"}
                    >
                      <Star className={cn("h-4 w-4", phone.is_primary && "fill-current")} />
                    </button>
                    <span className="flex-1 text-sm">{phone.value}</span>
                    <Select
                      value={phone.type}
                      onValueChange={(value) => updatePhoneType(idx, value as ContactPhone['type'])}
                    >
                      <SelectTrigger className="w-28 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PHONE_TYPES.map(t => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => removePhone(idx)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new phone */}
            <div className="flex gap-2">
              <Input
                value={newPhoneValue}
                onChange={(e) => setNewPhoneValue(e.target.value)}
                placeholder="(00) 00000-0000"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
                className="flex-1"
              />
              <Select value={newPhoneType} onValueChange={(v) => setNewPhoneType(v as ContactPhone['type'])}>
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PHONE_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="button" onClick={addPhone} variant="outline" size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="linkedin">LinkedIn</Label>
            <Input 
              id="linkedin" 
              {...register('linkedin')} 
              placeholder="https://linkedin.com/in/perfil" 
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea 
              id="observacoes" 
              {...register('observacoes')} 
              placeholder="Informações adicionais sobre o contato..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
