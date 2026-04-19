import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { toast } from 'sonner';
import { Clock, Mail, AlertCircle, CheckCircle2, RefreshCw, Send, SkipForward } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CronStatus {
  job_name: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_run_status: string | null;
}

interface DigestRun {
  id: string;
  user_id: string;
  status: string;
  email_sent: boolean | null;
  finished_at: string | null;
  scheduled_for: string | null;
  summary_payload: any;
}

export function DailyDigestHealthCard() {
  const { user } = useCurrentUser();
  const [triggering, setTriggering] = useState(false);

  const { data: cronStatus, refetch: refetchCron } = useQuery({
    queryKey: ['daily-digest-cron-status'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_daily_digest_cron_status');
      if (error) throw error;
      return (data ?? []) as CronStatus[];
    },
    refetchInterval: 30000,
  });

  const { data: todayRuns, refetch: refetchRuns } = useQuery({
    queryKey: ['daily-digest-runs-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('daily_digest_runs')
        .select('id, user_id, status, email_sent, finished_at, scheduled_for, summary_payload')
        .gte('scheduled_for', today + 'T00:00:00')
        .order('finished_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as DigestRun[];
    },
    refetchInterval: 30000,
  });

  const handleTriggerNow = async () => {
    if (!user?.id) return;
    setTriggering(true);
    try {
      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const r = await fetch(
        `${projectUrl}/functions/v1/build-daily-digest?force_user_id=${user.id}&ignore_hour=1`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${anonKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ triggered_by: 'manual' }),
        }
      );
      const result = await r.json();
      if (r.ok && result.success) {
        toast.success(
          result.email_sent > 0
            ? 'Resumo gerado e e-mail enviado!'
            : `Resumo processado (${result.processed} usuários, ${result.email_sent} e-mails)`
        );
      } else {
        toast.error('Falha: ' + (result.error || 'erro desconhecido'));
      }
      refetchRuns();
      refetchCron();
    } catch (e) {
      toast.error('Erro ao disparar: ' + String(e));
    } finally {
      setTriggering(false);
    }
  };

  const stats = (todayRuns ?? []).reduce(
    (acc, r) => {
      acc.total++;
      if (r.status === 'completed' && r.email_sent) acc.sent++;
      else if (r.status === 'skipped') acc.skipped++;
      else if (r.status === 'failed') acc.failed++;
      return acc;
    },
    { total: 0, sent: 0, skipped: 0, failed: 0 }
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Saúde do Daily Digest
            </CardTitle>
            <CardDescription>
              Status do agendamento automático e execuções de hoje
            </CardDescription>
          </div>
          <Button onClick={handleTriggerNow} disabled={triggering} size="sm" variant="outline">
            {triggering ? (
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Disparar agora para mim
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cron status */}
        <div>
          <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Clock className="h-4 w-4" /> Agendamentos
          </h4>
          <div className="space-y-2">
            {(cronStatus ?? []).length === 0 ? (
              <div className="text-sm text-destructive flex items-center gap-2">
                <AlertCircle className="h-4 w-4" /> Nenhum cron agendado
              </div>
            ) : (
              cronStatus!.map((j) => (
                <div
                  key={j.job_name}
                  className="flex items-center justify-between border rounded-md px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={j.active ? 'default' : 'secondary'}>
                      {j.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <span className="font-mono text-xs">{j.job_name}</span>
                    <span className="text-muted-foreground text-xs">{j.schedule}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {j.last_run_at
                      ? `Última: ${formatDistanceToNow(new Date(j.last_run_at), { addSuffix: true, locale: ptBR })}${j.last_run_status ? ` · ${j.last_run_status}` : ''}`
                      : 'Nunca rodou'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          <StatCard label="Total hoje" value={stats.total} />
          <StatCard label="E-mails enviados" value={stats.sent} icon={<CheckCircle2 className="h-4 w-4 text-green-600" />} />
          <StatCard label="Pulados" value={stats.skipped} icon={<SkipForward className="h-4 w-4 text-yellow-600" />} />
          <StatCard label="Falharam" value={stats.failed} icon={<AlertCircle className="h-4 w-4 text-destructive" />} />
        </div>

        {/* Recent runs */}
        <div>
          <h4 className="text-sm font-medium mb-2">Últimas execuções (hoje)</h4>
          <div className="space-y-1 max-h-64 overflow-auto">
            {(todayRuns ?? []).length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma execução hoje ainda.</div>
            ) : (
              todayRuns!.map((r) => {
                const reason = r.summary_payload?.reason;
                const errorMsg = r.summary_payload?.email_error?.error;
                return (
                  <div
                    key={r.id}
                    className="flex items-center justify-between text-xs border-b py-1.5 px-2"
                  >
                    <div className="flex items-center gap-2">
                      <StatusBadge status={r.status} emailSent={r.email_sent} />
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {r.user_id.slice(0, 8)}…
                      </span>
                      {reason && <span className="text-yellow-700">({reason})</span>}
                      {errorMsg && <span className="text-destructive">({errorMsg})</span>}
                    </div>
                    <span className="text-muted-foreground">
                      {r.finished_at
                        ? formatDistanceToNow(new Date(r.finished_at), { addSuffix: true, locale: ptBR })
                        : '—'}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="border rounded-md p-3">
      <div className="text-xs text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
    </div>
  );
}

function StatusBadge({ status, emailSent }: { status: string; emailSent: boolean | null }) {
  if (status === 'completed' && emailSent) return <Badge className="bg-green-600">enviado</Badge>;
  if (status === 'completed') return <Badge variant="secondary">processado</Badge>;
  if (status === 'skipped') return <Badge variant="outline">pulado</Badge>;
  if (status === 'failed') return <Badge variant="destructive">falhou</Badge>;
  if (status === 'running') return <Badge variant="secondary">rodando</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
