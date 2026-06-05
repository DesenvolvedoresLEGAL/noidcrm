import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { FinancialScoreBadge } from '@/components/ui/financial-score-badge';
import { AccountDetails } from '@/hooks/useAccountDetails';
import { useAccountFinancialDetails } from '@/hooks/useAccountFinancialDetails';
import { formatDateBR } from '@/lib/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { accountKeys } from '@/lib/query-keys';
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  RefreshCw,
  ShieldQuestion,
  Loader2,
} from 'lucide-react';

interface AccountFinancialTabProps {
  account: AccountDetails;
}

export function AccountFinancialTab({ account }: AccountFinancialTabProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  // PERF 0.6D: JSONBs pesados carregados apenas quando a aba Financeiro está visível.
  const { data: financialDetails } = useAccountFinancialDetails(account.id);
  const scoreFatores = financialDetails?.score_fatores ?? account.score_fatores;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);


  const handleSyncFromErp = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-account-from-erp', {
        body: { account_id: account.id },
      });

      if (error) {
        console.error('Sync function error:', error);
        toast.error('Erro ao conectar com o serviço de sincronização', {
          description: 'Tente novamente em alguns minutos.',
        });
        return;
      }

      if (data?.success === false) {
        const errorType = data.error_type;
        if (errorType === 'ERP_AUTH_INVALID') {
          toast.error('Autenticação do ERP rejeitada', {
            description: data.error,
          });
        } else if (errorType === 'ERP_BASE_URL_INVALID') {
          toast.error('URL do ERP inválida', {
            description: data.error,
          });
        } else if (errorType === 'ERP_NETWORK_ERROR' || errorType === 'ERP_TIMEOUT') {
          toast.warning('ERP indisponível', {
            description: data.error,
          });
        } else if (errorType === 'ERP_ACCOUNT_NOT_FOUND') {
          toast.warning('Conta ainda não existe no ERP', {
            description: data.error,
          });
        } else {
          toast.error('Erro na sincronização', {
            description: data.error || 'Tente novamente mais tarde.',
          });
        }
        return;
      }

      toast.success('Dados financeiros sincronizados com sucesso!', {
        description: data.synced_fields?.length
          ? `Campos atualizados: ${data.synced_fields.join(', ')}`
          : 'Nenhum campo novo encontrado no ERP.',
      });

      queryClient.invalidateQueries({ queryKey: accountKeys.detailExtended(account.id) });
    } catch (err: any) {
      console.error('Sync error:', err);
      toast.error('Erro ao sincronizar com ERP', {
        description: 'Tente novamente mais tarde.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const hasFinancialData =
    account.score_financeiro != null ||
    account.total_titulos != null ||
    account.valor_total != null;

  if (!hasFinancialData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldQuestion className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            Sem dados financeiros
          </h3>
          <p className="text-sm text-muted-foreground max-w-md mb-6">
            {account.erp_sync_at
              ? `Última sincronização em ${formatDateBR(account.erp_sync_at)}, mas nenhum dado financeiro foi retornado.`
              : 'Os dados financeiros desta conta ainda não foram sincronizados. Clique abaixo para buscar do ERP.'}
          </p>
          <Button
            variant="outline"
            onClick={handleSyncFromErp}
            disabled={isSyncing || (!account.cnpj)}
          >
            {isSyncing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar com ERP'}
          </Button>
          {!account.cnpj && (
            <p className="text-xs text-muted-foreground mt-2">
              Conta sem CNPJ cadastrado — não é possível consultar o ERP.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const paymentRate = account.taxa_pagamento_pct ?? 0;
  const totalTitulos = account.total_titulos ?? 0;
  const titulosPagos = account.titulos_pagos ?? 0;
  const titulosVencidos = account.titulos_vencidos ?? 0;
  const valorTotal = account.valor_total ?? 0;
  const valorVencido = account.valor_vencido ?? 0;
  const valorEmDia = valorTotal - valorVencido;
  const overdueRate = totalTitulos > 0 ? (titulosVencidos / totalTitulos) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Sync Status Bar */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {account.erp_sync_at
            ? `Última sync ERP: ${formatDateBR(account.erp_sync_at)}`
            : 'Nunca sincronizado com ERP'}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSyncFromErp}
          disabled={isSyncing || (!account.cnpj)}
        >
          {isSyncing ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
        </Button>
      </div>

      {/* Score + Risk Level */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Score Financeiro
            </CardTitle>
            {account.score_calculado_em && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <RefreshCw className="w-3 h-3" />
                Calculado em {formatDateBR(account.score_calculado_em)}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center">
              <span className="text-4xl font-bold text-foreground">
                {account.score_financeiro ?? '—'}
              </span>
              <span className="text-xs text-muted-foreground">/100</span>
            </div>
            <div className="flex-1 space-y-2">
              <FinancialScoreBadge
                score={account.score_financeiro}
                riskLevel={account.risco_financeiro}
                factors={account.score_fatores}
              />
              <Progress
                value={account.score_financeiro ?? 0}
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <FileText className="w-3.5 h-3.5" />
              Títulos Totais
            </div>
            <p className="text-2xl font-bold text-foreground">{totalTitulos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs mb-1 text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Pagos
            </div>
            <p className="text-2xl font-bold text-emerald-600">{titulosPagos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-xs mb-1 text-red-600">
              <AlertTriangle className="w-3.5 h-3.5" />
              Vencidos
            </div>
            <p className="text-2xl font-bold text-red-600">{titulosVencidos}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <TrendingUp className="w-3.5 h-3.5" />
              Taxa Pgto
            </div>
            <p className="text-2xl font-bold text-foreground">{paymentRate}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Financial Values */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Valores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Valor Total</span>
              <span className="font-semibold text-foreground">{formatCurrency(valorTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Em dia</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(valorEmDia)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Vencido</span>
              <span className="font-semibold text-red-600">{formatCurrency(valorVencido)}</span>
            </div>
            {valorTotal > 0 && (
              <div className="pt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Inadimplência</span>
                  <span>{((valorVencido / valorTotal) * 100).toFixed(1)}%</span>
                </div>
                <Progress value={(valorVencido / valorTotal) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Indicadores
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Taxa de Pagamento</span>
              <Badge variant="outline" className={paymentRate >= 80 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : paymentRate >= 50 ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-red-200 text-red-700 bg-red-50'}>
                {paymentRate}%
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Taxa de Inadimplência</span>
              <Badge variant="outline" className={overdueRate <= 10 ? 'border-emerald-200 text-emerald-700 bg-emerald-50' : overdueRate <= 30 ? 'border-amber-200 text-amber-700 bg-amber-50' : 'border-red-200 text-red-700 bg-red-50'}>
                {overdueRate.toFixed(1)}%
              </Badge>
            </div>
            {account.erp_sync_at && (
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-xs text-muted-foreground">Última sync ERP</span>
                <span className="text-xs text-muted-foreground">{formatDateBR(account.erp_sync_at)}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
