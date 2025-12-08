import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
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

interface Account {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
}

interface AccountComboboxProps {
  value: string;
  onChange: (accountId: string, accountName: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function AccountCombobox({ value, onChange, disabled, placeholder = "Selecione a empresa..." }: AccountComboboxProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAccountName, setNewAccountName] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedAccount = accounts.find(a => a.id === value);

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async (search?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('accounts')
        .select('id, razao_social, nome_fantasia')
        .order('razao_social')
        .limit(50);

      if (search) {
        query = query.or(`razao_social.ilike.%${search}%,nome_fantasia.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAccounts(data || []);
    } catch (err) {
      console.error('Error fetching accounts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (search: string) => {
    setSearchQuery(search);
    fetchAccounts(search);
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    
    setCreating(true);
    try {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) throw new Error('User must belong to an organization');

      const { data, error } = await supabase
        .from('accounts')
        .insert({ razao_social: newAccountName.trim(), organization_id: orgId })
        .select('id, razao_social, nome_fantasia')
        .single();

      if (error) throw error;

      setAccounts(prev => [data, ...prev]);
      onChange(data.id, data.nome_fantasia || data.razao_social);
      setNewAccountName('');
      setShowCreateForm(false);
      setOpen(false);
      
      toast({
        title: 'Empresa criada',
        description: `"${data.razao_social}" foi criada com sucesso`,
      });
    } catch (err: any) {
      toast({
        title: 'Erro ao criar empresa',
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
            <Building2 className="h-4 w-4 shrink-0 opacity-50" />
            {selectedAccount 
              ? (selectedAccount.nome_fantasia || selectedAccount.razao_social)
              : placeholder
            }
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        {showCreateForm ? (
          <div className="p-4 space-y-3">
            <Label>Nome da Nova Empresa</Label>
            <Input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Ex: Empresa XPTO Ltda"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewAccountName('');
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateAccount}
                disabled={!newAccountName.trim() || creating}
              >
                {creating ? 'Criando...' : 'Criar Empresa'}
              </Button>
            </div>
          </div>
        ) : (
          <Command>
            <CommandInput 
              placeholder="Buscar empresa..." 
              value={searchQuery}
              onValueChange={handleSearch}
            />
            <CommandList>
              <CommandEmpty>
                {loading ? 'Buscando...' : 'Nenhuma empresa encontrada.'}
              </CommandEmpty>
              <CommandGroup>
                {accounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={account.nome_fantasia || account.razao_social}
                    onSelect={() => {
                      onChange(account.id, account.nome_fantasia || account.razao_social);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === account.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col">
                      <span>{account.nome_fantasia || account.razao_social}</span>
                      {account.nome_fantasia && (
                        <span className="text-xs text-muted-foreground">{account.razao_social}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => setShowCreateForm(true)}
                  className="text-primary"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Nova Empresa
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
