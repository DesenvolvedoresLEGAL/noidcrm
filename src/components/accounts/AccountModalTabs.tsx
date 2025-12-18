import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { createAccount, updateAccount, lookupCNPJ, type Account, createAccountPartner } from '@/services/crm/accounts';
import { listOrigins, type OriginWithGroup } from '@/services/crm/origins';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useState, useEffect } from 'react';
import { Search, Loader2, Building2, MapPin, Mail, Users, Briefcase, FileText, User, GitBranch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ParentAccountSelector } from './ParentAccountSelector';
import { validateCPF, formatCPF } from '@/lib/validators/cpf';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const accountSchema = z.object({
  // Tipo de Pessoa
  tipo_pessoa: z.enum(['PJ', 'PF']).default('PJ'),
  
  // Dados Principais - PJ
  cnpj: z.string().optional(),
  razao_social: z.string().min(1, 'Nome é obrigatório'),
  nome_fantasia: z.string().optional(),
  tipo_empresa: z.string().optional(),
  situacao_cadastral: z.string().optional(),
  owner_user_id: z.string().optional(),
  cs_user_id: z.string().optional(),
  parent_account_id: z.string().optional(),
  
  // Dados Principais - PF
  cpf: z.string().optional(),
  rg: z.string().optional(),
  data_nascimento: z.string().optional(),
  
  // Dados Cadastrais (PJ only)
  inscricao_estadual: z.string().optional(),
  inscricao_municipal: z.string().optional(),
  natureza_juridica: z.string().optional(),
  porte: z.string().optional(),
  capital_social: z.union([z.string(), z.number()]).optional().transform(v => v != null ? String(v) : undefined),
  data_fundacao: z.string().optional(),
  opcao_simples: z.boolean().optional(),
  opcao_mei: z.boolean().optional(),
  cnae: z.string().optional(),
  cnaes_secundarios: z.array(z.string()).optional(),
  
  // Endereço
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  uf: z.string().optional(),
  
  // Contatos
  telefones: z.any().optional(),
  emails: z.array(z.string()).optional(),
  website: z.string().optional(),
  linkedin: z.string().optional(),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  email_nota_fiscal: z.string().optional(),
  
  // Comercial
  segmento: z.string().optional(),
  tamanho: z.string().optional(),
  origem_principal: z.string().optional(),
  faturamento_anual: z.union([z.string(), z.number()]).optional().transform(v => v != null ? String(v) : undefined),
  pontuacao_nps: z.union([z.string(), z.number()]).optional().transform(v => v != null ? String(v) : undefined),
  data_tornou_cliente: z.string().optional(),
  codigo_externo: z.string().optional(),
  observacoes: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

interface AccountModalTabsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: Account;
}

export function AccountModalTabs({ open, onOpenChange, account }: AccountModalTabsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!account;
  const { users } = useOrganizationUsers();
  
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
  const [cnpjToLookup, setCnpjToLookup] = useState('');
  const [qsaData, setQsaData] = useState<any[]>([]);

  // Fetch origins from the database
  const { data: originsData } = useQuery({
    queryKey: ['origins'],
    queryFn: () => listOrigins(),
  });
  const origins = (originsData || []).filter((o: OriginWithGroup) => o.is_active);

  const { register, handleSubmit, control, formState: { errors }, setValue, watch, reset } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
  });

  const watchCnpj = watch('cnpj');

  // Reset form when modal opens or account changes
  useEffect(() => {
    if (open) {
      const acc = account as any;
      reset({
        tipo_pessoa: acc?.tipo_pessoa || 'PJ',
        cnpj: acc?.cnpj || '',
        razao_social: acc?.razao_social || '',
        nome_fantasia: acc?.nome_fantasia || '',
        tipo_empresa: acc?.tipo_empresa || '',
        situacao_cadastral: acc?.situacao_cadastral || '',
        owner_user_id: acc?.owner_user_id || '',
        cs_user_id: acc?.cs_user_id || '',
        parent_account_id: acc?.parent_account_id || '',
        cpf: acc?.cpf || '',
        rg: acc?.rg || '',
        data_nascimento: acc?.data_nascimento || '',
        inscricao_estadual: acc?.inscricao_estadual || '',
        inscricao_municipal: acc?.inscricao_municipal || '',
        natureza_juridica: acc?.natureza_juridica || '',
        porte: acc?.porte || '',
        capital_social: acc?.capital_social?.toString() || '',
        data_fundacao: acc?.data_fundacao || '',
        opcao_simples: acc?.opcao_simples || false,
        opcao_mei: acc?.opcao_mei || false,
        cnae: acc?.cnae || '',
        cnaes_secundarios: acc?.cnaes_secundarios || [],
        cep: acc?.cep || '',
        logradouro: acc?.logradouro || '',
        numero: acc?.numero || '',
        complemento: acc?.complemento || '',
        bairro: acc?.bairro || '',
        cidade: acc?.cidade || '',
        uf: acc?.uf || '',
        telefones: acc?.telefones || [],
        emails: acc?.emails || [],
        website: acc?.website || '',
        linkedin: acc?.linkedin || '',
        instagram: acc?.instagram || '',
        facebook: acc?.facebook || '',
        email_nota_fiscal: acc?.email_nota_fiscal || '',
        segmento: acc?.segmento || '',
        tamanho: acc?.tamanho || '',
        origem_principal: acc?.origem_principal || '',
        faturamento_anual: '',
        pontuacao_nps: acc?.pontuacao_nps?.toString() || '',
        data_tornou_cliente: acc?.data_tornou_cliente || '',
        codigo_externo: acc?.codigo_externo || '',
        observacoes: acc?.observacoes || '',
      });
      setCnpjToLookup(acc?.cnpj || '');
    }
  }, [open, account, reset]);

  const tipoPessoa = watch('tipo_pessoa');
  const isPF = tipoPessoa === 'PF';

  useEffect(() => {
    if (watchCnpj) {
      setCnpjToLookup(watchCnpj);
    }
  }, [watchCnpj]);

  const handleCNPJLookup = async () => {
    // Remover caracteres não numéricos
    const cleanCnpj = cnpjToLookup.replace(/\D/g, '');
    
    // Validar se tem 14 dígitos
    if (!cleanCnpj || cleanCnpj.length !== 14) {
      toast({
        variant: 'destructive',
        title: 'CNPJ inválido',
        description: 'Digite um CNPJ válido com 14 dígitos (XX.XXX.XXX/XXXX-XX)',
      });
      return;
    }

    setIsLoadingCNPJ(true);
    try {
      console.log('[CNPJ Lookup] Iniciando busca para CNPJ:', cleanCnpj);
      const data = await lookupCNPJ(cleanCnpj);
      
      // Preencher todos os campos automaticamente
      setValue('razao_social', data.razao_social);
      setValue('nome_fantasia', data.nome_fantasia || '');
      setValue('natureza_juridica', data.natureza_juridica || '');
      setValue('porte', data.porte || '');
      setValue('capital_social', data.capital_social?.toString() || '');
      setValue('situacao_cadastral', data.situacao_cadastral || '');
      setValue('data_fundacao', data.data_fundacao || '');
      setValue('cnae', data.cnae_principal?.codigo || '');
      setValue('cnaes_secundarios', data.cnaes_secundarios?.map(c => String(c.codigo)) || []);
      setValue('opcao_simples', data.opcao_simples || false);
      setValue('opcao_mei', data.opcao_mei || false);
      
      // Endereço
      setValue('cep', data.cep || '');
      setValue('logradouro', data.logradouro || '');
      setValue('numero', data.numero || '');
      setValue('complemento', data.complemento || '');
      setValue('bairro', data.bairro || '');
      setValue('cidade', data.cidade || '');
      setValue('uf', data.uf || '');
      
      // Contatos
      setValue('telefones', data.telefones || []);
      setValue('emails', data.email ? [data.email] : []);
      
      // Guardar QSA para posterior inserção
      if (data.qsa) {
        setQsaData(data.qsa);
      }

      toast({
        title: '✅ Dados carregados com sucesso!',
        description: `${data.razao_social || 'Empresa'} - Dados da Receita Federal preenchidos automaticamente`,
      });
    } catch (error) {
      console.error('[CNPJ Lookup] Erro detalhado:', error);
      
      let errorTitle = 'Erro ao buscar CNPJ';
      let errorDescription = 'Erro desconhecido';
      
      if (error instanceof Error) {
        // Mensagens de erro mais específicas baseadas no tipo de erro
        if (error.message.includes('Failed to send a request')) {
          errorTitle = 'Serviço indisponível';
          errorDescription = 'O serviço de busca de CNPJ está temporariamente indisponível. Tente novamente em alguns instantes.';
        } else if (error.message.includes('Failed to fetch')) {
          errorTitle = 'Erro de conexão';
          errorDescription = 'Verifique sua conexão com a internet e tente novamente.';
        } else if (error.message.includes('não encontrado')) {
          errorTitle = 'CNPJ não encontrado';
          errorDescription = 'CNPJ não encontrado na base da Receita Federal. Verifique o número digitado.';
        } else if (error.message.includes('inválido')) {
          errorTitle = 'CNPJ inválido';
          errorDescription = 'O CNPJ digitado é inválido. Deve conter 14 dígitos.';
        } else {
          errorDescription = error.message;
        }
      }
      
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorDescription,
      });
    } finally {
      setIsLoadingCNPJ(false);
    }
  };

  const mutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      // Validate CPF if PF
      if (data.tipo_pessoa === 'PF' && data.cpf && !validateCPF(data.cpf)) {
        throw new Error('CPF inválido. Verifique os dígitos.');
      }
      
      const payload = {
        ...data,
        capital_social: data.capital_social ? parseFloat(data.capital_social) : undefined,
        faturamento_anual: data.faturamento_anual ? parseFloat(data.faturamento_anual) : undefined,
        pontuacao_nps: data.pontuacao_nps ? parseInt(data.pontuacao_nps) : undefined,
        // Clear PJ fields if PF
        ...(data.tipo_pessoa === 'PF' && {
          cnpj: null,
          inscricao_estadual: null,
          inscricao_municipal: null,
          natureza_juridica: null,
          porte: null,
          capital_social: null,
          data_fundacao: null,
          cnae: null,
          cnaes_secundarios: null,
          opcao_simples: null,
          opcao_mei: null,
        }),
        // Clear PF fields if PJ
        ...(data.tipo_pessoa === 'PJ' && {
          cpf: null,
          rg: null,
          data_nascimento: null,
        }),
      };

      let accountId: string;
      
      if (isEditing) {
        const result = await updateAccount(account.id, payload);
        accountId = result.id;
        return result;
      } else {
        const result = await createAccount(payload);
        accountId = result.id;
        
        // Se temos dados de sócios (QSA), criar os registros
        if (qsaData.length > 0) {
          for (const socio of qsaData) {
            try {
              await createAccountPartner(accountId, {
                nome_socio: socio.nome,
                cpf_cnpj_socio: socio.cpf_cnpj,
                qualificacao: socio.qualificacao,
                data_entrada: socio.data_entrada,
                faixa_etaria: socio.faixa_etaria,
              });
            } catch (error) {
              console.error('Erro ao criar sócio:', error);
            }
          }
        }
        
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast({
        title: isEditing ? 'Conta atualizada' : 'Conta criada',
        description: isEditing
          ? 'A conta foi atualizada com sucesso.'
          : 'A conta foi criada com sucesso.',
      });
      setQsaData([]);
      onOpenChange(false);
    },
    onError: (error: Error) => {
      console.error('[AccountModalTabs] Erro na mutação:', error);
      
      // Tratamento específico para erros de constraint/duplicata
      let errorTitle = 'Erro ao salvar';
      let errorDescription = error.message;
      
      if (error.message.includes('duplicate key') || error.message.includes('unique constraint')) {
        if (error.message.includes('cnpj')) {
          errorTitle = 'CNPJ duplicado';
          errorDescription = 'Já existe uma conta com este CNPJ cadastrada na sua organização.';
        } else if (error.message.includes('cpf')) {
          errorTitle = 'CPF duplicado';
          errorDescription = 'Já existe uma conta com este CPF cadastrada na sua organização.';
        } else {
          errorTitle = 'Registro duplicado';
          errorDescription = 'Já existe um registro com estes dados.';
        }
      } else if (error.message.includes('row-level security')) {
        errorTitle = 'Permissão negada';
        errorDescription = 'Você não tem permissão para realizar esta ação.';
      } else if (error.message.includes('network') || error.message.includes('fetch')) {
        errorTitle = 'Erro de conexão';
        errorDescription = 'Verifique sua conexão com a internet e tente novamente.';
      }
      
      toast({
        variant: 'destructive',
        title: errorTitle,
        description: errorDescription,
      });
    },
  });

  const onSubmit = (data: AccountFormData) => {
    console.log('[AccountModalTabs] Submetendo formulário:', data);
    mutation.mutate(data);
  };
  
  // Handler para erros de validação do formulário
  const onFormError = (formErrors: any) => {
    console.error('[AccountModalTabs] Erros de validação:', formErrors);
    
    const errorMessages = Object.entries(formErrors)
      .map(([field, error]: [string, any]) => `${field}: ${error.message}`)
      .join(', ');
    
    toast({
      variant: 'destructive',
      title: 'Erro de validação',
      description: errorMessages || 'Preencha todos os campos obrigatórios.',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Conta' : 'Nova Conta'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit, onFormError)}>
          {/* Tipo de Pessoa Selector */}
          <div className="mb-6 p-4 border rounded-lg bg-muted/30">
            <Label className="mb-3 block">Tipo de Cadastro</Label>
            <Controller
              name="tipo_pessoa"
              control={control}
              render={({ field }) => (
                <ToggleGroup
                  type="single"
                  value={field.value}
                  onValueChange={(value) => value && field.onChange(value)}
                  className="justify-start"
                >
                  <ToggleGroupItem value="PJ" aria-label="Pessoa Jurídica" className="gap-2">
                    <Building2 className="h-4 w-4" />
                    Pessoa Jurídica (CNPJ)
                  </ToggleGroupItem>
                  <ToggleGroupItem value="PF" aria-label="Pessoa Física" className="gap-2">
                    <User className="h-4 w-4" />
                    Pessoa Física (CPF)
                  </ToggleGroupItem>
                </ToggleGroup>
              )}
            />
          </div>

          <Tabs defaultValue="principais" className="w-full">
            <TabsList className={`grid w-full ${isPF ? 'grid-cols-4' : 'grid-cols-6'}`}>
              <TabsTrigger value="principais" className="text-xs">
                {isPF ? <User className="w-4 h-4 mr-1" /> : <Building2 className="w-4 h-4 mr-1" />}
                Principais
              </TabsTrigger>
              {!isPF && (
                <TabsTrigger value="cadastrais" className="text-xs">
                  <FileText className="w-4 h-4 mr-1" />
                  Cadastrais
                </TabsTrigger>
              )}
              <TabsTrigger value="endereco" className="text-xs">
                <MapPin className="w-4 h-4 mr-1" />
                Endereço
              </TabsTrigger>
              <TabsTrigger value="contatos" className="text-xs">
                <Mail className="w-4 h-4 mr-1" />
                Contatos
              </TabsTrigger>
              <TabsTrigger value="comercial" className="text-xs">
                <Briefcase className="w-4 h-4 mr-1" />
                Comercial
              </TabsTrigger>
              {!isPF && (
                <TabsTrigger value="pessoas" className="text-xs">
                  <Users className="w-4 h-4 mr-1" />
                  Pessoas
                </TabsTrigger>
              )}
            </TabsList>

            {/* Aba 1: Dados Principais */}
            <TabsContent value="principais" className="space-y-4 mt-4">
              {/* PJ Fields */}
              {!isPF && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <div className="flex gap-2">
                        <Input 
                          id="cnpj" 
                          {...register('cnpj')} 
                          placeholder="00.000.000/0000-00"
                          onChange={(e) => setCnpjToLookup(e.target.value)}
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={handleCNPJLookup}
                          disabled={isLoadingCNPJ}
                        >
                          {isLoadingCNPJ ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="situacao_cadastral">Situação Cadastral</Label>
                      <Input id="situacao_cadastral" {...register('situacao_cadastral')} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="razao_social">Razão Social *</Label>
                    <Input id="razao_social" {...register('razao_social')} />
                    {errors.razao_social && (
                      <p className="text-sm text-destructive">{errors.razao_social.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                    <Input id="nome_fantasia" {...register('nome_fantasia')} />
                  </div>

                  {/* Parent Account Selector for branches */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      É filial de (opcional)
                    </Label>
                    <Controller
                      name="parent_account_id"
                      control={control}
                      render={({ field }) => (
                        <ParentAccountSelector
                          value={field.value}
                          onChange={field.onChange}
                          excludeId={account?.id}
                        />
                      )}
                    />
                    <p className="text-xs text-muted-foreground">
                      Selecione a empresa matriz se esta conta for uma filial
                    </p>
                  </div>
                </>
              )}

              {/* PF Fields */}
              {isPF && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cpf">CPF *</Label>
                      <Input 
                        id="cpf" 
                        {...register('cpf')} 
                        placeholder="000.000.000-00"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rg">RG</Label>
                      <Input id="rg" {...register('rg')} placeholder="00.000.000-0" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="razao_social">Nome Completo *</Label>
                    <Input id="razao_social" {...register('razao_social')} placeholder="Nome completo da pessoa" />
                    {errors.razao_social && (
                      <p className="text-sm text-destructive">{errors.razao_social.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nome_fantasia">Apelido / Como prefere ser chamado</Label>
                      <Input id="nome_fantasia" {...register('nome_fantasia')} placeholder="Opcional" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                      <Input id="data_nascimento" {...register('data_nascimento')} type="date" />
                    </div>
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tipo_empresa">Tipo de {isPF ? 'Cliente' : 'Empresa'}</Label>
                  <Controller
                    name="tipo_empresa"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Lead">Lead</SelectItem>
                          <SelectItem value="Prospect">Prospect</SelectItem>
                          <SelectItem value="Cliente">Cliente</SelectItem>
                          <SelectItem value="Ex-Cliente">Ex-Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="owner_user_id">Vendedor Responsável</Label>
                  <Controller
                    name="owner_user_id"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cs_user_id">Customer Success Responsável</Label>
                <Controller
                  name="cs_user_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </TabsContent>

            {/* Aba 2: Dados Cadastrais */}
            <TabsContent value="cadastrais" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                  <Input id="inscricao_estadual" {...register('inscricao_estadual')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="inscricao_municipal">Inscrição Municipal</Label>
                  <Input id="inscricao_municipal" {...register('inscricao_municipal')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="natureza_juridica">Natureza Jurídica</Label>
                <Input id="natureza_juridica" {...register('natureza_juridica')} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="porte">Porte (Receita Federal)</Label>
                  <Controller
                    name="porte"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Preenchido via CNPJ" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MEI">MEI - Microempreendedor Individual</SelectItem>
                          <SelectItem value="ME">ME - Microempresa</SelectItem>
                          <SelectItem value="EPP">EPP - Empresa de Pequeno Porte</SelectItem>
                          <SelectItem value="Médio Porte">Médio Porte</SelectItem>
                          <SelectItem value="Grande Porte">Grande Porte</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Classificação oficial da Receita Federal
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="capital_social">Capital Social</Label>
                  <Input id="capital_social" {...register('capital_social')} type="number" step="0.01" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="data_fundacao">Data de Fundação</Label>
                <Input id="data_fundacao" {...register('data_fundacao')} type="date" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="cnae">CNAE Principal</Label>
                <Input id="cnae" {...register('cnae')} />
              </div>

              <div className="flex gap-4">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="opcao_simples" {...register('opcao_simples')} />
                  <Label htmlFor="opcao_simples">Opção Simples</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <input type="checkbox" id="opcao_mei" {...register('opcao_mei')} />
                  <Label htmlFor="opcao_mei">MEI</Label>
                </div>
              </div>
            </TabsContent>

            {/* Aba 3: Endereço */}
            <TabsContent value="endereco" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="cep">CEP</Label>
                <Input id="cep" {...register('cep')} placeholder="00000-000" />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input id="logradouro" {...register('logradouro')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" {...register('numero')} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="complemento">Complemento</Label>
                <Input id="complemento" {...register('complemento')} />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" {...register('bairro')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" {...register('cidade')} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="uf">UF</Label>
                  <Input id="uf" {...register('uf')} maxLength={2} />
                </div>
              </div>
            </TabsContent>

            {/* Aba 4: Contatos */}
            <TabsContent value="contatos" className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input id="website" {...register('website')} placeholder="https://" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email_nota_fiscal">Email Nota Fiscal</Label>
                <Input id="email_nota_fiscal" {...register('email_nota_fiscal')} type="email" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="linkedin">LinkedIn</Label>
                <Input id="linkedin" {...register('linkedin')} placeholder="https://linkedin.com/company/" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instagram">Instagram</Label>
                <Input id="instagram" {...register('instagram')} placeholder="@empresa" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="facebook">Facebook</Label>
                <Input id="facebook" {...register('facebook')} placeholder="https://facebook.com/" />
              </div>
            </TabsContent>

            {/* Aba 5: Comercial */}
            <TabsContent value="comercial" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="segmento">Segmento</Label>
                  <Input id="segmento" {...register('segmento')} placeholder="Ex: Tecnologia" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tamanho">Tamanho (Nº Funcionários)</Label>
                  <Controller
                    name="tamanho"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-10">1-10 funcionários</SelectItem>
                          <SelectItem value="11-50">11-50 funcionários</SelectItem>
                          <SelectItem value="51-200">51-200 funcionários</SelectItem>
                          <SelectItem value="201-500">201-500 funcionários</SelectItem>
                          <SelectItem value="501-1000">501-1000 funcionários</SelectItem>
                          <SelectItem value="1000+">Mais de 1000 funcionários</SelectItem>
                          <SelectItem value="Enterprise">Enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="faturamento_anual">Faturamento Anual</Label>
                  <Input id="faturamento_anual" {...register('faturamento_anual')} type="number" step="0.01" />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pontuacao_nps">Pontuação NPS</Label>
                  <Input id="pontuacao_nps" {...register('pontuacao_nps')} type="number" min="0" max="10" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="origem_principal">Origem Principal</Label>
                  <Controller
                    name="origem_principal"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma origem" />
                        </SelectTrigger>
                        <SelectContent>
                          {origins.map((origin) => (
                            <SelectItem key={origin.id} value={origin.name}>
                              <div className="flex items-center gap-2">
                                <span>{origin.name}</span>
                                {origin.origin_groups && (
                                  <span className="text-xs text-muted-foreground">
                                    ({origin.origin_groups.name})
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="data_tornou_cliente">Data que se Tornou Cliente</Label>
                  <Input id="data_tornou_cliente" {...register('data_tornou_cliente')} type="date" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="codigo_externo">Código Externo</Label>
                <Input id="codigo_externo" {...register('codigo_externo')} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea id="observacoes" {...register('observacoes')} rows={4} />
              </div>
            </TabsContent>

            {/* Aba 6: Pessoas (QSA) */}
            <TabsContent value="pessoas" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground mb-4">
                {qsaData.length > 0 ? (
                  <p>✅ {qsaData.length} sócio(s) será(ão) adicionado(s) automaticamente ao salvar a conta.</p>
                ) : (
                  <p>Busque o CNPJ na aba "Principais" para carregar os sócios automaticamente.</p>
                )}
              </div>

              {qsaData.length > 0 && (
                <div className="space-y-2">
                  <Label>Sócios Detectados (QSA)</Label>
                  <div className="border rounded-lg p-4 space-y-3">
                    {qsaData.map((socio, index) => (
                      <div key={index} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium">{socio.nome}</p>
                          <p className="text-sm text-muted-foreground">{socio.qualificacao}</p>
                          {socio.cpf_cnpj && (
                            <p className="text-xs text-muted-foreground font-mono mt-1">CPF/CNPJ: {socio.cpf_cnpj}</p>
                          )}
                        </div>
                        <Badge variant="secondary">{socio.faixa_etaria || 'N/A'}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Exibir erros de validação */}
          {Object.keys(errors).length > 0 && (
            <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 mt-4">
              <p className="text-sm font-medium text-destructive mb-1">Corrija os seguintes erros:</p>
              <ul className="text-sm text-destructive list-disc list-inside">
                {Object.entries(errors).map(([field, error]) => (
                  <li key={field}>{(error as any)?.message || `Campo ${field} inválido`}</li>
                ))}
              </ul>
            </div>
          )}
          
          <div className="flex justify-end gap-2 pt-6 border-t mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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