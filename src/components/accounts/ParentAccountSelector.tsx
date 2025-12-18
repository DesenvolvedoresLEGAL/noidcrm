import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';

interface Account {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
}

interface ParentAccountSelectorProps {
  value?: string;
  onChange: (value: string | undefined) => void;
  excludeId?: string; // Exclude current account from list
  disabled?: boolean;
}

export function ParentAccountSelector({ value, onChange, excludeId, disabled }: ParentAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchAccounts();
  }, [searchQuery]);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('accounts')
        .select('id, razao_social, nome_fantasia, cnpj')
        .eq('tipo_pessoa', 'PJ') // Only PJ can be parent
        .is('parent_account_id', null) // Only matriz accounts
        .order('razao_social')
        .limit(50);

      if (searchQuery) {
        query = query.or(`razao_social.ilike.%${searchQuery}%,nome_fantasia.ilike.%${searchQuery}%`);
      }

      if (excludeId) {
        query = query.neq('id', excludeId);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching parent accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedAccount = accounts.find(acc => acc.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {selectedAccount ? (
            <span className="flex items-center gap-2 truncate">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              {selectedAccount.nome_fantasia || selectedAccount.razao_social}
            </span>
          ) : (
            <span className="text-muted-foreground">Selecione a empresa matriz...</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Buscar empresa matriz..."
            value={searchQuery}
            onValueChange={setSearchQuery}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? 'Carregando...' : 'Nenhuma empresa encontrada.'}
            </CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value=""
                  onSelect={() => {
                    onChange(undefined);
                    setOpen(false);
                  }}
                  className="text-muted-foreground"
                >
                  <span className="italic">Remover vínculo</span>
                </CommandItem>
              )}
              {accounts.map((account) => (
                <CommandItem
                  key={account.id}
                  value={account.id}
                  onSelect={() => {
                    onChange(account.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === account.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium">
                      {account.nome_fantasia || account.razao_social}
                    </span>
                    {account.cnpj && (
                      <span className="text-xs text-muted-foreground font-mono">
                        {account.cnpj}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
