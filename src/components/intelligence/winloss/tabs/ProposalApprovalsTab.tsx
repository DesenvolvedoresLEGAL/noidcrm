import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  CheckCircle2, XCircle, Clock, Mail, Phone, Globe, User,
  Trophy, MessageSquare, ExternalLink, Download, Building2, FileText,
  List as ListIcon, Users
} from 'lucide-react';
import { useProposalApprovalsHistory, type ProposalApprovalEntry } from '@/hooks/useProposalApprovalsHistory';
import { formatDateTimeBR } from '@/lib/dateUtils';
import { LOSS_CATEGORY_LABELS, WIN_CATEGORY_LABELS } from '@/utils/category-labels';
import type { DateRange } from '@/hooks/useWinLossData';

interface Props {
  organizationId: string;
  pipelineId: string | null;
  dateRange: DateRange;
}

type Filter = 'all' | 'accepted' | 'declined' | 'expired';
type ViewMode = 'list' | 'by_account' | 'by_seller';

const formatBRL = (v: number | null | undefined) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0);

export function ProposalApprovalsTab({ organizationId, pipelineId, dateRange }: Props) {
  const { data, isLoading } = useProposalApprovalsHistory(organizationId, dateRange, pipelineId);
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<ViewMode>('list');

  const filtered = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data;
    return data.filter(d => d.status === filter);
  }, [data, filter]);

  const counts = useMemo(() => ({
    all: data?.length || 0,
    accepted: data?.filter(d => d.status === 'accepted').length || 0,
    declined: data?.filter(d => d.status === 'declined').length || 0,
    expired: data?.filter(d => d.status === 'expired').length || 0,
  }), [data]);

  const exportCSV = () => {
    if (!filtered.length) return;
    const headers = ['Status', 'Data', 'Cliente', 'Quem decidiu', 'Cargo', 'Email', 'Telefone', 'Oportunidade', 'Valor', 'Vendedor', 'Motivo Ganho', 'Diferenciais', 'Feedback', 'Motivo Perda', 'Concorrente', 'IP'];
    const rows = filtered.map(p => {
      const ts = p.accepted_at || p.declined_at || p.expires_at;
      return [
        p.status, ts ? formatDateTimeBR(ts) : '',
        p.account_name,
        p.acceptor_name || '', p.acceptor_position || '', p.acceptor_email || '', p.acceptor_phone || '',
        p.opportunity_title, formatBRL(p.total_value || p.opportunity_value), p.owner_name,
        p.win_reason_name || '', (p.key_differentiators || []).map(d => WIN_CATEGORY_LABELS[d] || d).join('; '),
        (p.customer_feedback || '').replace(/\n/g, ' '),
        p.loss_reason_name || p.declined_reason || '', p.competitor || '', p.acceptor_ip || '',
      ].map(s => `"${String(s).replace(/"/g, '""')}"`).join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-decisoes-propostas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-primary" />
              Relatório de Decisões de Propostas
            </CardTitle>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!filtered.length}>
              <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar CSV
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap mt-2">
            <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
              <TabsList className="h-auto">
                <TabsTrigger value="all" className="text-xs">Todas <Badge variant="secondary" className="ml-1.5 h-4 text-[10px]">{counts.all}</Badge></TabsTrigger>
                <TabsTrigger value="accepted" className="text-xs">Aprovadas <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] bg-emerald-500/10 text-emerald-600">{counts.accepted}</Badge></TabsTrigger>
                <TabsTrigger value="declined" className="text-xs">Recusadas <Badge variant="secondary" className="ml-1.5 h-4 text-[10px] bg-red-500/10 text-red-600">{counts.declined}</Badge></TabsTrigger>
                <TabsTrigger value="expired" className="text-xs">Expiradas <Badge variant="secondary" className="ml-1.5 h-4 text-[10px]">{counts.expired}</Badge></TabsTrigger>
              </TabsList>
            </Tabs>

            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-auto">
                <TabsTrigger value="list" className="text-xs gap-1"><ListIcon className="h-3 w-3" /> Lista</TabsTrigger>
                <TabsTrigger value="by_account" className="text-xs gap-1"><Building2 className="h-3 w-3" /> Por Cliente</TabsTrigger>
                <TabsTrigger value="by_seller" className="text-xs gap-1"><Users className="h-3 w-3" /> Por Vendedor</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-sm">
              Nenhuma proposta neste filtro/período.
            </div>
          ) : view === 'list' ? (
            <ScrollArea className="h-[600px] pr-3">
              <div className="space-y-2">
                {filtered.map(entry => <ApprovalRow key={entry.id} entry={entry} />)}
              </div>
            </ScrollArea>
          ) : (
            <ScrollArea className="h-[600px] pr-3">
              <GroupedView entries={filtered} groupBy={view === 'by_account' ? 'account' : 'seller'} />
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function GroupedView({
  entries,
  groupBy,
}: {
  entries: ProposalApprovalEntry[];
  groupBy: 'account' | 'seller';
}) {
  const groups = useMemo(() => {
    const map = new Map<string, { key: string; label: string; items: ProposalApprovalEntry[] }>();
    for (const e of entries) {
      const key = groupBy === 'account' ? (e.account_id || 'sem-cliente') : (e.owner_user_id || 'sem-vendedor');
      const label = groupBy === 'account' ? e.account_name : e.owner_name;
      if (!map.has(key)) map.set(key, { key, label, items: [] });
      map.get(key)!.items.push(e);
    }
    return [...map.values()].sort((a, b) => b.items.length - a.items.length);
  }, [entries, groupBy]);

  return (
    <Accordion type="multiple" className="space-y-2">
      {groups.map(g => {
        const accepted = g.items.filter(i => i.status === 'accepted');
        const declined = g.items.filter(i => i.status === 'declined');
        const expired = g.items.filter(i => i.status === 'expired');
        const valApproved = accepted.reduce((s, i) => s + (i.total_value || i.opportunity_value || 0), 0);
        const valLost = [...declined, ...expired].reduce((s, i) => s + (i.total_value || i.opportunity_value || 0), 0);
        const winRate = accepted.length + declined.length > 0
          ? Math.round((accepted.length / (accepted.length + declined.length)) * 100)
          : null;

        return (
          <AccordionItem key={g.key} value={g.key} className="border rounded-lg px-3">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center justify-between gap-3 flex-1 pr-2">
                <div className="flex items-center gap-2 min-w-0">
                  {groupBy === 'account' ? <Building2 className="h-4 w-4 text-primary shrink-0" /> : <User className="h-4 w-4 text-primary shrink-0" />}
                  <span className="font-medium text-sm truncate">{g.label}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  <Badge variant="secondary" className="text-[10px]">{g.items.length} prop.</Badge>
                  {accepted.length > 0 && <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">✓ {accepted.length}</Badge>}
                  {declined.length > 0 && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600">✕ {declined.length}</Badge>}
                  {expired.length > 0 && <Badge variant="outline" className="text-[10px] text-muted-foreground">⌛ {expired.length}</Badge>}
                  {winRate !== null && <Badge variant="outline" className="text-[10px]">{winRate}% aprov.</Badge>}
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">{formatBRL(valApproved)}</Badge>
                  {valLost > 0 && <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600">−{formatBRL(valLost)}</Badge>}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-1 pb-3">
              <div className="space-y-2">
                {g.items.map(entry => <ApprovalRow key={entry.id} entry={entry} hideClient={groupBy === 'account'} />)}
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

function ApprovalRow({ entry, hideClient = false }: { entry: ProposalApprovalEntry; hideClient?: boolean }) {
  const ts = entry.accepted_at || entry.declined_at || entry.expires_at;
  const statusConfig = {
    accepted: { icon: CheckCircle2, color: 'text-emerald-500', bg: 'bg-emerald-500/5 border-emerald-500/20', label: 'APROVADA' },
    declined: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/5 border-red-500/20', label: 'RECUSADA' },
    expired: { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30 border-muted', label: 'EXPIRADA' },
  }[entry.status as 'accepted' | 'declined' | 'expired'] || { icon: Clock, color: 'text-muted-foreground', bg: 'bg-muted/30 border-muted', label: entry.status.toUpperCase() };
  const Icon = statusConfig.icon;

  return (
    <div className={`p-3 rounded-lg border ${statusConfig.bg}`}>
      <div className="flex items-start gap-3">
        <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${statusConfig.color}`} />
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: status + opportunity + value + open */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-[10px] ${statusConfig.color}`}>{statusConfig.label}</Badge>
              <span className="font-medium text-xs truncate">{entry.opportunity_title}</span>
              {entry.proposal_number && (
                <Badge variant="secondary" className="text-[10px]">#{entry.proposal_number}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">{formatBRL(entry.total_value || entry.opportunity_value)}</span>
              <Link to={`/opportunity/${entry.opportunity_id}`}>
                <Button variant="ghost" size="sm" className="h-6 px-2">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </div>

          {/* Cliente + Who + When */}
          <div className="grid sm:grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {!hideClient && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Building2 className="h-3 w-3" />
                <span className="truncate">
                  Cliente: <span className="text-foreground font-medium">{entry.account_name}</span>
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">
                <span className="text-foreground font-medium">{entry.acceptor_name || '—'}</span>
                {entry.acceptor_position && <span> · {entry.acceptor_position}</span>}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{ts ? formatDateTimeBR(ts) : '—'}</span>
            </div>
            {entry.acceptor_email && (
              <div className="flex items-center gap-1.5 text-muted-foreground truncate">
                <Mail className="h-3 w-3" />
                <span className="truncate">{entry.acceptor_email}</span>
              </div>
            )}
            {entry.acceptor_phone && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Phone className="h-3 w-3" />
                <span>{entry.acceptor_phone}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Trophy className="h-3 w-3" />
              <span>Vendedor: <span className="text-foreground">{entry.owner_name}</span></span>
            </div>
            {entry.acceptor_ip && (
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Globe className="h-3 w-3" />
                <span>IP {entry.acceptor_ip}</span>
              </div>
            )}
          </div>

          {/* Win details */}
          {entry.status === 'accepted' && (entry.win_reason_name || entry.key_differentiators?.length || entry.customer_feedback) && (
            <div className="pt-1.5 border-t border-emerald-500/20 space-y-1.5">
              {entry.win_reason_name && (
                <div className="flex items-center gap-1.5 text-[11px]">
                  <span className="text-muted-foreground">Motivo do ganho:</span>
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">
                    {entry.win_reason_name}
                  </Badge>
                </div>
              )}
              {entry.key_differentiators && entry.key_differentiators.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                  <span className="text-muted-foreground">Diferenciais:</span>
                  {entry.key_differentiators.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/5">
                      {WIN_CATEGORY_LABELS[d] || d}
                    </Badge>
                  ))}
                </div>
              )}
              {entry.customer_feedback && (
                <div className="flex items-start gap-1.5 text-[11px] p-2 rounded bg-blue-500/5 border border-blue-500/10">
                  <MessageSquare className="h-3 w-3 text-blue-500 mt-0.5 shrink-0" />
                  <p className="italic">"{entry.customer_feedback}"</p>
                </div>
              )}
            </div>
          )}

          {/* Loss details */}
          {(entry.status === 'declined' || entry.status === 'expired') && (entry.loss_reason_name || entry.declined_reason || entry.competitor) && (
            <div className="pt-1.5 border-t border-red-500/20 space-y-1.5">
              <div className="flex items-center gap-1.5 text-[11px] flex-wrap">
                {entry.loss_reason_category && (
                  <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600">
                    {LOSS_CATEGORY_LABELS[entry.loss_reason_category] || entry.loss_reason_category}
                  </Badge>
                )}
                {entry.loss_reason_name && (
                  <span className="text-muted-foreground">→ {entry.loss_reason_name}</span>
                )}
                {entry.competitor && (
                  <Badge variant="secondary" className="text-[10px] bg-orange-500/10 text-orange-600">
                    Concorrente: {entry.competitor}
                  </Badge>
                )}
              </div>
              {entry.declined_reason && (
                <div className="flex items-start gap-1.5 text-[11px] p-2 rounded bg-rose-500/5 border border-rose-500/10">
                  <MessageSquare className="h-3 w-3 text-rose-500 mt-0.5 shrink-0" />
                  <p className="italic">"{entry.declined_reason}"</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
