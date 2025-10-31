import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createContact, updateContact, type Contact } from '@/services/supabase/contacts';
import { searchAccounts } from '@/services/supabase/accounts';
import { useState } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const contactSchema = z.object({
  account_id: z.string().uuid().optional(),
  nome: z.string().min(1, 'Nome é obrigatório'),
  cargo: z.string().optional(),
  emails: z.array(z.string().email()).optional(),
  telefones: z.array(z.string()).optional(),
});

type ContactFormData = z.infer<typeof contactSchema>;

interface ContactModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact;
}

export function ContactModal({ open, onOpenChange, contact }: ContactModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!contact;
  const [accountOpen, setAccountOpen] = useState(false);
  const [accountSearch, setAccountSearch] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState(contact?.account_id || '');
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [emails, setEmails] = useState<string[]>(contact?.emails || []);
  const [phones, setPhones] = useState<string[]>(contact?.telefones || []);

  const { register, handleSubmit, formState: { errors } } = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: contact?.nome || '',
      cargo: contact?.cargo || '',
      account_id: contact?.account_id || '',
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ['accounts-search', accountSearch],
    queryFn: () => searchAccounts(accountSearch),
    enabled: accountSearch.length > 0,
  });

  const mutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      const payload = {
        ...data,
        account_id: selectedAccountId || undefined,
        emails: emails.length > 0 ? emails : undefined,
        telefones: phones.length > 0 ? phones : undefined,
      };

      if (isEditing) {
        return updateContact(contact.id, payload);
      }
      return createContact(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast({
        title: isEditing ? 'Contato atualizado' : 'Contato criado',
        description: isEditing
          ? 'O contato foi atualizado com sucesso.'
          : 'O contato foi criado com sucesso.',
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

          <div className="space-y-2">
            <Label htmlFor="cargo">Cargo</Label>
            <Input id="cargo" {...register('cargo')} placeholder="Ex: Diretor de TI" />
          </div>

          <div className="space-y-2">
            <Label>Empresa</Label>
            <Popover open={accountOpen} onOpenChange={setAccountOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={accountOpen}
                  className="w-full justify-between"
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

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Salvando...' : isEditing ? 'Atualizar' : 'Criar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
