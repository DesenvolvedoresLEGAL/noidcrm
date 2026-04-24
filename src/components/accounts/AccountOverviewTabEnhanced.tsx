import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountMetricsCard } from './AccountMetricsCard';
import { AccountDetails } from '@/hooks/useAccountDetails';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/lib/dateUtils';
import { FinancialScoreBadge } from '@/components/ui/financial-score-badge';
import { useAccountTagIds } from '@/hooks/useAccountTags';
import { useOrganizationTags } from '@/hooks/useOrganizationTags';
import { AccountTagsBadges } from './AccountTagsSelector';
import {
  TrendingUp,
  Users,
  CalendarDays,
  FileText,
  DollarSign,
  Target,
  CheckCircle2,
  XCircle,
  Building2,
  MapPin,
  Mail,
  Phone,
  Globe,
  Linkedin,
  Instagram,
  Facebook,
  User,
  Briefcase,
} from 'lucide-react';

interface AccountOverviewTabProps {
  account: AccountDetails;
}

export function AccountOverviewTabEnhanced({ account }: AccountOverviewTabProps) {
  const { data: tagIds = [] } = useAccountTagIds(account.id);
  const { tags: orgTags } = useOrganizationTags();
  const accountTags = orgTags
    .filter((t) => tagIds.includes(t.id))
    .map((t) => ({ id: t.id, name: t.name, color: t.color }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Buscar dados dos responsáveis
  const { data: ownerUser } = useQuery({
    queryKey: ['user-profile', account.owner_user_id],
    queryFn: async () => {
      if (!account.owner_user_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', account.owner_user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!account.owner_user_id,
  });

  const { data: csUser } = useQuery({
    queryKey: ['user-profile', account.cs_user_id],
    queryFn: async () => {
      if (!account.cs_user_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', account.cs_user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!account.cs_user_id,
  });

  const { data: preSalesUser } = useQuery({
    queryKey: ['user-profile', account.pre_sales_user_id],
    queryFn: async () => {
      if (!account.pre_sales_user_id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('user_id', account.pre_sales_user_id)
        .maybeSingle();
      return data;
    },
    enabled: !!account.pre_sales_user_id,
  });

  // Buscar sócios
  const { data: partners } = useQuery({
    queryKey: ['account-partners', account.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('account_partners')
        .select('*')
        .eq('account_id', account.id)
        .order('nome_socio');
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      {/* Métricas principais */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <AccountMetricsCard
          title="Pipeline Total"
          value={formatCurrency(account.pipeline_value)}
          icon={DollarSign}
          description={`${account.opportunities_open} oportunidades abertas`}
        />
        <AccountMetricsCard
          title="Valor Ganho"
          value={formatCurrency(account.won_value)}
          icon={CheckCircle2}
          description={`${account.opportunities_won} oportunidades ganhas`}
          className="border-green-500/20"
        />
        <AccountMetricsCard
          title="Contatos"
          value={account.contacts_count}
          icon={Users}
          description="Contatos cadastrados"
        />
        <AccountMetricsCard
          title="Atividades"
          value={account.activities_count}
          icon={CalendarDays}
          description="Total de atividades"
        />
      </div>

      {/* Métricas secundárias */}
      <div className="grid gap-4 md:grid-cols-3">
        <AccountMetricsCard
          title="Oportunidades Totais"
          value={account.opportunities_count}
          icon={Target}
          description={`${account.opportunities_lost} perdidas`}
        />
        <AccountMetricsCard
          title="Contratos"
          value={account.contracts_count}
          icon={FileText}
          description="Contratos assinados"
        />
        <AccountMetricsCard
          title="Taxa de Conversão"
          value={
            account.opportunities_count > 0
              ? `${Math.round((account.opportunities_won / account.opportunities_count) * 100)}%`
              : '0%'
          }
          icon={TrendingUp}
          description={
            account.opportunities_count > 0
              ? `${account.opportunities_won}/${account.opportunities_count} ganhas`
              : 'Sem oportunidades'
          }
        />
      </div>

      {/* Responsáveis */}
      {(account.owner_user_id || account.cs_user_id || account.pre_sales_user_id) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Responsáveis
            </CardTitle>
          </CardHeader>
          <CardContent className="flex gap-6 flex-wrap">
            {account.owner_user_id && ownerUser && (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{ownerUser.full_name?.charAt(0) || 'V'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{ownerUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">Vendedor Responsável</p>
                </div>
              </div>
            )}

            {account.pre_sales_user_id && preSalesUser && (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{preSalesUser.full_name?.charAt(0) || 'P'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{preSalesUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">Pré-Vendedor Responsável</p>
                </div>
              </div>
            )}

            {account.cs_user_id && csUser && (
              <div className="flex items-center gap-3">
                <Avatar>
                  <AvatarFallback>{csUser.full_name?.charAt(0) || 'CS'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{csUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">Customer Success</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Informações detalhadas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Informações da Empresa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Razão Social:</span>
              <span className="font-medium">{account.razao_social}</span>
            </div>
            {account.nome_fantasia && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nome Fantasia:</span>
                <span className="font-medium">{account.nome_fantasia}</span>
              </div>
            )}
            {account.cnpj && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNPJ:</span>
                <span className="font-medium font-mono">{account.cnpj}</span>
              </div>
            )}
            {account.tipo_empresa && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Tipo:</span>
                <Badge variant="outline">{account.tipo_empresa}</Badge>
              </div>
            )}
            {account.situacao_cadastral && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Situação:</span>
                <Badge variant={account.situacao_cadastral === 'Ativa' ? 'default' : 'secondary'}>
                  {account.situacao_cadastral}
                </Badge>
              </div>
            )}
            {account.natureza_juridica && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Natureza Jurídica:</span>
                <span className="font-medium text-right max-w-[200px]">{account.natureza_juridica}</span>
              </div>
            )}
            {account.porte && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Porte:</span>
                <span className="font-medium">{account.porte}</span>
              </div>
            )}
            {account.cnae && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNAE:</span>
                <span className="font-medium">{account.cnae}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Endereço */}
        {(account.logradouro || account.cidade) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Endereço
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {account.logradouro && (
                <p>{account.logradouro}, {account.numero}</p>
              )}
              {account.complemento && (
                <p className="text-muted-foreground">{account.complemento}</p>
              )}
              {account.bairro && (
                <p>{account.bairro}</p>
              )}
              {account.cidade && account.uf && (
                <p className="font-medium">{account.cidade} - {account.uf}</p>
              )}
              {account.cep && (
                <p className="text-muted-foreground">CEP: {account.cep}</p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Classificação */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classificação Comercial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {account.segmento && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Segmento:</span>
                <span className="font-medium">{account.segmento}</span>
              </div>
            )}
            {account.tamanho && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tamanho:</span>
                <span className="font-medium">{account.tamanho}</span>
              </div>
            )}
            {account.origem_principal && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Origem Principal:</span>
                <span className="font-medium">{account.origem_principal}</span>
              </div>
            )}
            {(account as any).faturamento_anual && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Faturamento Anual:</span>
                <span className="font-medium">{formatCurrency((account as any).faturamento_anual)}</span>
              </div>
            )}
            {account.pontuacao_nps !== null && account.pontuacao_nps !== undefined && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">NPS:</span>
                <Badge variant={account.pontuacao_nps >= 7 ? 'default' : 'secondary'}>
                  {account.pontuacao_nps}/10
                </Badge>
              </div>
            )}
            {account.created_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cadastrado em:</span>
                <span className="font-medium">
                  {formatDateBR(account.created_at)}
                </span>
              </div>
            )}
            {accountTags.length > 0 && (
              <div className="pt-2 border-t">
                <span className="text-muted-foreground block mb-2">Tags:</span>
                <AccountTagsBadges tags={accountTags} max={10} />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score Financeiro (ERP) */}
        {account.score_financeiro != null && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                Score Financeiro (ERP)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Score:</span>
                <FinancialScoreBadge
                  score={account.score_financeiro}
                  riskLevel={account.risco_financeiro}
                  factors={account.score_fatores}
                />
              </div>
              {account.total_titulos != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Títulos totais:</span>
                  <span className="font-medium">{account.total_titulos}</span>
                </div>
              )}
              {account.titulos_pagos != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Pagos:</span>
                  <span className="font-medium text-emerald-600">{account.titulos_pagos}</span>
                </div>
              )}
              {account.titulos_vencidos != null && account.titulos_vencidos > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vencidos:</span>
                  <span className="font-medium text-red-600">{account.titulos_vencidos}</span>
                </div>
              )}
              {account.taxa_pagamento_pct != null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taxa de pagamento:</span>
                  <span className="font-medium">{account.taxa_pagamento_pct}%</span>
                </div>
              )}
              {account.valor_total != null && account.valor_total > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor total:</span>
                  <span className="font-medium">{formatCurrency(account.valor_total)}</span>
                </div>
              )}
              {account.valor_vencido != null && account.valor_vencido > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Valor vencido:</span>
                  <span className="font-medium text-red-600">{formatCurrency(account.valor_vencido)}</span>
                </div>
              )}
              {account.score_calculado_em && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Atualizado em:</span>
                  <span className="text-xs text-muted-foreground">{formatDateBR(account.score_calculado_em)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Redes Sociais e Contato */}
        {(account.website || account.linkedin || account.instagram || account.facebook || account.email_nota_fiscal) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4" />
                Redes Sociais & Contato
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {account.website && (
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-muted-foreground" />
                  <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {account.website}
                  </a>
                </div>
              )}
              {account.linkedin && (
                <div className="flex items-center gap-2">
                  <Linkedin className="w-4 h-4 text-muted-foreground" />
                  <a href={account.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    LinkedIn
                  </a>
                </div>
              )}
              {account.instagram && (
                <div className="flex items-center gap-2">
                  <Instagram className="w-4 h-4 text-muted-foreground" />
                  <span>{account.instagram}</span>
                </div>
              )}
              {account.facebook && (
                <div className="flex items-center gap-2">
                  <Facebook className="w-4 h-4 text-muted-foreground" />
                  <a href={account.facebook} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    Facebook
                  </a>
                </div>
              )}
              {account.email_nota_fiscal && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>{account.email_nota_fiscal}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Sócios/QSA */}
      {partners && partners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Sócios e Administradores (QSA)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {partners.map((partner: any) => (
                <div key={partner.id} className="flex items-start justify-between p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {partner.nome_socio.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm">{partner.nome_socio}</p>
                      <p className="text-xs text-muted-foreground">{partner.qualificacao}</p>
                      {partner.cpf_cnpj_socio && (
                        <p className="text-xs text-muted-foreground font-mono mt-1">
                          {partner.cpf_cnpj_socio}
                        </p>
                      )}
                    </div>
                  </div>
                  {partner.faixa_etaria && (
                    <Badge variant="outline" className="text-xs">
                      {partner.faixa_etaria}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observações */}
      {account.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Observações</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{account.observacoes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}