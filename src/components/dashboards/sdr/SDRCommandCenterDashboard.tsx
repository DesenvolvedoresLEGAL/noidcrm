import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSDRDashboardData } from '@/hooks/sdr/useSDRDashboardData';
import { paceStatusColor, paceStatusLabel } from '@/lib/sdr/pace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Target, Flame, Clock, AlertTriangle, ChevronRight, Phone, CalendarDays, CheckCircle2,
} from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function SDRCommandCenterDashboard() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const { data, isLoading } = useSDRDashboardData();

  const firstName = (user?.user_metadata?.full_name || user?.email || 'SDR').split(' ')[0];

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const { pace, hasGoal, scoreboard, attackPlan } = data;
  const required = pace?.requiredDailyPace ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* 1. Header Operacional */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            {getGreeting()}, {firstName}.
            {hasGoal && required > 0 && (
              <> Hoje é dia de buscar <span className="text-primary">{required} lead(s) qualificado(s)</span>.</>
            )}
          </h1>
          {pace && (
            <p className="text-sm text-muted-foreground mt-1">
              {pace.period.month}: {pace.qualifiedMonth}/{pace.monthlyTarget} leads qualificados ·{' '}
              {pace.targetPercent}% da meta · faltam {pace.missingLeads}
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline">Pré-vendas</Badge>
          {pace && (
            <Badge variant="outline" className={paceStatusColor(pace.status)}>
              {paceStatusLabel(pace.status)}
            </Badge>
          )}
        </div>
      </div>

      {/* 2. Hero: Meta e Pace de Qualificação */}
      {hasGoal && pace ? (
        <Card className="border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Minha Meta de Qualificação
              </CardTitle>
              <Badge variant="outline" className={paceStatusColor(pace.status)}>
                {paceStatusLabel(pace.status)}
              </Badge>
            </div>
            <CardDescription>{pace.message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-3xl font-bold">
                  {pace.qualifiedMonth}<span className="text-lg text-muted-foreground"> / {pace.monthlyTarget}</span>
                </span>
                <span className="text-sm font-medium">{pace.targetPercent}%</span>
              </div>
              <Progress value={Math.min(pace.targetPercent, 100)} className="h-2" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
              <MiniStat label="Faltam" value={pace.missingLeads} />
              <MiniStat label="Dias úteis restantes" value={pace.businessDaysRemaining} />
              <MiniStat label="Precisa por dia" value={`${pace.requiredDailyPace}/dia`} />
              <MiniStat
                label="Gap vs pace ideal"
                value={`${pace.paceGap >= 0 ? '+' : ''}${pace.paceGap}`}
                tone={pace.paceGap >= 0 ? 'good' : 'bad'}
              />
              <MiniStat label="Pace ideal hoje" value={pace.idealPaceToday} />
              <MiniStat label="Projeção fim do mês" value={pace.projectedMonthEnd} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="py-6 flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Meta de qualificação não configurada</p>
              <p className="text-sm text-muted-foreground">
                Defina sua meta mensal de leads qualificados para acompanhar o pace.
              </p>
            </div>
            <Button variant="outline" onClick={() => navigate('/app/settings')}>Configurar meta</Button>
          </CardContent>
        </Card>
      )}

      {/* 4. Scoreboard Diário */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-500" />
            Scoreboard de Hoje
          </CardTitle>
          <CardDescription>Meta diária vs realizado. Qualificação é o que conta.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ScoreCard
              icon={<Target className="h-4 w-4" />}
              label="Leads qualificados"
              done={scoreboard.qualifiedLeadsToday.done}
              target={scoreboard.qualifiedLeadsToday.target}
              primary
            />
            <ScoreCard
              icon={<Phone className="h-4 w-4" />}
              label="Ligações"
              done={scoreboard.calls.done}
              target={scoreboard.calls.target}
            />
            <ScoreCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Reuniões"
              done={scoreboard.meetings.done}
              target={scoreboard.meetings.target}
            />
            <ScoreCard
              icon={<Clock className="h-4 w-4" />}
              label="Vencem hoje"
              done={scoreboard.dueTodayActivities}
              target={0}
              hideTarget
            />
          </div>

          {scoreboard.overdueActivities > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-orange-500/10 border border-orange-500/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
              <span>
                Existem <strong>{scoreboard.overdueActivities}</strong> atividade(s) atrasada(s) bloqueando avanço de leads.
              </span>
            </div>
          )}
          {scoreboard.qualifiedLeadsToday.done === 0 && required > 0 && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              <span>Nenhum lead qualificado hoje. Comece pelo Plano de Ataque abaixo.</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Plano de Ataque do Dia */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-500" />
            Plano de Ataque de Hoje
          </CardTitle>
          <CardDescription>
            Para bater o pace, foque nestes leads antes de abrir novos contatos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attackPlan.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Você não tem leads críticos agora.</p>
              <p className="text-sm">Busque novos leads ou avance os contatos em qualificação.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {attackPlan.map((item, idx) => (
                <button
                  key={item.id}
                  onClick={() => navigate(item.ctaHref)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm shrink-0">
                    {idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {item.priorityReasons.join(' · ') || 'priorize'} · {item.recommendedAction}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-orange-500' : '';
  return (
    <div className="rounded-md border bg-card/50 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ScoreCard({
  icon, label, done, target, primary, hideTarget,
}: { icon: React.ReactNode; label: string; done: number; target: number; primary?: boolean; hideTarget?: boolean }) {
  const pct = target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0;
  return (
    <div className={`rounded-md border p-3 ${primary ? 'border-primary/40 bg-primary/5' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-2xl font-bold">
        {done}
        {!hideTarget && <span className="text-sm text-muted-foreground font-normal">/{target}</span>}
      </p>
      {target > 0 && <Progress value={pct} className="h-1 mt-2" />}
    </div>
  );
}

export default SDRCommandCenterDashboard;
