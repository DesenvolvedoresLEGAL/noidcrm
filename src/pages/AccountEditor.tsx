import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { updateAccount, lookupCNPJ, type Account } from '@/services/crm/accounts';
import { listOrigins, type OriginWithGroup } from '@/services/crm/origins';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useAccountDetails } from '@/hooks/useAccountDetails';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2, Building2, MapPin, Mail, Users, Briefcase, FileText, Search, UserPlus } from 'lucide-react';
import { createContact } from '@/services/crm/contacts';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
// Helper: transforma string vazia em null para campos UUID/opcionais
const emptyToNull = (v: string | null | undefined) => (v === '' ? null : v);

// Helper: transforma string para número ou null
const stringToNumber = (v: string | number | null | undefined) => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const num = parseFloat(String(v).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
};

const accountSchema = z.object({
  // Dados Principais
  cnpj: z.string().optional().nullable().transform(emptyToNull),
  razao_social: z.string().min(1, 'Razão social é obrigatória'),
  nome_fantasia: z.string().optional().nullable().transform(emptyToNull),
  tipo_empresa: z.string().optional().nullable().transform(emptyToNull),
  owner_user_id: z.string().optional().nullable().transform(emptyToNull),
  cs_user_id: z.string().optional().nullable().transform(emptyToNull),
  // Dados Cadastrais
  natureza_juridica: z.string().optional().nullable().transform(emptyToNull),
  data_fundacao: z.string().optional().nullable().transform(emptyToNull),
  capital_social: z.union([z.string(), z.number(), z.null()]).optional().transform(stringToNumber),
  inscricao_estadual: z.string().optional().nullable().transform(emptyToNull),
  inscricao_municipal: z.string().optional().nullable().transform(emptyToNull),
  cnae: z.union([z.string(), z.number()]).optional().nullable().transform((v) => v === '' || v === null || v === undefined ? null : String(v)),
  porte: z.string().optional().nullable().transform(emptyToNull),
  situacao_cadastral: z.string().optional().nullable().transform(emptyToNull),
  data_situacao_cadastral: z.string().optional().nullable().transform(emptyToNull),
  matriz_filial: z.string().optional().nullable().transform(emptyToNull),
  opcao_simples: z.boolean().optional().nullable(),
  opcao_mei: z.boolean().optional().nullable(),
  // Endereço
  cep: z.string().optional().nullable().transform(emptyToNull),
  logradouro: z.string().optional().nullable().transform(emptyToNull),
  numero: z.string().optional().nullable().transform(emptyToNull),
  complemento: z.string().optional().nullable().transform(emptyToNull),
  bairro: z.string().optional().nullable().transform(emptyToNull),
  cidade: z.string().optional().nullable().transform(emptyToNull),
  uf: z.string().optional().nullable().transform(emptyToNull),
  // Contatos - arrays sempre válidos
  telefones: z.any().optional().nullable().transform((v) => {
    if (!v || (Array.isArray(v) && v.length === 0)) return [];
    return v;
  }),
  emails: z.any().optional().nullable().transform((v) => {
    if (!v || (Array.isArray(v) && v.length === 0)) return [];
    return v;
  }),
  website: z.string().optional().nullable().transform(emptyToNull),
  linkedin: z.string().optional().nullable().transform(emptyToNull),
  instagram: z.string().optional().nullable().transform(emptyToNull),
  facebook: z.string().optional().nullable().transform(emptyToNull),
  email_nota_fiscal: z.string().optional().nullable().transform(emptyToNull),
  // Comercial
  segmento: z.string().optional().nullable().transform(emptyToNull),
  tamanho: z.string().optional().nullable().transform(emptyToNull),
  origem_principal: z.string().optional().nullable().transform(emptyToNull),
  observacoes: z.string().optional().nullable().transform(emptyToNull),
});

type AccountFormData = z.infer<typeof accountSchema>;

export default function AccountEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingCNPJ, setIsLoadingCNPJ] = useState(false);
  const [cnpjToLookup, setCnpjToLookup] = useState('');
  
  // QSA Modal State
  const [qsaModalOpen, setQsaModalOpen] = useState(false);
  const [qsaData, setQsaData] = useState<Array<{ nome: string; qualificacao: string; selected: boolean }>>([]);
  const [isCreatingContacts, setIsCreatingContacts] = useState(false);

  const { data: account, isLoading: accountLoading, error: accountError } = useAccountDetails(id!);
  const { users, loading: usersLoading } = useOrganizationUsers();

  const { data: originsData } = useQuery({
    queryKey: ['origins'],
    queryFn: () => listOrigins(),
  });
  const origins = (originsData || []).filter((o: OriginWithGroup) => o.is_active);

  const { register, handleSubmit, control, formState: { errors, isSubmitting }, setValue, watch, reset } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    mode: 'onSubmit',
  });

  // Log de erros de validação para debug
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.error('❌ Erros de validação do formulário:', errors);
    }
  }, [errors]);

  const watchCnpj = watch('cnpj');

  // Sync cnpjToLookup with watched cnpj
  useEffect(() => {
    if (watchCnpj) {
      setCnpjToLookup(watchCnpj);
    }
  }, [watchCnpj]);

  // Populate form when account data loads
  useEffect(() => {
    if (account) {
      setCnpjToLookup(account.cnpj || '');
      reset({
        cnpj: account.cnpj || '',
        razao_social: account.razao_social || '',
        nome_fantasia: account.nome_fantasia || '',
        tipo_empresa: account.tipo_empresa || '',
        owner_user_id: account.owner_user_id || '',
        cs_user_id: account.cs_user_id || '',
        natureza_juridica: account.natureza_juridica || '',
        data_fundacao: account.data_fundacao || '',
        capital_social: account.capital_social || null,
        inscricao_estadual: account.inscricao_estadual || '',
        inscricao_municipal: account.inscricao_municipal || '',
        cnae: account.cnae || '',
        porte: account.porte || '',
        situacao_cadastral: account.situacao_cadastral || '',
        data_situacao_cadastral: account.data_situacao_cadastral || '',
        matriz_filial: account.matriz_filial || '',
        opcao_simples: account.opcao_simples || false,
        opcao_mei: account.opcao_mei || false,
        cep: account.cep || '',
        logradouro: account.logradouro || '',
        numero: account.numero || '',
        complemento: account.complemento || '',
        bairro: account.bairro || '',
        cidade: account.cidade || '',
        uf: account.uf || '',
        telefones: account.telefones || [],
        emails: account.emails || [],
        website: account.website || '',
        linkedin: account.linkedin || '',
        instagram: account.instagram || '',
        facebook: account.facebook || '',
        email_nota_fiscal: account.email_nota_fiscal || '',
        segmento: account.segmento || '',
        tamanho: account.tamanho || '',
        origem_principal: account.origem_principal || '',
        observacoes: account.observacoes || '',
      });
    }
  }, [account, reset]);

  // Handle CNPJ lookup
  const handleCNPJLookup = async () => {
    const cleanCnpj = cnpjToLookup.replace(/\D/g, '');
    
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
      const data = await lookupCNPJ(cleanCnpj);
      
      // Preencher todos os campos automaticamente
      setValue('razao_social', data.razao_social, { shouldDirty: true });
      setValue('nome_fantasia', data.nome_fantasia || '', { shouldDirty: true });
      setValue('natureza_juridica', data.natureza_juridica || '', { shouldDirty: true });
      setValue('porte', data.porte || '', { shouldDirty: true });
      setValue('capital_social', data.capital_social || null, { shouldDirty: true });
      setValue('situacao_cadastral', data.situacao_cadastral || '', { shouldDirty: true });
      setValue('data_fundacao', data.data_fundacao || '', { shouldDirty: true });
      setValue('cnae', data.cnae_principal?.codigo || '', { shouldDirty: true });
      setValue('opcao_simples', data.opcao_simples || false, { shouldDirty: true });
      setValue('opcao_mei', data.opcao_mei || false, { shouldDirty: true });
      
      // Endereço
      setValue('cep', data.cep || '', { shouldDirty: true });
      setValue('logradouro', data.logradouro || '', { shouldDirty: true });
      setValue('numero', data.numero || '', { shouldDirty: true });
      setValue('complemento', data.complemento || '', { shouldDirty: true });
      setValue('bairro', data.bairro || '', { shouldDirty: true });
      setValue('cidade', data.cidade || '', { shouldDirty: true });
      setValue('uf', data.uf || '', { shouldDirty: true });
      
      // Contatos
      setValue('telefones', data.telefones || [], { shouldDirty: true });
      setValue('emails', data.email ? [data.email] : [], { shouldDirty: true });

      toast({
        title: '✅ Dados carregados com sucesso!',
        description: `${data.razao_social || 'Empresa'} - Dados da Receita Federal preenchidos automaticamente`,
      });

      // Check if QSA (partners) data exists and show modal
      if (data.qsa && data.qsa.length > 0) {
        setQsaData(data.qsa.map(socio => ({
          nome: socio.nome,
          qualificacao: socio.qualificacao,
          selected: true, // Pre-select all by default
        })));
        setQsaModalOpen(true);
      }
    } catch (error) {
      let errorTitle = 'Erro ao buscar CNPJ';
      let errorDescription = 'Erro desconhecido';
      
      if (error instanceof Error) {
        if (error.message.includes('Failed to send a request')) {
          errorTitle = 'Serviço indisponível';
          errorDescription = 'O serviço de busca de CNPJ está temporariamente indisponível. Tente novamente em alguns instantes.';
        } else if (error.message.includes('Failed to fetch')) {
          errorTitle = 'Erro de conexão';
          errorDescription = 'Verifique sua conexão com a internet e tente novamente.';
        } else if (error.message.includes('temporariamente sobrecarregados')) {
          errorTitle = 'Consulta temporariamente indisponível';
          errorDescription = 'Os provedores de CNPJ estão sobrecarregados no momento. Tente novamente em alguns instantes.';
        } else if (error.message.includes('não encontrado')) {
          errorTitle = 'CNPJ não encontrado';
          errorDescription = 'CNPJ não encontrado na base da Receita Federal. Verifique o número digitado.';
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

  // Handle QSA selection toggle
  const toggleQsaSelection = (index: number) => {
    setQsaData(prev => prev.map((item, i) => 
      i === index ? { ...item, selected: !item.selected } : item
    ));
  };

  // Create contacts from selected QSA members
  const handleCreateContactsFromQSA = async () => {
    const selectedPartners = qsaData.filter(p => p.selected);
    
    if (selectedPartners.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nenhum sócio selecionado',
        description: 'Selecione pelo menos um sócio para criar como contato.',
      });
      return;
    }

    setIsCreatingContacts(true);
    let created = 0;
    let errors = 0;

    for (const partner of selectedPartners) {
      try {
        await createContact({
          nome: partner.nome,
          cargo: partner.qualificacao || 'Sócio',
          account_id: id,
        });
        created++;
      } catch (error) {
        console.error(`Erro ao criar contato ${partner.nome}:`, error);
        errors++;
      }
    }

    setIsCreatingContacts(false);
    setQsaModalOpen(false);
    queryClient.invalidateQueries({ queryKey: ['contacts'] });

    if (created > 0) {
      toast({
        title: `✅ ${created} contato(s) criado(s)`,
        description: errors > 0 
          ? `${errors} contato(s) não puderam ser criados (possível duplicidade)`
          : 'Sócios adicionados como contatos vinculados à conta.',
      });
    } else {
      toast({
        variant: 'destructive',
        title: 'Erro ao criar contatos',
        description: 'Nenhum contato pôde ser criado. Verifique se já existem.',
      });
    }
  };

  const updateMutation = useMutation({
    mutationFn: (data: AccountFormData) => updateAccount(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-details', id] });
      toast({ title: 'Conta atualizada com sucesso!' });
      navigate(`/app/accounts/${id}`);
    },
    onError: (error: Error) => {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar',
        description: error.message,
      });
    },
  });

  const onSubmit = async (data: AccountFormData) => {
    console.log('🔵 AccountEditor.onSubmit - dados recebidos:', data);
    setIsSaving(true);
    try {
      // Pré-processar: converter strings vazias em null
      const processedData = Object.fromEntries(
        Object.entries(data).map(([key, value]) => [
          key,
          value === '' ? null : value
        ])
      ) as AccountFormData;
      
      console.log('🔵 AccountEditor.onSubmit - dados processados:', processedData);
      await updateMutation.mutateAsync(processedData);
    } catch (error) {
      console.error('❌ AccountEditor.onSubmit - erro:', error);
      // Mutation onError já trata, mas garantir feedback
      if (error instanceof Error && !error.message.includes('Erro ao atualizar')) {
        toast({
          variant: 'destructive',
          title: 'Erro ao salvar',
          description: error.message,
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (accountLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
            <p className="text-muted-foreground">Carregando conta...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (accountError || !account) {
    return (
      <Layout>
        <div className="p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <p className="text-destructive mb-4">
                  {accountError?.message || 'Conta não encontrada'}
                </p>
                <Button variant="link" onClick={() => navigate('/app/accounts')}>
                  Voltar para Contas
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  // Handler de erros de validação
  const onValidationError = (validationErrors: any) => {
    console.error('❌ Erros de validação:', validationErrors);
    const errorMessages = Object.entries(validationErrors)
      .map(([field, error]: [string, any]) => `${field}: ${error?.message || 'Campo inválido'}`)
      .join(', ');
    
    toast({
      variant: 'destructive',
      title: 'Erro de validação',
      description: errorMessages || 'Verifique os campos do formulário',
    });
  };

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit, onValidationError)} className="flex flex-col h-full">
        {/* Fixed Header */}
        <div className="sticky top-0 z-10 bg-background border-b">
          <div className="px-4 md:px-8 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => navigate(`/app/accounts/${id}`)}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold">
                    {account.nome_fantasia || account.razao_social}
                  </h1>
                  <p className="text-xs text-muted-foreground">Editando conta</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/app/accounts/${id}`)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salvar Alterações
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <Tabs defaultValue="principais" className="w-full">
            <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6 lg:w-auto lg:inline-grid mb-6">
              <TabsTrigger value="principais" className="gap-2">
                <Building2 className="h-4 w-4 hidden sm:inline" />
                Principais
              </TabsTrigger>
              <TabsTrigger value="cadastrais" className="gap-2">
                <FileText className="h-4 w-4 hidden sm:inline" />
                Cadastrais
              </TabsTrigger>
              <TabsTrigger value="endereco" className="gap-2">
                <MapPin className="h-4 w-4 hidden sm:inline" />
                Endereço
              </TabsTrigger>
              <TabsTrigger value="contatos" className="gap-2">
                <Mail className="h-4 w-4 hidden sm:inline" />
                Contatos
              </TabsTrigger>
              <TabsTrigger value="comercial" className="gap-2">
                <Briefcase className="h-4 w-4 hidden sm:inline" />
                Comercial
              </TabsTrigger>
              <TabsTrigger value="pessoas" className="gap-2">
                <Users className="h-4 w-4 hidden sm:inline" />
                Pessoas
              </TabsTrigger>
            </TabsList>

            {/* Tab: Dados Principais */}
            <TabsContent value="principais">
              <Card>
                <CardHeader>
                  <CardTitle>Dados Principais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <div className="flex gap-2">
                        <Controller
                          name="cnpj"
                          control={control}
                          render={({ field }) => (
                            <Input 
                              id="cnpj" 
                              value={field.value || ''}
                              onChange={(e) => {
                                let value = e.target.value.replace(/\D/g, '');
                                if (value.length > 14) value = value.slice(0, 14);
                                if (value.length > 12) {
                                  value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
                                } else if (value.length > 8) {
                                  value = value.replace(/^(\d{2})(\d{3})(\d{3})(\d+)$/, '$1.$2.$3/$4');
                                } else if (value.length > 5) {
                                  value = value.replace(/^(\d{2})(\d{3})(\d+)$/, '$1.$2.$3');
                                } else if (value.length > 2) {
                                  value = value.replace(/^(\d{2})(\d+)$/, '$1.$2');
                                }
                                field.onChange(value);
                                setCnpjToLookup(value);
                              }}
                              placeholder="00.000.000/0000-00" 
                              className="flex-1"
                              maxLength={18}
                            />
                          )}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={handleCNPJLookup}
                          disabled={isLoadingCNPJ}
                          title="Buscar dados na Receita Federal"
                        >
                          {isLoadingCNPJ ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Search className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tipo_empresa">Tipo de Empresa</Label>
                      <Controller
                        name="tipo_empresa"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="cliente">Cliente</SelectItem>
                              <SelectItem value="prospect">Prospect</SelectItem>
                              <SelectItem value="parceiro">Parceiro</SelectItem>
                              <SelectItem value="fornecedor">Fornecedor</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="razao_social">Razão Social *</Label>
                      <Input id="razao_social" {...register('razao_social')} />
                      {errors.razao_social && (
                        <p className="text-xs text-destructive">{errors.razao_social.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
                      <Input id="nome_fantasia" {...register('nome_fantasia')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="owner_user_id">Vendedor Responsável</Label>
                      <Controller
                        name="owner_user_id"
                        control={control}
                        render={({ field }) => (
                          <Select 
                            value={field.value || ''} 
                            onValueChange={field.onChange}
                            disabled={usersLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={usersLoading ? "Carregando..." : "Selecione"} />
                            </SelectTrigger>
                            <SelectContent>
                              {usersLoading ? (
                                <SelectItem value="_loading" disabled>Carregando usuários...</SelectItem>
                              ) : users.length === 0 ? (
                                <SelectItem value="_empty" disabled>Nenhum usuário encontrado</SelectItem>
                              ) : (
                                users.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cs_user_id">CS Responsável</Label>
                      <Controller
                        name="cs_user_id"
                        control={control}
                        render={({ field }) => (
                          <Select 
                            value={field.value || ''} 
                            onValueChange={field.onChange}
                            disabled={usersLoading}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={usersLoading ? "Carregando..." : "Selecione"} />
                            </SelectTrigger>
                            <SelectContent>
                              {usersLoading ? (
                                <SelectItem value="_loading" disabled>Carregando usuários...</SelectItem>
                              ) : users.length === 0 ? (
                                <SelectItem value="_empty" disabled>Nenhum usuário encontrado</SelectItem>
                              ) : (
                                users.map((user) => (
                                  <SelectItem key={user.id} value={user.id}>
                                    {user.name}
                                  </SelectItem>
                                ))
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Dados Cadastrais */}
            <TabsContent value="cadastrais">
              <Card>
                <CardHeader>
                  <CardTitle>Dados Cadastrais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="natureza_juridica">Natureza Jurídica</Label>
                      <Input id="natureza_juridica" {...register('natureza_juridica')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_fundacao">Data de Fundação</Label>
                      <Input id="data_fundacao" type="date" {...register('data_fundacao')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="capital_social">Capital Social</Label>
                      <Input 
                        id="capital_social" 
                        type="number" 
                        step="0.01"
                        {...register('capital_social', { valueAsNumber: true })} 
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnae">CNAE Principal</Label>
                      <Input id="cnae" {...register('cnae')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
                      <Input id="inscricao_estadual" {...register('inscricao_estadual')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="inscricao_municipal">Inscrição Municipal</Label>
                      <Input id="inscricao_municipal" {...register('inscricao_municipal')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="porte">Porte</Label>
                      <Controller
                        name="porte"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MEI">MEI</SelectItem>
                              <SelectItem value="ME">ME - Microempresa</SelectItem>
                              <SelectItem value="EPP">EPP - Empresa de Pequeno Porte</SelectItem>
                              <SelectItem value="Médio Porte">Médio Porte</SelectItem>
                              <SelectItem value="Grande Porte">Grande Porte</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="matriz_filial">Matriz/Filial</Label>
                      <Controller
                        name="matriz_filial"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="MATRIZ">Matriz</SelectItem>
                              <SelectItem value="FILIAL">Filial</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="situacao_cadastral">Situação Cadastral</Label>
                      <Input id="situacao_cadastral" {...register('situacao_cadastral')} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_situacao_cadastral">Data Situação</Label>
                      <Input id="data_situacao_cadastral" type="date" {...register('data_situacao_cadastral')} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Endereço */}
            <TabsContent value="endereco">
              <Card>
                <CardHeader>
                  <CardTitle>Endereço</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cep">CEP</Label>
                      <Input id="cep" {...register('cep')} placeholder="00000-000" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="logradouro">Logradouro</Label>
                      <Input id="logradouro" {...register('logradouro')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="numero">Número</Label>
                      <Input id="numero" {...register('numero')} />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="complemento">Complemento</Label>
                      <Input id="complemento" {...register('complemento')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                      <Controller
                        name="uf"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].map(uf => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Contatos */}
            <TabsContent value="contatos">
              <Card>
                <CardHeader>
                  <CardTitle>Contatos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <Input id="website" {...register('website')} placeholder="https://" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email_nota_fiscal">Email para Nota Fiscal</Label>
                      <Input id="email_nota_fiscal" type="email" {...register('email_nota_fiscal')} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <Input id="linkedin" {...register('linkedin')} placeholder="https://linkedin.com/company/" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="instagram">Instagram</Label>
                      <Input id="instagram" {...register('instagram')} placeholder="@empresa" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="facebook">Facebook</Label>
                    <Input id="facebook" {...register('facebook')} placeholder="https://facebook.com/" />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Comercial */}
            <TabsContent value="comercial">
              <Card>
                <CardHeader>
                  <CardTitle>Dados Comerciais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="segmento">Segmento</Label>
                      <Controller
                        name="segmento"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="tecnologia">Tecnologia</SelectItem>
                              <SelectItem value="varejo">Varejo</SelectItem>
                              <SelectItem value="industria">Indústria</SelectItem>
                              <SelectItem value="servicos">Serviços</SelectItem>
                              <SelectItem value="saude">Saúde</SelectItem>
                              <SelectItem value="educacao">Educação</SelectItem>
                              <SelectItem value="financeiro">Financeiro</SelectItem>
                              <SelectItem value="agro">Agronegócio</SelectItem>
                              <SelectItem value="outro">Outro</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tamanho">Tamanho da Empresa</Label>
                      <Controller
                        name="tamanho"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1-10">1-10 funcionários</SelectItem>
                              <SelectItem value="11-50">11-50 funcionários</SelectItem>
                              <SelectItem value="51-200">51-200 funcionários</SelectItem>
                              <SelectItem value="201-500">201-500 funcionários</SelectItem>
                              <SelectItem value="501-1000">501-1000 funcionários</SelectItem>
                              <SelectItem value="1000+">1000+ funcionários</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </div>

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
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      {...register('observacoes')}
                      rows={4}
                      placeholder="Informações adicionais sobre a conta..."
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Pessoas/Sócios */}
            <TabsContent value="pessoas">
              <Card>
                <CardHeader>
                  <CardTitle>Sócios e Administradores</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground text-sm">
                    Os sócios são importados automaticamente ao buscar o CNPJ. 
                    Para gerenciá-los, utilize a tela de criação de conta ou o modal de edição.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </form>

      {/* QSA Modal - Create contacts from partners */}
      <Dialog open={qsaModalOpen} onOpenChange={setQsaModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Sócios Encontrados
            </DialogTitle>
            <DialogDescription>
              Foram encontrados {qsaData.length} sócio(s) no CNPJ. 
              Selecione quais deseja adicionar como contatos.
            </DialogDescription>
          </DialogHeader>
          
          <div className="max-h-[300px] overflow-y-auto space-y-2">
            {qsaData.map((partner, index) => (
              <div 
                key={index}
                className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={`partner-${index}`}
                  checked={partner.selected}
                  onCheckedChange={() => toggleQsaSelection(index)}
                />
                <label 
                  htmlFor={`partner-${index}`}
                  className="flex-1 cursor-pointer"
                >
                  <div className="font-medium text-sm">{partner.nome}</div>
                  <div className="text-xs text-muted-foreground">{partner.qualificacao}</div>
                </label>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button 
              variant="outline" 
              onClick={() => setQsaModalOpen(false)}
              disabled={isCreatingContacts}
            >
              Pular
            </Button>
            <Button 
              onClick={handleCreateContactsFromQSA}
              disabled={isCreatingContacts || qsaData.filter(p => p.selected).length === 0}
            >
              {isCreatingContacts ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Criar {qsaData.filter(p => p.selected).length} Contato(s)
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
