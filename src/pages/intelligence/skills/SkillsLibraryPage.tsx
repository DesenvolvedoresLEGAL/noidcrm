import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PageContainer } from '@/components/ui/page-container';
import { useSkills, useSkillMetrics } from '@/hooks/intelligence/useSkills';
import { CATEGORY_LABEL, STATUS_LABEL, TYPE_LABEL } from '@/services/intelligence/skills';
import { Skeleton } from '@/components/ui/skeleton';

export default function SkillsLibraryPage() {
  const navigate = useNavigate();
  const { data: skills = [], isLoading } = useSkills();
  const { data: metrics = [] } = useSkillMetrics();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<string>('all');
  const [st, setSt] = useState<string>('all');

  const metricsBySkill = useMemo(() => Object.fromEntries(metrics.map(m => [m.skill_id, m])), [metrics]);

  const filtered = useMemo(() => {
    return skills.filter(s => {
      if (cat !== 'all' && s.category !== cat) return false;
      if (st !== 'all' && s.status !== st) return false;
      if (q && !`${s.name} ${s.slug}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [skills, q, cat, st]);

  return (
    <PageContainer>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Skills Library</h1>
          <p className="text-muted-foreground text-sm">
            Habilidades comerciais reutilizáveis por agentes. Skill gera recomendação — nunca envia mensagem nem altera CRM.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex gap-2 flex-wrap items-center">
            <Input placeholder="Buscar por nome ou slug" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {Object.entries(CATEGORY_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={st} onValueChange={setSt}>
              <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-48" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">v</TableHead>
                  <TableHead className="text-right">Execuções</TableHead>
                  <TableHead className="text-right">Positivo</TableHead>
                  <TableHead className="text-right">Última</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(s => {
                  const m = metricsBySkill[s.id];
                  const runs = m?.run_count ?? 0;
                  const posRate = runs > 0 ? Math.round(((m?.positive_feedback ?? 0) / runs) * 100) : 0;
                  return (
                    <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/app/intelligence/skills/${s.id}`)}>
                      <TableCell>
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.slug}</div>
                      </TableCell>
                      <TableCell>{CATEGORY_LABEL[s.category]}</TableCell>
                      <TableCell>{TYPE_LABEL[s.skill_type]}</TableCell>
                      <TableCell>
                        <Badge variant={s.status === 'active' ? 'default' : 'secondary'}>{STATUS_LABEL[s.status]}</Badge>
                      </TableCell>
                      <TableCell className="text-right">{s.version}</TableCell>
                      <TableCell className="text-right">{runs}</TableCell>
                      <TableCell className="text-right">{runs ? `${posRate}%` : '—'}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">
                        {m?.last_run_at ? new Date(m.last_run_at).toLocaleString('pt-BR') : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma skill encontrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
