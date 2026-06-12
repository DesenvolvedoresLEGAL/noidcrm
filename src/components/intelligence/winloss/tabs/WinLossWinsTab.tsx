// Sprint WL-WINS-01 — Aba Wins do Win/Loss Hub.
// Análise dedicada de negócios ganhos: drivers, diferenciais, vendedores,
// segmentos, padrões de proposta vencedora, voz do cliente e playbooks
// determinísticos. Sem IA efêmera. Reaproveita useWinLossData + SSoT.
import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Trophy, Crown, Sparkles, DollarSign, Target, Clock, TrendingUp,
  Users, Layers, MessageSquareQuote, BookOpen, GitBranch,
} from 'lucide-react';
import type { WinLossDataResult, WonStageRow } from '@/hooks/useWinLossData';
import { WinOriginBreakdownBlock } from '../WinOriginBreakdownBlock';

interface Props {
  data: WinLossDataResult | undefined;
  isLoading: boolean;
  /** Override monetário de receita ganha (commercial_won_revenue_view). Aplica só em pipelines de Vendas. */
  ssotWon?: { wonCount: number; wonValue: number; avgTicketWon: number };
}

// ── Helpers ──────────────────────────────────────────────────────────
const DIFFERENTIATOR_LABELS: Record<string, string> = {
  price: 'Preço Competitivo',
  service: 'Atendimento',
  product: 'Qualidade da Solução',
  relationship: 'Relacionamento',
  timing: 'Timing',
  brand: 'Marca',
};

function executiveDifferentiatorLabel(raw: string): string {
  const key = raw.trim().toLowerCase();
  return DIFFERENTIATOR_LABELS[key] || raw.trim();
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(v);

const initials = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || '?';

// ── Component ────────────────────────────────────────────────────────
export function WinLossWinsTab({ data, isLoading, ssotWon }: Props) {
  const agg = useMemo(() => buildWinsAggregates(data), [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="h-24 rounded-lg border bg-muted/30 animate-pulse" />
        <div className="h-40 rounded-lg border bg-muted/30 animate-pulse" />
        <div className="h-64 rounded-lg border bg-muted/30 animate-pulse" />
      </div>
    );
  }

  if (!data || data.wins.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum negócio ganho no período selecionado.
        </CardContent>
      </Card>
    );
  }

  // Receita ganha: SSoT (vendas) ou dataset interno (qualificação/mixed)
  const wonCount = ssotWon?.wonCount ?? data.wonCount;
  const wonValue = ssotWon?.wonValue ?? data.wonValue;
  const avgTicket = ssotWon?.avgTicketWon ?? data.avgTicketWon;
  const winRate = data.winRate;
  const avgCycle = data.avgCycleWon;
  const principal = agg.principal;

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div>
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-emerald-600" />
          <h2 className="text-xl font-semibold">Wins</h2>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          Entenda por que os negócios são ganhos e quais padrões devem ser replicados.
        </p>
      </div>

      {/* 2. KPIs de Vitória */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={Trophy} label="Total de ganhos" value={wonCount.toString()} />
        <KpiCard icon={DollarSign} label="Receita ganha" value={fmtBRL(wonValue)} accent />
        <KpiCard icon={Target} label="Win Rate" value={`${winRate}%`} />
        <KpiCard icon={DollarSign} label="Ticket médio" value={fmtBRL(avgTicket)} />
        <KpiCard
          icon={Clock}
          label="Ciclo médio (ganhos)"
          value={avgCycle != null ? `${avgCycle}d` : '—'}
        />
        <KpiCard
          icon={Crown}
          label="Principal driver"
          value={principal?.reason || '—'}
          small
        />
      </div>

      {/* 3. Principal Driver de Vitória */}
      {principal && (
        <Card className="border-emerald-500/30 bg-emerald-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Crown className="h-4 w-4 text-emerald-600" />
              Principal driver de vitória
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-lg font-bold leading-tight">{principal.reason}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {principal.count} {principal.count === 1 ? 'vitória' : 'vitórias'} ·{' '}
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {fmtBRL(principal.value)}
                  </span>{' '}
                  · {principal.pct}% das vitórias
                </p>
              </div>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                {principal.pct}%
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground border-t border-emerald-500/20 pt-2 italic">
              {buildPrincipalRecommendation(principal)}
            </p>
          </CardContent>
        </Card>
      )}

      {/* 4. Top Drivers de Vitória */}
      {agg.topDrivers.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Top drivers de vitória
            </CardTitle>
            <CardDescription className="text-xs">
              Motivos mais associados aos negócios ganhos no período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 pr-3">Driver</th>
                    <th className="text-right font-medium py-2 px-2">Ganhos</th>
                    <th className="text-right font-medium py-2 px-2">Receita</th>
                    <th className="text-right font-medium py-2 px-2">Participação</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.topDrivers.map((d) => (
                    <tr key={d.reason} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3 truncate max-w-[280px]">{d.reason}</td>
                      <td className="py-2 px-2 text-right tabular-nums">{d.count}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {fmtBRL(d.value)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {d.pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. Diferenciais Decisivos */}
      {agg.differentiators.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-600" /> Diferenciais decisivos
            </CardTitle>
            <CardDescription className="text-xs">
              Atributos mencionados pelos clientes nos negócios ganhos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {agg.differentiators.map((d) => (
                <div
                  key={d.label}
                  className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs"
                >
                  <span className="font-medium">{d.label}</span>
                  <span className="text-muted-foreground tabular-nums">
                    · {d.count} {d.count === 1 ? 'citação' : 'citações'}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6. Vitórias por Vendedor */}
      {agg.sellerRanking.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <Users className="h-4 w-4" /> Vitórias por vendedor
            </CardTitle>
            <CardDescription className="text-xs">
              Quem está ganhando e qual driver predomina em cada um.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 pr-3">Vendedor</th>
                    <th className="text-right font-medium py-2 px-2">Ganhos</th>
                    <th className="text-right font-medium py-2 px-2">Receita</th>
                    <th className="text-right font-medium py-2 px-2">Win Rate</th>
                    <th className="text-right font-medium py-2 px-2">Ciclo</th>
                    <th className="text-left font-medium py-2 pl-3">Principal driver</th>
                  </tr>
                </thead>
                <tbody>
                  {agg.sellerRanking.map((s) => (
                    <tr key={s.userId} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="h-6 w-6 shrink-0">
                            {s.avatarUrl && <AvatarImage src={s.avatarUrl} />}
                            <AvatarFallback className="text-[10px]">{initials(s.name)}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.won}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {fmtBRL(s.totalValue)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{s.winRate}%</td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {s.avgCycle > 0 ? `${s.avgCycle}d` : '—'}
                      </td>
                      <td className="py-2 pl-3 text-xs text-muted-foreground truncate max-w-[200px]">
                        {s.topDriver || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 6b. Vitórias por Canal de Origem (Sprint WL-WINS-06) */}
      <WinOriginBreakdownBlock data={data} />

      {/* 7. Vitórias por Segmento */}

      {agg.segmentBreakdown.length > 0 && (
        <div className="grid md:grid-cols-1 gap-4">
          <BreakdownCard
            title="Vitórias por segmento"
            icon={Layers}
            rows={agg.segmentBreakdown}
          />
        </div>
      )}

      {/* 7b. Vitórias por etapa do pipeline (Sprint WL-WINS-02) */}
      <WonByStageCard rows={data.wonStageBreakdown} />


      {/* 8. Padrões de Proposta Vencedora */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-1.5">
            <Target className="h-4 w-4" /> Padrões de proposta vencedora
          </CardTitle>
          <CardDescription className="text-xs">
            Características recorrentes entre os negócios ganhos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
            <PatternCell
              label="Ciclo médio até aceite"
              value={avgCycle != null ? `${avgCycle} dias` : '—'}
            />
            <PatternCell
              label="Principal diferencial"
              value={agg.differentiators[0]?.label || '—'}
            />
            <PatternCell
              label="Faixa de valor mais recorrente"
              value={agg.modalValueBand || '—'}
            />
            <PatternCell
              label="Segmento com mais vitórias"
              value={agg.segmentBreakdown[0]?.label || '—'}
            />
            <PatternCell
              label="Vendedor com menor ciclo"
              value={
                agg.fastestSeller
                  ? `${agg.fastestSeller.name} · ${agg.fastestSeller.avgCycle}d`
                  : '—'
              }
            />
            <PatternCell
              label="Etapa líder no aceite"
              value={data.wonStageBreakdown[0]?.stageName || '—'}
            />
          </div>
        </CardContent>
      </Card>

      {/* 9. Voz do Cliente nas Vitórias */}
      {agg.feedbacks.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <MessageSquareQuote className="h-4 w-4 text-emerald-600" /> Voz do cliente nas vitórias
            </CardTitle>
            <CardDescription className="text-xs">
              Trechos curtos. Texto completo na aba Entrevistas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {agg.feedbacks.map((f, i) => (
                <div
                  key={i}
                  className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3"
                >
                  <p className="text-sm italic">"{f.snippet}"</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-1.5 flex-wrap">
                    <span>— {f.acceptorName}</span>
                    {f.winReason && (
                      <>
                        <span>·</span>
                        <span>{f.winReason}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 10. Playbooks para Replicar */}
      {agg.playbooks.length > 0 && (
        <Card className="border-emerald-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-1.5">
              <BookOpen className="h-4 w-4 text-emerald-600" /> Playbooks para replicar
            </CardTitle>
            <CardDescription className="text-xs">
              Recomendações derivadas dos padrões de vitória do período.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {agg.playbooks.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600 mt-0.5 shrink-0" />
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────
interface KpiCardProps {
  icon: any;
  label: string;
  value: string;
  accent?: boolean;
  small?: boolean;
}
function KpiCard({ icon: Icon, label, value, accent, small }: KpiCardProps) {
  return (
    <div className={`rounded-lg border p-3 ${accent ? 'border-emerald-500/30 bg-emerald-500/5' : 'bg-card'}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className={`mt-1 font-bold tabular-nums ${small ? 'text-sm' : 'text-lg'} ${accent ? 'text-emerald-700 dark:text-emerald-400' : ''} truncate`}>
        {value}
      </p>
    </div>
  );
}

function PatternCell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2.5">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium mt-1 truncate">{value}</p>
    </div>
  );
}

interface BreakdownRow {
  label: string;
  count: number;
  value: number;
  avgTicket: number;
  topDriver?: string;
}
function BreakdownCard({ title, icon: Icon, rows }: { title: string; icon: any; rows: BreakdownRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <Icon className="h-4 w-4" /> {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                <th className="text-left font-medium py-2 pr-2">Item</th>
                <th className="text-right font-medium py-2 px-1">Ganhos</th>
                <th className="text-right font-medium py-2 px-1">Receita</th>
                <th className="text-right font-medium py-2 pl-1">Ticket médio</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 8).map((r) => (
                <tr key={r.label} className="border-b border-border/40 last:border-0">
                  <td className="py-2 pr-2">
                    <div className="truncate">{r.label}</div>
                    {r.topDriver && (
                      <div className="text-[11px] text-muted-foreground truncate">{r.topDriver}</div>
                    )}
                  </td>
                  <td className="py-2 px-1 text-right tabular-nums">{r.count}</td>
                  <td className="py-2 px-1 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                    {fmtBRL(r.value)}
                  </td>
                  <td className="py-2 pl-1 text-right tabular-nums text-muted-foreground">
                    {fmtBRL(r.avgTicket)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Aggregation logic ────────────────────────────────────────────────
interface DriverAgg {
  reason: string;
  count: number;
  value: number;
  pct: number;
}

// ── Won by stage at acceptance (Sprint WL-WINS-02) ──────────────────
function WonByStageCard({ rows }: { rows: WonStageRow[] }) {
  const hasData = rows && rows.length > 0;
  const totalFallback = hasData ? rows.reduce((s, r) => s + r.fallbackCount, 0) : 0;
  const totalCount = hasData ? rows.reduce((s, r) => s + r.count, 0) : 0;
  const fallbackRatio = totalCount > 0 ? Math.round((totalFallback / totalCount) * 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-1.5">
          <GitBranch className="h-4 w-4" /> Vitórias por etapa do pipeline
        </CardTitle>
        <CardDescription className="text-xs">
          Etapa em que a oportunidade estava no momento da aprovação da proposta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="rounded-md border border-dashed bg-muted/30 p-4 text-sm">
            <p className="font-medium">Não há histórico suficiente para identificar a etapa de aceite.</p>
            <p className="text-xs text-muted-foreground mt-1">
              A partir dos próximos aceites, o sistema deve registrar a etapa no momento da aprovação
              da proposta para melhorar esta análise.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-muted-foreground border-b">
                    <th className="text-left font-medium py-2 pr-3">Etapa</th>
                    <th className="text-right font-medium py-2 px-2">Ganhos</th>
                    <th className="text-right font-medium py-2 px-2">Receita</th>
                    <th className="text-right font-medium py-2 px-2">Ticket médio</th>
                    <th className="text-right font-medium py-2 px-2">Ciclo médio</th>
                    <th className="text-left font-medium py-2 pl-3">Principal driver</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.stageId} className="border-b border-border/40 last:border-0">
                      <td className="py-2 pr-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="truncate">{r.stageName}</span>
                          {r.fallbackCount > 0 && r.fallbackCount === r.count && (
                            <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                              etapa atual
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums">{r.count}</td>
                      <td className="py-2 px-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                        {fmtBRL(r.value)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {fmtBRL(r.avgTicket)}
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums text-muted-foreground">
                        {r.avgCycle > 0 ? `${r.avgCycle}d` : '—'}
                      </td>
                      <td className="py-2 pl-3 text-xs text-muted-foreground truncate max-w-[220px]">
                        {r.topDriver || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {fallbackRatio >= 30 && (
              <p className="mt-2 text-[11px] text-muted-foreground italic">
                {fallbackRatio}% das vitórias não possuem histórico de etapa — usando etapa atual como fallback.
                Próximos aceites passarão a registrar a etapa no momento da aprovação.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function buildWinsAggregates(data: WinLossDataResult | undefined) {
  const empty = {
    principal: null as DriverAgg | null,
    topDrivers: [] as DriverAgg[],
    differentiators: [] as Array<{ label: string; count: number }>,
    sellerRanking: [] as Array<{
      userId: string; name: string; avatarUrl?: string;
      won: number; totalValue: number; winRate: number; avgCycle: number;
      topDriver?: string;
    }>,
    segmentBreakdown: [] as BreakdownRow[],
    pipelineBreakdown: [] as BreakdownRow[],
    feedbacks: [] as Array<{ snippet: string; acceptorName: string; winReason?: string }>,
    modalValueBand: '' as string,
    fastestSeller: null as { name: string; avgCycle: number } | null,
    playbooks: [] as string[],
  };
  if (!data || data.wins.length === 0) return empty;

  const wins = data.wins;
  const totalWins = wins.length;

  // Drivers
  const reasonMap = new Map<string, { count: number; value: number }>();
  const diffMap = new Map<string, number>();
  for (const w of wins) {
    const reason =
      w.win_reason_name ||
      (w.acceptor_name && !w.win_reason_id ? 'Sem motivo selecionado' : 'Não informado');
    const r = reasonMap.get(reason) || { count: 0, value: 0 };
    r.count++;
    r.value += Number(w.final_value) || 0;
    reasonMap.set(reason, r);

    if (w.key_differentiator) {
      w.key_differentiator.split(',').map(d => d.trim()).filter(Boolean).forEach(d => {
        const label = executiveDifferentiatorLabel(d);
        diffMap.set(label, (diffMap.get(label) || 0) + 1);
      });
    }
  }
  const ranked = [...reasonMap.entries()]
    .map(([reason, { count, value }]) => ({
      reason, count, value,
      pct: totalWins > 0 ? Math.round((count / totalWins) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topDrivers = ranked.slice(0, 10);
  const principal = ranked[0] || null;
  const differentiators = [...diffMap.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Seller ranking — top driver per seller
  const sellerDriverMap = new Map<string, Map<string, number>>();
  for (const w of wins) {
    if (!w.owner_user_id) continue;
    const reason =
      w.win_reason_name ||
      (w.acceptor_name && !w.win_reason_id ? 'Sem motivo selecionado' : 'Não informado');
    const m = sellerDriverMap.get(w.owner_user_id) || new Map();
    m.set(reason, (m.get(reason) || 0) + 1);
    sellerDriverMap.set(w.owner_user_id, m);
  }
  const sellerRanking = data.sellerStats
    .filter(s => s.won > 0)
    .map(s => {
      const driverMap = sellerDriverMap.get(s.userId);
      const topDriver = driverMap
        ? [...driverMap.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
        : undefined;
      return {
        userId: s.userId,
        name: s.name,
        avatarUrl: s.avatarUrl,
        won: s.won,
        totalValue: s.totalValue,
        winRate: s.winRate,
        avgCycle: s.avgCycle,
        topDriver,
      };
    })
    .sort((a, b) => b.won - a.won || b.totalValue - a.totalValue);

  // Segment breakdown (account.segmento)
  const segMap = new Map<string, { count: number; value: number; reasons: Map<string, number> }>();
  for (const w of wins) {
    const seg = (w.opportunity?.account?.segmento as string) || null;
    if (!seg) continue;
    const e = segMap.get(seg) || { count: 0, value: 0, reasons: new Map() };
    e.count++;
    e.value += Number(w.final_value) || 0;
    const reason = w.win_reason_name || 'Não informado';
    e.reasons.set(reason, (e.reasons.get(reason) || 0) + 1);
    segMap.set(seg, e);
  }
  const segmentBreakdown: BreakdownRow[] = [...segMap.entries()]
    .map(([label, e]) => ({
      label,
      count: e.count,
      value: e.value,
      avgTicket: e.count > 0 ? Math.round(e.value / e.count) : 0,
      topDriver: topReason(e.reasons),
    }))
    .sort((a, b) => b.count - a.count);

  // Pipeline breakdown
  const pipeMap = new Map<string, { count: number; value: number; reasons: Map<string, number> }>();
  for (const w of wins) {
    const pid = (w.opportunity?.pipeline_id as string) || null;
    if (!pid) continue;
    const e = pipeMap.get(pid) || { count: 0, value: 0, reasons: new Map() };
    e.count++;
    e.value += Number(w.final_value) || 0;
    const reason = w.win_reason_name || 'Não informado';
    e.reasons.set(reason, (e.reasons.get(reason) || 0) + 1);
    pipeMap.set(pid, e);
  }
  const pipelineBreakdown: BreakdownRow[] = [...pipeMap.entries()]
    .map(([pid, e]) => ({
      label: `Pipeline ${pid.slice(0, 8)}`,
      count: e.count,
      value: e.value,
      avgTicket: e.count > 0 ? Math.round(e.value / e.count) : 0,
      topDriver: topReason(e.reasons),
    }))
    .sort((a, b) => b.count - a.count);

  // Feedbacks (up to 5, 160 chars)
  const feedbacks = data.customerFeedbacks.slice(0, 5).map(f => ({
    snippet: f.feedback.length > 160 ? f.feedback.slice(0, 157) + '...' : f.feedback,
    acceptorName: f.acceptorName,
    winReason: f.winReason,
  }));

  // Modal value band
  const bands: Array<{ label: string; min: number; max: number }> = [
    { label: 'Até R$ 5k',    min: 0,      max: 5000 },
    { label: 'R$ 5k–20k',    min: 5000,   max: 20000 },
    { label: 'R$ 20k–50k',   min: 20000,  max: 50000 },
    { label: 'R$ 50k–100k',  min: 50000,  max: 100000 },
    { label: 'R$ 100k–250k', min: 100000, max: 250000 },
    { label: 'Acima de R$ 250k', min: 250000, max: Infinity },
  ];
  const bandCounts = bands.map(b => ({
    label: b.label,
    count: wins.filter(w => (Number(w.final_value) || 0) >= b.min && (Number(w.final_value) || 0) < b.max).length,
  }));
  const modalValueBand = bandCounts.sort((a, b) => b.count - a.count)[0]?.count > 0
    ? bandCounts[0].label
    : '';

  // Fastest seller
  const sellersWithCycle = sellerRanking.filter(s => s.avgCycle > 0);
  const fastestSeller = sellersWithCycle.length > 0
    ? [...sellersWithCycle].sort((a, b) => a.avgCycle - b.avgCycle)[0]
    : null;

  // Playbooks (deterministic)
  const playbooks: string[] = [];
  if (principal && principal.reason !== 'Não informado' && principal.reason !== 'Sem motivo selecionado') {
    playbooks.push(
      `Replicar o argumento "${principal.reason}" nas próximas propostas — está associado a ${fmtBRL(principal.value)} em receita (${principal.pct}% das vitórias).`,
    );
  }
  if (differentiators[0]) {
    playbooks.push(
      `Reforçar "${differentiators[0].label}" no discurso comercial e materiais de proposta — citado em ${differentiators[0].count} ${differentiators[0].count === 1 ? 'vitória' : 'vitórias'}.`,
    );
  }
  if (fastestSeller) {
    playbooks.push(
      `Estudar e replicar o follow-up de ${fastestSeller.name} (ciclo médio de ${fastestSeller.avgCycle} dias) como referência de cadência vencedora.`,
    );
  }
  if (segmentBreakdown[0]) {
    playbooks.push(
      `Priorizar prospecção no segmento "${segmentBreakdown[0].label}" — concentra ${segmentBreakdown[0].count} ${segmentBreakdown[0].count === 1 ? 'vitória' : 'vitórias'} e ${fmtBRL(segmentBreakdown[0].value)} em receita.`,
    );
  }
  if (modalValueBand) {
    playbooks.push(
      `Usar prova social e cases reais nas oportunidades dentro da faixa "${modalValueBand}", onde se concentra o maior volume de ganhos.`,
    );
  }
  const serviceDiff = differentiators.find(d => d.label === 'Atendimento');
  if (serviceDiff && differentiators.slice(0, 3).includes(serviceDiff)) {
    playbooks.push(
      `Reforçar SLA e qualidade de atendimento no playbook — "Atendimento" está entre os top 3 diferenciais decisivos.`,
    );
  }

  return {
    principal,
    topDrivers,
    differentiators,
    sellerRanking,
    segmentBreakdown,
    pipelineBreakdown,
    feedbacks,
    modalValueBand,
    fastestSeller,
    playbooks,
  };
}

function topReason(m: Map<string, number>): string | undefined {
  const top = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  return top?.[0];
}

function buildPrincipalRecommendation(p: DriverAgg): string {
  if (p.reason === 'Não informado' || p.reason === 'Sem motivo selecionado') {
    return 'Captar o motivo de aceite junto ao cliente para enriquecer o playbook comercial.';
  }
  return `Recomendação: reforçar "${p.reason}" nas propostas e no playbook comercial — ${fmtBRL(p.value)} em receita estão associados a esse driver.`;
}
