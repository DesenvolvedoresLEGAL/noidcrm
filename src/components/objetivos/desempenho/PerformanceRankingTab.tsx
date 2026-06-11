import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { EmptyState } from '@/components/EmptyState';
import { useQualificationQualityV2 } from '@/hooks/reports/useQualificationQualityV2';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

type RoleFilter = 'all' | 'sdr' | 'closer' | 'high' | 'low';
type SortBy = 'metric' | 'conversion' | 'quality' | 'name';

const fmtPct = (v: number) => `${(v || 0).toFixed(1)}%`;

interface RankItem {
  name: string;
  role: 'SDR' | 'Closer';
  metric: number;       // SDR: qualifications | Closer: wins
  conversion: number;   // %
  quality: number;      // %
  status: 'Alta performance' | 'Em evolução' | 'Abaixo do esperado' | 'Sem dados suficientes';
  trend: 'up' | 'down' | 'flat';
}

function statusBadgeClass(s: RankItem['status']) {
  switch (s) {
    case 'Alta performance': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
    case 'Em evolução': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'Abaixo do esperado': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
    default: return 'bg-muted text-muted-foreground';
  }
}

export function PerformanceRankingTab() {
  const { data, isLoading } = useQualificationQualityV2({ includeDrilldown: true });
  const [role, setRole] = useState<RoleFilter>('all');
  const [sort, setSort] = useState<SortBy>('metric');

  const items = useMemo<RankItem[]>(() => {
    if (!data) return [];
    const list: RankItem[] = [];

    (data.rows ?? [])
      .filter(r => !r.sdr_is_deleted && r.qualified_count > 0)
      .forEach(r => {
        const conv = r.sql_to_won_rate ?? 0;
        const qual = r.sql_to_proposal_rate ?? 0;
        list.push({
          name: r.sdr_name,
          role: 'SDR',
          metric: r.qualified_count,
          conversion: conv,
          quality: qual,
          status: conv >= 30 ? 'Alta performance' : conv >= 15 ? 'Em evolução' : conv > 0 ? 'Abaixo do esperado' : 'Sem dados suficientes',
          trend: conv >= 30 ? 'up' : conv >= 15 ? 'flat' : 'down',
        });
      });

    const closerStats = new Map<string, { wins: number; total: number }>();
    (data.drilldown ?? []).forEach(d => {
      if (!d.closer_name || d.closer_is_deleted) return;
      const cur = closerStats.get(d.closer_name) ?? { wins: 0, total: 0 };
      cur.total += 1;
      if (d.status === 'won') cur.wins += 1;
      closerStats.set(d.closer_name, cur);
    });
    closerStats.forEach((v, name) => {
      const conv = v.total ? (v.wins / v.total) * 100 : 0;
      list.push({
        name,
        role: 'Closer',
        metric: v.wins,
        conversion: conv,
        quality: conv,
        status: conv >= 40 ? 'Alta performance' : conv >= 20 ? 'Em evolução' : conv > 0 ? 'Abaixo do esperado' : 'Sem dados suficientes',
        trend: conv >= 40 ? 'up' : conv >= 20 ? 'flat' : 'down',
      });
    });

    let filtered = list;
    if (role === 'sdr') filtered = filtered.filter(i => i.role === 'SDR');
    else if (role === 'closer') filtered = filtered.filter(i => i.role === 'Closer');
    else if (role === 'high') filtered = filtered.filter(i => i.status === 'Alta performance');
    else if (role === 'low') filtered = filtered.filter(i => i.status === 'Abaixo do esperado');

    filtered.sort((a, b) => {
      switch (sort) {
        case 'conversion': return b.conversion - a.conversion;
        case 'quality': return b.quality - a.quality;
        case 'name': return a.name.localeCompare(b.name);
        default: return b.metric - a.metric;
      }
    });
    return filtered;
  }, [data, role, sort]);

  if (isLoading) return <Skeleton className="h-96" />;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-600" />
            Ranking de pessoas
          </CardTitle>
          <div className="flex gap-2">
            <Select value={role} onValueChange={(v) => setRole(v as RoleFilter)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="sdr">SDR</SelectItem>
                <SelectItem value="closer">Closer</SelectItem>
                <SelectItem value="high">Alta performance</SelectItem>
                <SelectItem value="low">Abaixo do esperado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortBy)}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Ordenar: Volume</SelectItem>
                <SelectItem value="conversion">Ordenar: Conversão</SelectItem>
                <SelectItem value="quality">Ordenar: Qualidade</SelectItem>
                <SelectItem value="name">Ordenar: Nome</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Nenhuma pessoa no ranking"
            description="Ajuste os filtros do período ou da função para visualizar o ranking."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Pessoa</TableHead>
                <TableHead>Função</TableHead>
                <TableHead className="text-right">Métrica</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
                <TableHead className="text-right">Qualidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-16">Tend.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it, i) => {
                const TrendIcon = it.trend === 'up' ? TrendingUp : it.trend === 'down' ? TrendingDown : Minus;
                const trendColor = it.trend === 'up' ? 'text-emerald-600' : it.trend === 'down' ? 'text-rose-600' : 'text-muted-foreground';
                return (
                  <TableRow key={`${it.role}-${it.name}-${i}`}>
                    <TableCell className="font-bold">{i + 1}</TableCell>
                    <TableCell>{it.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={it.role === 'SDR' ? 'bg-indigo-500/10 text-indigo-600' : 'bg-primary/10 text-primary'}>
                        {it.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {it.metric} <span className="text-xs text-muted-foreground">{it.role === 'SDR' ? 'qualif.' : 'vendas'}</span>
                    </TableCell>
                    <TableCell className="text-right">{fmtPct(it.conversion)}</TableCell>
                    <TableCell className="text-right">{fmtPct(it.quality)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusBadgeClass(it.status)}>{it.status}</Badge>
                    </TableCell>
                    <TableCell><TrendIcon className={`h-4 w-4 ${trendColor}`} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
