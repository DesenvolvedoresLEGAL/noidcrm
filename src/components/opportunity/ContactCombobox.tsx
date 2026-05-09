import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPersonName } from '@/lib/contactFormat';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ContactItem {
  id: string;
  nome: string;
  cargo: string | null;
  emails: unknown; // JSONB from database
}

interface ContactComboboxProps {
  value: string;
  onChange: (contactId: string) => void;
  accountId?: string;
  disabled?: boolean;
  placeholder?: string;
}

export function ContactCombobox({ 
  value, 
  onChange, 
  accountId, 
  disabled, 
  placeholder = "Selecione o contato..." 
}: ContactComboboxProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newContactFirstName, setNewContactFirstName] = useState('');
  const [newContactLastName, setNewContactLastName] = useState('');
  const [newContactCargo, setNewContactCargo] = useState('');
  const [newContactEmail, setNewContactEmail] = useState('');
  const [newContactPhone, setNewContactPhone] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedContact = contacts.find(c => c.id === value);

  useEffect(() => {
    fetchContacts();
  }, [accountId]);

  const fetchContacts = async (search?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('contacts')
        .select('id, nome, cargo, emails')
        .order('nome')
        .limit(50);

      if (accountId) {
        query = query.eq('account_id', accountId);
      }

      if (search) {
        query = query.ilike('nome', `%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setContacts(data || []);
    } catch (err) {
      console.error('Error fetching contacts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setSearchQuery(search);
    fetchContacts(search);
  };

  const handleCreateContact = async () => {
    if (!newContactFirstName.trim()) return;
    
    setCreating(true);
    try {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('User must belong to an organization');

      const primeiro_nome = formatPersonName(newContactFirstName);
      const ultimo_nome = formatPersonName(newContactLastName);

      const insertData: any = {
        primeiro_nome,
        ultimo_nome,
        nome: (primeiro_nome + (ultimo_nome ? ' ' + ultimo_nome : '')).trim(),
        organization_id: orgId,
      };

      if (accountId) insertData.account_id = accountId;
      if (newContactCargo.trim()) insertData.cargo = newContactCargo.trim();
      if (newContactEmail.trim()) insertData.emails = [newContactEmail.trim()];
      if (newContactPhone.trim()) insertData.telefones = [newContactPhone.trim()];

      const { data, error } = await supabase
        .from('contacts')
        .insert(insertData)
        .select('id, nome, cargo, emails, telefones')
        .single();

      if (error) throw error;

      setContacts(prev => [data, ...prev]);
      onChange(data.id);
      setNewContactFirstName('');
      setNewContactLastName('');
      setNewContactCargo('');
      setNewContactEmail('');
      setNewContactPhone('');
      setShowCreateForm(false);
      setOpen(false);
      
      toast({
        title: 'Contato criado',
        description: `"${data.nome}" foi criado com sucesso`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao criar contato',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <User className="h-4 w-4 shrink-0 opacity-50" />
            {selectedContact ? selectedContact.nome : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
        {showCreateForm ? (
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Primeiro Nome *</Label>
                <Input
                  value={newContactFirstName}
                  onChange={(e) => setNewContactFirstName(e.target.value)}
                  placeholder="Ex: João"
                  autoFocus
                />
              </div>
              <div>
                <Label>Último Nome</Label>
                <Input
                  value={newContactLastName}
                  onChange={(e) => setNewContactLastName(e.target.value)}
                  placeholder="Ex: Silva"
                />
              </div>
            </div>
            <div>
              <Label>Cargo</Label>
              <Input
                value={newContactCargo}
                onChange={(e) => setNewContactCargo(e.target.value)}
                placeholder="Ex: Diretor Comercial"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input
                value={newContactEmail}
                onChange={(e) => setNewContactEmail(e.target.value)}
                placeholder="Ex: joao@empresa.com"
                type="email"
              />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={newContactPhone}
                onChange={(e) => setNewContactPhone(e.target.value)}
                placeholder="Ex: (11) 99999-9999"
                type="tel"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewContactFirstName('');
                  setNewContactLastName('');
                  setNewContactCargo('');
                  setNewContactEmail('');
                  setNewContactPhone('');
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateContact}
                disabled={!newContactFirstName.trim() || creating}
              >
                {creating ? 'Criando...' : 'Criar Contato'}
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput 
              placeholder="Buscar contato..." 
              value={searchQuery}
              onValueChange={handleSearch}
            />
            <CommandList>
              <CommandGroup>
                <CommandItem
                  onSelect={() => setShowCreateForm(true)}
                  className="text-primary font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Novo Contato
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandEmpty>
                {loading ? 'Buscando...' : 'Nenhum contato encontrado.'}
              </CommandEmpty>
              <CommandGroup>
                {contacts.map((contact) => (
                  <CommandItem
                    key={contact.id}
                    value={contact.nome}
                    onSelect={() => {
                      onChange(contact.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === contact.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{contact.nome}</span>
                      {contact.cargo && (
                        <span className="text-xs text-muted-foreground">{contact.cargo}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
