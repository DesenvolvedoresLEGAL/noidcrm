import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Users, 
  UserCircle, 
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ArrowRightLeft
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';

type PipelineContext = 'qualification' | 'sales' | 'onboarding';

interface SellerVsClientReasonsChartProps {
  organizationId: string;
  pipelineContext?: PipelineContext;
}

interface ComparisonData {
  reason: string;
  sellerCount: number;
  clientCount: number;
}

interface DealComparison {
  opportunityId: string;
  title: string;
  sellerReason: string | null;
  clientReason: string | null;
  match: boolean;
}

const CONTEXT_LABELS: Record<PipelineContext, { lost: string; lostPlural: string }> = {
  qualification: { lost: 'lead desqualificado', lostPlural: 'leads desqualificados' },
  sales: { lost: 'deal perdido', lostPlural: 'deals perdidos' },
  onboarding: { lost: 'churn', lostPlural: 'churns' }
};

export function SellerVsClientReasonsChart({ organizationId, pipelineContext = 'sales' }: SellerVsClientReasonsChartProps) {
  const contextLabels = CONTEXT_LABELS[pipelineContext];
  
  const { data, isLoading } = useQuery({
    queryKey: ['seller-vs-client-reasons', organizationId, pipelineContext],
    queryFn: async () => {
      // Get pipeline IDs based on context
      const pipelineTypes = pipelineContext === 'onboarding' 
        ? ['onboarding', 'cs', 'renewal'] 
        : [pipelineContext];
      
      const { data: pipelines } = await supabase
        .from('pipelines')
        .select('id')
        .eq('organization_id', organizationId)
        .in('pipeline_type', pipelineTypes);
      
      const pipelineIds = pipelines?.map(p => p.id) || [];
      
      if (pipelineIds.length === 0) return null;

      // Fetch lost opportunities with their loss reasons
      const { data: opportunities, error: oppError } = await supabase
        .from('opportunities')
        .select(`
          id,
          title,
          loss_reason_id,
          loss_comment,
          loss_reason:loss_reasons(name),
          pipeline_id
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'lost')
        .in('pipeline_id', pipelineIds);

      if (oppError) throw oppError;

      // Fetch proposals with decline reasons
      const { data: proposals, error: propError } = await supabase
        .from('proposals')
        .select(`
          id,
          opportunity_id,
          declined_reason,
          declined_at
        `)
        .eq('organization_id', organizationId)
        .eq('status', 'rejected')
        .not('declined_reason', 'is', null);

      if (propError) throw propError;

      // Map proposals by opportunity_id
      const proposalsByOpp = new Map<string, string>();
      proposals?.forEach(p => {
        if (p.opportunity_id && p.declined_reason) {
          proposalsByOpp.set(p.opportunity_id, p.declined_reason);
        }
      });

      // Count seller reasons
      const sellerReasonCounts: Record<string, number> = {};
      const clientReasonCounts: Record<string, number> = {};
      const dealComparisons: DealComparison[] = [];

      opportunities?.forEach(opp => {
        const sellerReason = (opp.loss_reason as any)?.name || opp.loss_comment || null;
        const clientReason = proposalsByOpp.get(opp.id) || null;

        if (sellerReason) {
          sellerReasonCounts[sellerReason] = (sellerReasonCounts[sellerReason] || 0) + 1;
        }

        if (clientReason) {
          // Parse client reason (format may be "Label: comment" or just "Label")
          const parsedReason = clientReason.split(':')[0].trim();
          clientReasonCounts[parsedReason] = (clientReasonCounts[parsedReason] || 0) + 1;
        }

        // Only add to comparisons if both have reasons
        if (sellerReason || clientReason) {
          const normalizedSeller = (sellerReason || '').toLowerCase().trim();
          const normalizedClient = (clientReason?.split(':')[0] || '').toLowerCase().trim();
          
          dealComparisons.push({
            opportunityId: opp.id,
            title: opp.title,
            sellerReason,
            clientReason: clientReason?.split(':')[0].trim() || null,
            match: normalizedSeller !== '' && normalizedClient !== '' && 
                   (normalizedSeller.includes(normalizedClient) || normalizedClient.includes(normalizedSeller))
          });
        }
      });

      // Build comparison chart data
      const allReasons = new Set([
        ...Object.keys(sellerReasonCounts),
        ...Object.keys(clientReasonCounts)
      ]);

      const comparisonData: ComparisonData[] = Array.from(allReasons)
        .map(reason => ({
          reason: reason.length > 25 ? reason.slice(0, 25) + '...' : reason,
          fullReason: reason,
          sellerCount: sellerReasonCounts[reason] || 0,
          clientCount: clientReasonCounts[reason] || 0
        }))
        .sort((a, b) => (b.sellerCount + b.clientCount) - (a.sellerCount + a.clientCount))
        .slice(0, 8);

      // Calculate stats
      const dealsWithBothReasons = dealComparisons.filter(d => d.sellerReason && d.clientReason);
      const matchingReasons = dealsWithBothReasons.filter(d => d.match).length;
      const matchRate = dealsWithBothReasons.length > 0 
        ? Math.round((matchingReasons / dealsWithBothReasons.length) * 100)
        : 0;

      return {
        comparisonData,
        dealComparisons: dealComparisons.filter(d => d.sellerReason && d.clientReason).slice(0, 10),
        stats: {
          totalLost: opportunities?.length || 0,
          withSellerReason: Object.values(sellerReasonCounts).reduce((a, b) => a + b, 0),
          withClientReason: Object.values(clientReasonCounts).reduce((a, b) => a + b, 0),
          matchRate,
          matchingCount: matchingReasons,
          mismatchCount: dealsWithBothReasons.length - matchingReasons
        }
      };
    },
    enabled: !!organizationId
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2" />
          <p>Nenhum dado disponível para comparação</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Motivos Vendedor</p>
                <p className="text-xl font-bold">{data.stats.withSellerReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted rounded-lg">
                <UserCircle className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Motivos Cliente</p>
                <p className="text-xl font-bold">{data.stats.withClientReason}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-emerald-500/10 rounded-lg">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Concordância</p>
                <p className="text-xl font-bold text-emerald-500">{data.stats.matchRate}%</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-500/10 rounded-lg">
                <XCircle className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Divergências</p>
                <p className="text-xl font-bold text-amber-500">{data.stats.mismatchCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Comparison Chart */}
      <Card>
        <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-primary" />
          Comparativo: Vendedor vs Cliente
        </CardTitle>
        <CardDescription>
          Frequência de cada motivo de {contextLabels.lost} informado pelo vendedor versus pelo cliente
        </CardDescription>
        </CardHeader>
        <CardContent>
          {data.comparisonData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={data.comparisonData}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis type="number" className="text-xs" />
                <YAxis 
                  dataKey="reason" 
                  type="category" 
                  width={150}
                  tick={{ fontSize: 11 }}
                  className="text-xs"
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Bar dataKey="sellerCount" name="Vendedor" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="clientCount" name="Cliente" fill="hsl(217, 91%, 60%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum motivo de perda registrado ainda</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Deal-by-Deal Comparison */}
      {data.dealComparisons.length > 0 && (
        <Card>
          <CardHeader>
          <CardTitle className="text-base">Comparativo por {pipelineContext === 'qualification' ? 'Lead' : pipelineContext === 'onboarding' ? 'Cliente' : 'Deal'}</CardTitle>
          <CardDescription>
            {pipelineContext === 'qualification' ? 'Leads' : pipelineContext === 'onboarding' ? 'Clientes' : 'Deals'} onde temos tanto o motivo do vendedor quanto do cliente
          </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.dealComparisons.map((deal) => (
                <div 
                  key={deal.opportunityId}
                  className={`p-3 rounded-lg border ${
                    deal.match 
                      ? 'border-emerald-500/30 bg-emerald-500/5' 
                      : 'border-amber-500/30 bg-amber-500/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{deal.title}</p>
                      <div className="mt-2 grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Vendedor:</span>
                          <p className="font-medium mt-0.5">{deal.sellerReason || '-'}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cliente:</span>
                          <p className="font-medium mt-0.5">{deal.clientReason || '-'}</p>
                        </div>
                      </div>
                    </div>
                    <Badge variant={deal.match ? 'default' : 'secondary'} className="shrink-0">
                      {deal.match ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1" /> Alinhado</>
                      ) : (
                        <><XCircle className="h-3 w-3 mr-1" /> Divergente</>
                      )}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Insights */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Insights sobre Divergências
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          {data.stats.mismatchCount > 0 ? (
            <>
              <p>
                <strong>{data.stats.mismatchCount}</strong> {contextLabels.lostPlural} apresentam divergência entre 
                o motivo informado pelo vendedor e o motivo informado pelo cliente.
              </p>
              <p>
                Isso pode indicar:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Vendedores não estão capturando o real motivo da {pipelineContext === 'qualification' ? 'desqualificação' : pipelineContext === 'onboarding' ? 'churn' : 'perda'}</li>
                <li>Clientes dão feedback mais honesto no link público</li>
                <li>Necessidade de treinamento em qualificação de objeções</li>
              </ul>
            </>
          ) : data.stats.withClientReason === 0 ? (
            <p>
              Nenhum cliente recusou proposta pelo link público ainda. 
              Incentive o uso do link de proposta para coletar feedback direto.
            </p>
          ) : (
            <p>
              Os motivos informados pelos vendedores estão alinhados com os motivos 
              informados pelos clientes. Ótimo indicador de qualidade na qualificação!
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
