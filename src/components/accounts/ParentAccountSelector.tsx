import { useState, useEffect, useCallback, useRef } from 'react';
import { Check, ChevronsUpDown, Building2, Loader2 } from 'lucide-react';
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
  excludeId?: string;
  disabled?: boolean;
}

export function ParentAccountSelector({ value, onChange, excludeId, disabled }: ParentAccountSelectorProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const hasFetchedRef = useRef(false);

  const fetchAccounts = useCallback(async (query: string) => {
    setLoading(true);
    try {
      let supabaseQuery = supabase
        .from('accounts')
        .select('id, razao_social, nome_fantasia, cnpj')
        .eq('tipo_pessoa', 'PJ')
        .is('parent_account_id', null)
        .order('razao_social')
        .limit(50);

      if (query) {
        supabaseQuery = supabaseQuery.or(`razao_social.ilike.%${query}%,nome_fantasia.ilike.%${query}%`);
      }

      if (excludeId) {
        supabaseQuery = supabaseQuery.neq('id', excludeId);
      }

      const { data, error } = await supabaseQuery;
      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching parent accounts:', error);
    } finally {
      setLoading(false);
    }
  }, [excludeId]);

  // Fetch only when popover opens (not on every render)
  useEffect(() => {
    if (open && !hasFetchedRef.current) {
      fetchAccounts(searchQuery);
      hasFetchedRef.current = true;
    }
  }, [open, fetchAccounts, searchQuery]);

  // Reset fetch flag when popover closes
  useEffect(() => {
    if (!open) {
      hasFetchedRef.current = false;
    }
  }, [open]);

  // Debounced search - only when popover is open
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (open) {
      debounceRef.current = setTimeout(() => {
        fetchAccounts(query);
      }, 500);
    }
  }, [open, fetchAccounts]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

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
            onValueChange={handleSearchChange}
          />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Carregando...</span>
                </div>
              ) : (
                'Nenhuma empresa encontrada.'
              )}
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
