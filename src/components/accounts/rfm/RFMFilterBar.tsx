import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActiveUsers } from '@/hooks/users/useActiveUsers';
import { RFM_SEGMENTS, RFM_SEGMENT_LABEL, type RFMSegment } from '@/services/crm/account-rfm';
import { Search } from 'lucide-react';

interface Props {
  periodStart: string;
  periodEnd: string;
  ownerId: string | null;
  segment: RFMSegment | null;
  search: string;
  onChange: (next: Partial<{ periodStart: string; periodEnd: string; ownerId: string | null; segment: RFMSegment | null; search: string }>) => void;
}

export function RFMFilterBar({ periodStart, periodEnd, ownerId, segment, search, onChange }: Props) {
  const { data: users = [] } = useActiveUsers();

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Início</label>
        <Input type="date" value={periodStart} onChange={(e) => onChange({ periodStart: e.target.value })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Fim</label>
        <Input type="date" value={periodEnd} onChange={(e) => onChange({ periodEnd: e.target.value })} />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Responsável</label>
        <Select value={ownerId ?? 'all'} onValueChange={(v) => onChange({ ownerId: v === 'all' ? null : v })}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.user_id} value={u.user_id}>{u.full_name || u.email}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Segmento RFM</label>
        <Select value={segment ?? 'all'} onValueChange={(v) => onChange({ segment: v === 'all' ? null : (v as RFMSegment) })}>
          <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {RFM_SEGMENTS.map((s) => (
              <SelectItem key={s} value={s}>{RFM_SEGMENT_LABEL[s]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Buscar conta</label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Nome da conta…"
            className="pl-9"
            value={search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}
