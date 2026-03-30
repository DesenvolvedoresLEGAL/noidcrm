import { useState, useEffect, useCallback } from 'react';
import { Check, ChevronsUpDown, Plus, Building2, AlertTriangle } from 'lucide-react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Account {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
}

interface SimilarAccount {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string | null;
  similarity: number;
}

interface AccountComboboxProps {
  value: string;
  onChange: (accountId: string, accountName: string, isNewAccount: boolean) => void;
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
  
  // Similar accounts detection
  const [similarAccounts, setSimilarAccounts] = useState<SimilarAccount[]>([]);
  const [isCheckingSimilar, setIsCheckingSimilar] = useState(false);

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

  // Check for similar accounts when typing new account name
  const checkSimilarAccounts = useCallback(async (name: string) => {
    if (!name || name.trim().length < 3) {
      setSimilarAccounts([]);
      return;
    }

    setIsCheckingSimilar(true);
    try {
      const { data: orgId } = await supabase.rpc('get_user_organization_id');
      if (!orgId) {
        setSimilarAccounts([]);
        return;
      }

      const { data, error } = await supabase.rpc('find_similar_accounts', {
        p_name: name.trim(),
        p_org_id: orgId,
        p_threshold: 0.3,
      });

      if (error) {
        console.error('Error checking similar accounts:', error);
        setSimilarAccounts([]);
        return;
      }

      setSimilarAccounts(data || []);
    } catch (err) {
      console.error('Error in checkSimilarAccounts:', err);
      setSimilarAccounts([]);
    } finally {
      setIsCheckingSimilar(false);
    }
  }, []);

  // Debounce the similarity check
  useEffect(() => {
    if (!showCreateForm) return;
    
    const timer = setTimeout(() => {
      checkSimilarAccounts(newAccountName);
    }, 500);

    return () => clearTimeout(timer);
  }, [newAccountName, showCreateForm, checkSimilarAccounts]);

  const shouldBlockCreation = similarAccounts.some(acc => acc.similarity >= 0.9);

  const handleSelectSimilarAccount = (account: SimilarAccount) => {
    onChange(account.id, account.nome_fantasia || account.razao_social, false);
    setNewAccountName('');
    setShowCreateForm(false);
    setSimilarAccounts([]);
    setOpen(false);
    
    toast({
      title: 'Empresa selecionada',
      description: `"${account.nome_fantasia || account.razao_social}" foi selecionada`,
    });
  };

  const handleCreateAccount = async () => {
    if (!newAccountName.trim()) return;
    
    // Block if very high similarity found
    if (shouldBlockCreation) {
      toast({
        variant: 'destructive',
        title: 'Empresa duplicada detectada',
        description: 'Esta empresa já existe no sistema. Selecione a empresa existente.',
      });
      return;
    }
    
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
      onChange(data.id, data.nome_fantasia || data.razao_social, true);
      setNewAccountName('');
      setShowCreateForm(false);
      setSimilarAccounts([]);
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

  const formatSimilarity = (similarity: number) => {
    return Math.round(similarity * 100);
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
      <PopoverContent className="w-[calc(100vw-2rem)] sm:w-[400px] p-0" align="start">
        {showCreateForm ? (
          <div className="p-4 space-y-3">
            <Label>Nome da Nova Empresa</Label>
            <Input
              value={newAccountName}
              onChange={(e) => setNewAccountName(e.target.value)}
              placeholder="Ex: Empresa XPTO Ltda"
              autoFocus
            />
            
            {/* Similar accounts warning */}
            {similarAccounts.length > 0 && (
              <Alert variant={shouldBlockCreation ? "destructive" : "default"} className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>
                  {shouldBlockCreation 
                    ? 'Empresa duplicada detectada!'
                    : 'Possíveis duplicidades encontradas'
                  }
                </AlertTitle>
                <AlertDescription className="mt-2">
                  <p className="text-sm mb-2">
                    {shouldBlockCreation 
                      ? 'Esta empresa já existe. Selecione abaixo:'
                      : 'Encontramos empresas similares. Verifique antes de criar:'
                    }
                  </p>
                  <div className="space-y-1">
                    {similarAccounts.map((acc) => (
                      <Button
                        key={acc.id}
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start h-auto py-2 px-2"
                        onClick={() => handleSelectSimilarAccount(acc)}
                      >
                        <div className="flex flex-col items-start">
                          <span className="font-medium">
                            {acc.nome_fantasia || acc.razao_social}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {acc.cnpj && `CNPJ: ${acc.cnpj} • `}
                            {formatSimilarity(acc.similarity)}% similar
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}
            
            {isCheckingSimilar && (
              <p className="text-xs text-muted-foreground">Verificando duplicidades...</p>
            )}
            
            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewAccountName('');
                  setSimilarAccounts([]);
                }}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateAccount}
                disabled={!newAccountName.trim() || creating || shouldBlockCreation}
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
              <CommandGroup>
                <CommandItem
                  onSelect={() => setShowCreateForm(true)}
                  className="text-primary font-medium"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Nova Empresa
                </CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandEmpty>
                {loading ? 'Buscando...' : 'Nenhuma empresa encontrada.'}
              </CommandEmpty>
              <CommandGroup>
                {accounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={account.nome_fantasia || account.razao_social}
                    onSelect={() => {
                      onChange(account.id, account.nome_fantasia || account.razao_social, false);
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
            </CommandList>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}
