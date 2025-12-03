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
import { updateAccount, type Account } from '@/services/crm/accounts';
import { listOrigins, type OriginWithGroup } from '@/services/crm/origins';
import { useOrganizationUsers } from '@/hooks/useOrganizationUsers';
import { useAccountDetails } from '@/hooks/useAccountDetails';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Loader2, Building2, MapPin, Mail, Users, Briefcase, FileText } from 'lucide-react';

const accountSchema = z.object({
  // Dados Principais
  cnpj: z.string().optional().nullable(),
  razao_social: z.string().min(1, 'Razão social é obrigatória'),
  nome_fantasia: z.string().optional().nullable(),
  tipo_empresa: z.string().optional().nullable(),
  owner_user_id: z.string().optional().nullable(),
  cs_user_id: z.string().optional().nullable(),
  // Dados Cadastrais
  natureza_juridica: z.string().optional().nullable(),
  data_fundacao: z.string().optional().nullable(),
  capital_social: z.number().optional().nullable(),
  inscricao_estadual: z.string().optional().nullable(),
  inscricao_municipal: z.string().optional().nullable(),
  cnae: z.string().optional().nullable(),
  porte: z.string().optional().nullable(),
  situacao_cadastral: z.string().optional().nullable(),
  data_situacao_cadastral: z.string().optional().nullable(),
  matriz_filial: z.string().optional().nullable(),
  opcao_simples: z.boolean().optional().nullable(),
  opcao_mei: z.boolean().optional().nullable(),
  // Endereço
  cep: z.string().optional().nullable(),
  logradouro: z.string().optional().nullable(),
  numero: z.string().optional().nullable(),
  complemento: z.string().optional().nullable(),
  bairro: z.string().optional().nullable(),
  cidade: z.string().optional().nullable(),
  uf: z.string().optional().nullable(),
  // Contatos
  telefones: z.any().optional().nullable(),
  emails: z.array(z.string()).optional().nullable(),
  website: z.string().optional().nullable(),
  linkedin: z.string().optional().nullable(),
  instagram: z.string().optional().nullable(),
  facebook: z.string().optional().nullable(),
  email_nota_fiscal: z.string().optional().nullable(),
  // Comercial
  segmento: z.string().optional().nullable(),
  tamanho: z.string().optional().nullable(),
  origem_principal: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

type AccountFormData = z.infer<typeof accountSchema>;

export default function AccountEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);

  const { data: account, isLoading: accountLoading, error: accountError } = useAccountDetails(id!);
  const { users } = useOrganizationUsers();

  const { data: originsData } = useQuery({
    queryKey: ['origins'],
    queryFn: () => listOrigins(),
  });
  const origins = (originsData || []).filter((o: OriginWithGroup) => o.is_active);

  const { register, handleSubmit, control, formState: { errors, isDirty }, setValue, reset } = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
  });

  // Populate form when account data loads
  useEffect(() => {
    if (account) {
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
    setIsSaving(true);
    try {
      await updateMutation.mutateAsync(data);
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

  return (
    <Layout>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
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
              <Button type="submit" disabled={isSaving || !isDirty}>
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
                      <Input id="cnpj" {...register('cnpj')} placeholder="00.000.000/0000-00" />
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
                          <Select value={field.value || ''} onValueChange={field.onChange}>
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
                    <div className="space-y-2">
                      <Label htmlFor="cs_user_id">CS Responsável</Label>
                      <Controller
                        name="cs_user_id"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value || ''} onValueChange={field.onChange}>
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
                              <SelectItem value="MEDIO">Médio Porte</SelectItem>
                              <SelectItem value="GRANDE">Grande Porte</SelectItem>
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
    </Layout>
  );
}
