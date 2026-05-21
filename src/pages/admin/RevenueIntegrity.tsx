/**
 * P0 Revenue SSoT — Página admin read-only.
 * Compara todas as superfícies contra commercial_won_revenue_view.
 */
import { useMemo, useState } from 'react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useRevenueIntegrity } from '@/hooks/admin/useRevenueIntegrity';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BRL = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
  return { start, end };
}

export default function RevenueIntegrity() {
  const { organization } = useCurrentUser();
  const orgId = organization?.id ?? null;
  const initial = useMemo(monthBounds, []);
  const [start, setStart] = useState(initial.start.slice(0, 10));
  const [end, setEnd] = useState(initial.end.slice(0, 10));

  const startIso = new Date(`${start}T00:00:00`).toISOString();
  const endIso = new Date(`${end}T23:59:59.999`).toISOString();

  const { data, isLoading, error } = useRevenueIntegrity(orgId, startIso, endIso);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Revenue Integrity</h1>
        <p className="text-sm text-muted-foreground">
          Fonte única: <code className="font-mono">commercial_won_revenue_view</code>. Qualquer divergência aparece como{' '}
          <code className="font-mono">REVENUE_SOURCE_MISMATCH</code>.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 flex flex-wrap gap-4 items-end">
          <div>
            <Label htmlFor="start">Início</Label>
            <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="end">Fim</Label>
            <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erro ao carregar integridade</AlertTitle>
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {data && (
        <>
          {data.anyMismatch ? (
            <Alert variant="destructive">
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>REVENUE_SOURCE_MISMATCH</AlertTitle>
              <AlertDescription>
                Uma ou mais superfícies divergem da SSoT no período selecionado. Veja a tabela abaixo.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>OK</AlertTitle>
              <AlertDescription>Todas as superfícies batem com a SSoT no período selecionado.</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Vendas (count)</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{data.ssotTotals.won_count}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Receita Fechada</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{BRL(data.ssotTotals.commercial_amount)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Receita Avulsa</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{BRL(data.ssotTotals.one_shot_amount)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Novo MRR</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{BRL(data.ssotTotals.mrr_amount)}</CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Em revisão</CardTitle></CardHeader>
              <CardContent className="text-2xl font-bold">{data.ssotTotals.review_required_count}</CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Superfícies vs SSoT</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Superfície</TableHead>
                    <TableHead className="text-right">Exibido</TableHead>
                    <TableHead className="text-right">SSoT</TableHead>
                    <TableHead className="text-right">Δ</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Fonte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.surfaces.map((s) => (
                    <TableRow key={s.surface}>
                      <TableCell className="font-medium">{s.surface}</TableCell>
                      <TableCell className="text-right">{s.shown === null ? '—' : BRL(s.shown)}</TableCell>
                      <TableCell className="text-right">{BRL(s.ssot)}</TableCell>
                      <TableCell className="text-right">{BRL(s.delta)}</TableCell>
                      <TableCell>
                        {s.mismatch ? (
                          <Badge variant="destructive">REVENUE_SOURCE_MISMATCH</Badge>
                        ) : (
                          <Badge variant="secondary">OK</Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.source}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Linhas em revisão ({data.reviewRows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {data.reviewRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma venda em revisão no período.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Proposta</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Confiança</TableHead>
                      <TableHead>Avisos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.reviewRows.map((r) => (
                      <TableRow key={r.opportunity_id}>
                        <TableCell className="font-mono text-xs">{r.proposal_number ?? '—'}</TableCell>
                        <TableCell>{r.nome_fantasia || r.account_name || '—'}</TableCell>
                        <TableCell>{r.seller_name ?? '—'}</TableCell>
                        <TableCell className="text-right">{BRL(r.commercial_amount)}</TableCell>
                        <TableCell><Badge variant="outline">{r.revenue_confidence}</Badge></TableCell>
                        <TableCell className="text-xs">{(r.warnings || []).join(', ') || '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>SSoT — todas as vendas do período ({data.rows.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proposta</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead className="text-right">Comercial</TableHead>
                    <TableHead className="text-right">MRR</TableHead>
                    <TableHead className="text-right">Avulso</TableHead>
                    <TableHead>Fonte do valor</TableHead>
                    <TableHead>Confiança</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rows.map((r) => (
                    <TableRow key={r.opportunity_id}>
                      <TableCell className="font-mono text-xs">{r.proposal_number ?? '—'}</TableCell>
                      <TableCell>{r.nome_fantasia || r.account_name || '—'}</TableCell>
                      <TableCell className="text-right">{BRL(r.commercial_amount)}</TableCell>
                      <TableCell className="text-right">{BRL(r.mrr_amount)}</TableCell>
                      <TableCell className="text-right">{BRL(r.one_shot_amount)}</TableCell>
                      <TableCell className="font-mono text-xs">{r.commercial_amount_source}</TableCell>
                      <TableCell>
                        <Badge variant={r.revenue_confidence === 'trusted' ? 'secondary' : 'destructive'}>
                          {r.revenue_confidence}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
