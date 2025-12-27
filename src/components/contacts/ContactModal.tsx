import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createContact, updateContact, type Contact } from '@/services/supabase/contacts';
import { searchAccounts } from '@/services/supabase/accounts';
import { useState, useEffect } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const contactSchema = z.object({
  account_id: z.string().uuid().optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cargo: z.string().optional(),
  email_principal: z.string().email().optional().or(z.literal('')),
  telefone_principal: z.string().optional(),
  departamento: z.string().optional(),
  linkedin: z.string().optional(),
  observacoes: z.string().optional(),
  emails: z.array(z.string().email()).optional(),
  telefones: z.array(z.string()).optional(),
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
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emails, setEmails] = useState<string[]>([]);
  const [phones, setPhones] = useState<string[]>([]);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: '',
      cargo: '',
      email_principal: '',
      telefone_principal: '',
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
      setEmails(contact?.emails || []);
      setPhones(contact?.telefones || []);
      setEmailInput('');
      setPhoneInput('');
      
      reset({
        nome: contact?.nome || '',
        cargo: contact?.cargo || '',
        email_principal: (contact as any)?.email_principal || '',
        telefone_principal: (contact as any)?.telefone_principal || '',
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
      // Build payload with proper data cleaning
      const payload: Record<string, any> = {
        nome: data.nome,
        cargo: data.cargo || null,
        email_principal: data.email_principal || null,
        telefone_principal: data.telefone_principal || null,
        departamento: data.departamento || null,
        linkedin: data.linkedin || null,
        observacoes: data.observacoes || null,
        account_id: selectedAccountId || null,
        emails: emails.length > 0 ? emails : null,
        telefones: phones.length > 0 ? phones : null,
      };

      // Remove undefined/empty string values
      Object.keys(payload).forEach(key => {
        if (payload[key] === '' || payload[key] === undefined) {
          payload[key] = null;
        }
      });

      if (isEditing && contact) {
        return updateContact(contact.id, payload);
      }
      return createContact(payload);
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['account-contacts'] });
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

  const addEmail = () => {
    if (emailInput && !emails.includes(emailInput)) {
      setEmails([...emails, emailInput]);
      setEmailInput('');
    }
  };

  const addPhone = () => {
    if (phoneInput && !phones.includes(phoneInput)) {
      setPhones([...phones, phoneInput]);
      setPhoneInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" {...register('nome')} />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome.message}</p>
            )}
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email_principal">E-mail Principal</Label>
              <Input 
                id="email_principal" 
                type="email"
                {...register('email_principal')} 
                placeholder="contato@empresa.com" 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefone_principal">Telefone Principal</Label>
              <Input 
                id="telefone_principal" 
                {...register('telefone_principal')} 
                placeholder="(00) 00000-0000" 
              />
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
            <Label>Emails</Label>
            <div className="flex gap-2">
              <Input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="adicionar@email.com"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
              />
              <Button type="button" onClick={addEmail} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {emails.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {emails.map((email, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm">
                    {email}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setEmails(emails.filter((_, i) => i !== idx))}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Telefones</Label>
            <div className="flex gap-2">
              <Input
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="(00) 00000-0000"
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
              />
              <Button type="button" onClick={addPhone} variant="outline">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {phones.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded text-sm">
                    {phone}
                    <X
                      className="h-3 w-3 cursor-pointer"
                      onClick={() => setPhones(phones.filter((_, i) => i !== idx))}
                    />
                  </div>
                ))}
              </div>
            )}
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
