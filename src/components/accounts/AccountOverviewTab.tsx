import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountMetricsCard } from './AccountMetricsCard';
import { AccountDetails } from '@/hooks/useAccountDetails';
import { formatDateBR } from '@/lib/dateUtils';
import {
  TrendingUp,
  Users,
  CalendarDays,
  FileText,
  DollarSign,
  Target,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

interface AccountOverviewTabProps {
  account: AccountDetails;
}

export function AccountOverviewTab({ account }: AccountOverviewTabProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Pipeline de Vendas */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <DollarSign className="h-4 w-4" />
          Pipeline de Vendas
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <AccountMetricsCard
            title="Pipeline Aberto"
            value={formatCurrency(account.sales_pipeline_value)}
            icon={DollarSign}
            description={`${account.sales_opportunities_open} oportunidades abertas`}
          />
          <AccountMetricsCard
            title="Valor Ganho"
            value={formatCurrency(account.sales_won_value)}
            icon={CheckCircle2}
            description={`${account.sales_opportunities_won} oportunidades ganhas`}
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
      </div>

      {/* Pipeline de CS/Onboarding */}
      {account.cs_opportunities_count > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
            <Target className="h-4 w-4" />
            Pipeline CS / Onboarding
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <AccountMetricsCard
              title="Em Andamento"
              value={account.cs_opportunities_open}
              icon={Target}
              description="Oportunidades CS ativas"
              className="border-blue-500/20"
            />
            <AccountMetricsCard
              title="Total CS"
              value={account.cs_opportunities_count}
              icon={FileText}
              description="Oportunidades CS/Onboarding"
            />
            <AccountMetricsCard
              title="Contratos"
              value={account.contracts_count}
              icon={FileText}
              description="Contratos ativos"
            />
          </div>
        </div>
      )}

      {/* Métricas Gerais */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          Resumo Geral
        </h3>
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
      </div>

      {/* Informações detalhadas */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações da Empresa</CardTitle>
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
            {account.cnae && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">CNAE:</span>
                <span className="font-medium">{account.cnae}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Classificação</CardTitle>
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
            {account.created_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Cadastrado em:</span>
                <span className="font-medium">
                  {formatDateBR(account.created_at)}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
