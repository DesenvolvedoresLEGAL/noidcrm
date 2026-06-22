import { useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSDRCopilotTasks } from '@/hooks/intelligence/useSDRCopilotTasks';
import { CHANNEL_LABEL, NEXT_ACTION_LABEL, STATUS_LABEL, type SDRCopilotChannel, type SDRCopilotStatus, type SDRCopilotTask } from '@/services/intelligence/sdrCopilot';
import { SDRCopilotDrawer } from './SDRCopilotDrawer';

const STATUSES: (SDRCopilotStatus | 'all')[] = ['all', 'pending', 'in_review', 'approved', 'activity_created', 'promoted_to_crm', 'completed', 'dismissed'];
const CHANNELS: (SDRCopilotChannel | 'all')[] = ['all', 'whatsapp', 'email', 'linkedin', 'call'];

export function SDRCopilotTaskList() {
  const [status, setStatus] = useState<SDRCopilotStatus | 'all'>('all');
  const [channel, setChannel] = useState<SDRCopilotChannel | 'all'>('all');
  const [scoreMin, setScoreMin] = useState<number>(0);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SDRCopilotTask | null>(null);

  const { data: tasks = [], isLoading } = useSDRCopilotTasks({ status, channel, scoreMin });

  const filtered = useMemo(() => {
    if (!search.trim()) return tasks;
    const s = search.toLowerCase();
    return tasks.filter((t) =>
      (t.reason ?? '').toLowerCase().includes(s) ||
      (t.preferred_channel ?? '').toLowerCase().includes(s),
    );
  }, [tasks, search]);

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2 items-end">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s === 'all' ? 'Todos' : STATUS_LABEL[s as SDRCopilotStatus]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Canal</label>
            <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>{c === 'all' ? 'Todos' : CHANNEL_LABEL[c as SDRCopilotChannel]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Score mínimo</label>
            <Input type="number" className="w-28" value={scoreMin}
              onChange={(e) => setScoreMin(Number(e.target.value) || 0)} />
          </div>
          <div className="space-y-1 flex-1 min-w-[180px]">
            <label className="text-xs text-muted-foreground">Buscar</label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="motivo, canal…" />
          </div>
        </div>

        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Canal</TableHead>
                <TableHead>Próxima ação</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Carregando…</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhuma tarefa.</TableCell></TableRow>
              )}
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="text-sm">{(t.commercial_brief as any)?.company_name ?? t.prospect_id?.slice(0, 8) ?? '—'}</div>
                    {t.reason && <div className="text-xs text-muted-foreground line-clamp-1">{t.reason}</div>}
                  </TableCell>
                  <TableCell><span className="font-semibold">{t.priority_score}</span></TableCell>
                  <TableCell>{t.preferred_channel ? <Badge variant="outline">{CHANNEL_LABEL[t.preferred_channel]}</Badge> : '—'}</TableCell>
                  <TableCell>{t.next_best_action ? NEXT_ACTION_LABEL[t.next_best_action] : '—'}</TableCell>
                  <TableCell><Badge variant="secondary">{STATUS_LABEL[t.status]}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.assigned_to?.slice(0, 8) ?? '—'}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" variant="ghost" onClick={() => setSelected(t)}>Abrir</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {selected && (
        <SDRCopilotDrawer
          task={selected}
          open={!!selected}
          onOpenChange={(o) => !o && setSelected(null)}
        />
      )}
    </Card>
  );
}
