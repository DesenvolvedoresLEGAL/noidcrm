import { Layout } from '@/components/Layout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Gem } from 'lucide-react';
import { useApolloKpis, useApolloAudit } from '@/hooks/intelligence/useApolloInvisible';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';

export default function ApolloRoi() {
  const { data: kpis, isLoading: loadingKpis } = useApolloKpis(30);
  const { data: rows, isLoading: loadingRows } = useApolloAudit({});

  const validContacts = kpis?.contacts_revealed ?? 0;
  const decisionMakers = kpis?.decision_makers ?? 0;
  const credits = kpis?.credits_used ?? 0;
  const roi = decisionMakers === 0 ? 0 : Math.round((validContacts / Math.max(credits, 1)) * 100);

  return (
    <Layout pageTitle="Apollo ROI">
      <div className="p-4 md:p-6 space-y-4 md:space-y-6">
        <PageHeader
          icon={Gem}
          title="Apollo ROI"
          subtitle="Custo, cobertura e retorno do Apollo Invisible Mode"
          badge={{ label: 'Kairós', icon: Gem }}
          variant="indigo"
        />

        {loadingKpis ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { l: 'Créditos gastos', v: credits },
              { l: 'Decisores encontrados', v: decisionMakers },
              { l: 'Contatos válidos', v: validContacts },
              { l: 'Empresas avaliadas', v: kpis?.evaluated ?? 0 },
              { l: 'Apollo executado', v: kpis?.executed ?? 0 },
              { l: 'Apollo ignorado', v: kpis?.skipped ?? 0 },
              {
                l: 'Custo / decisor',
                v: kpis?.cost_per_decision_maker ? kpis.cost_per_decision_maker.toFixed(2) : '—',
              },
              { l: 'ROI (contatos/100cred)', v: roi },
            ].map((k) => (
              <Card key={k.l} className="p-3">
                <div className="text-xs text-muted-foreground">{k.l}</div>
                <div className="text-2xl font-semibold mt-1">{k.v}</div>
              </Card>
            ))}
          </div>
        )}

        <Card className="p-3">
          <h3 className="text-sm font-semibold mb-2">Últimas execuções</h3>
          {loadingRows ? (
            <Skeleton className="h-40" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>ICP</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Contatos</TableHead>
                  <TableHead className="text-right">Revelados</TableHead>
                  <TableHead className="text-right">Créditos</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(rows ?? []).slice(0, 50).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.company_name ?? '—'}</TableCell>
                    <TableCell className="text-xs">{r.icp_category ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={
                        r.apollo_status === 'enriched' ? 'default'
                          : r.apollo_status === 'partial' ? 'secondary'
                            : r.apollo_status === 'skipped' ? 'outline'
                              : 'destructive'
                      }>{r.apollo_status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{r.priority_score ?? '—'}</TableCell>
                    <TableCell className="text-right">{r.contacts_found}</TableCell>
                    <TableCell className="text-right">{r.contacts_revealed}</TableCell>
                    <TableCell className="text-right">{r.credits_used}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.skip_reason ?? '—'}</TableCell>
                  </TableRow>
                ))}
                {(rows ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-6">
                      Nenhuma execução do Apollo registrada ainda.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </Layout>
  );
}
