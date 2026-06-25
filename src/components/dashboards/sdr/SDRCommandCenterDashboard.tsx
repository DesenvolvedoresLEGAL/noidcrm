import { useNavigate } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useSDRDashboardData } from '@/hooks/sdr/useSDRDashboardData';
import { paceStatusColor, paceStatusLabel } from '@/lib/sdr/pace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import {
  Target, Flame, Clock, AlertTriangle, ChevronRight, Phone, CalendarDays,
  CheckCircle2, Settings, TrendingUp, Zap, Users2,
} from 'lucide-react';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function formatToday() {
  return new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: '2-digit', month: 'long',
  });
}

export function SDRCommandCenterDashboard() {
  const { user, profile, isOwner, isOrgAdmin } = useCurrentUser();
  const navigate = useNavigate();
  const { data, isLoading } = useSDRDashboardData();

  const canConfigureGoals = isOwner || isOrgAdmin;
  const fullName = profile?.full_name || (user?.email || 'SDR').split('@')[0];
  const firstName = fullName.split(' ')[0];
  const initials = fullName
    .split(' ')
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'SD';

  if (isLoading || !data) {
    return (
      <div className="p-4 md:p-6 space-y-4">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-56 w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  const { pace, hasGoal, scoreboard, attackPlan, dailyLeadsTarget } = data;
  const required = pace?.requiredDailyPace ?? dailyLeadsTarget ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      {/* ============ HERO PREMIUM ============ */}
      <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background">
        <div className="absolute inset-0 opacity-30 pointer-events-none" aria-hidden>
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -bottom-32 -left-16 w-80 h-80 rounded-full bg-orange-500/10 blur-3xl" />
        </div>

        <CardContent className="relative p-5 md:p-8 space-y-6">
          {/* Header — saudação + avatar + contexto */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-2 ring-primary/30">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className="bg-primary/10 border-primary/30 text-primary">
                    <Zap className="h-3 w-3 mr-1" /> Pré-vendas
                  </Badge>
                  {pace && (
                    <Badge variant="outline" className={paceStatusColor(pace.status)}>
                      {paceStatusLabel(pace.status)}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground capitalize">{formatToday()}</span>
                </div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">
                  {getGreeting()}, {firstName}.
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {hasGoal && required > 0
                    ? <>Foque em qualificar <span className="text-primary font-semibold">{required} lead(s)</span> hoje para proteger o pace.</>
                    : 'Sua central de execução diária de pré-vendas.'}
                </p>
              </div>
            </div>

            {hasGoal && pace && (
              <div className="hidden md:flex flex-col items-end">
                <span className="text-xs text-muted-foreground">Progresso do mês</span>
                <span className="text-3xl font-bold leading-tight">{pace.targetPercent}%</span>
                <span className="text-xs text-muted-foreground">
                  {pace.qualifiedMonth} de {pace.monthlyTarget} leads
                </span>
              </div>
            )}
          </div>

          {/* Hero Meta/Pace */}
          {hasGoal && pace ? (
            <div className="space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Target className="h-4 w-4 text-primary" />
                    <span>Meta de qualificação · {pace.period.month}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{pace.message}</span>
                </div>
                <Progress value={Math.min(pace.targetPercent, 100)} className="h-2.5" />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <HeroStat icon={<CheckCircle2 className="h-4 w-4" />} label="Qualificados no mês" value={pace.qualifiedMonth} />
                <HeroStat icon={<Target className="h-4 w-4" />} label="Meta mensal" value={pace.monthlyTarget} />
                <HeroStat icon={<Flame className="h-4 w-4 text-orange-500" />} label="Faltam" value={pace.missingLeads} />
                <HeroStat icon={<Zap className="h-4 w-4 text-primary" />} label="Pace de hoje" value={`${pace.requiredDailyPace}/dia`} />
                <HeroStat icon={<TrendingUp className="h-4 w-4" />} label="Projeção fim mês" value={pace.projectedMonthEnd} />
                <HeroStat
                  icon={<Clock className="h-4 w-4" />}
                  label="Gap vs pace"
                  value={`${pace.paceGap >= 0 ? '+' : ''}${pace.paceGap}`}
                  tone={pace.paceGap >= 0 ? 'good' : 'bad'}
                />
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-primary/30 bg-background/60 p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold">Meta de qualificação ainda não configurada pelo gestor comercial.</p>
                  <p className="text-sm text-muted-foreground">
                    Continue executando sua rotina. Assim que a meta for definida em Configurações de Vendas,
                    seu pace aparecerá aqui automaticamente.
                  </p>
                </div>
              </div>
              {canConfigureGoals && (
                <Button variant="outline" onClick={() => navigate('/app/settings/sales/sellers')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Ir para Configurações de Vendas
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ============ SCOREBOARD DIÁRIO ============ */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Flame className="h-5 w-5 text-orange-500" />
                Scoreboard de Hoje
              </CardTitle>
              <CardDescription>Execução diária. Qualificação é o que conta no fim do dia.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <ScoreCard
              icon={<Target className="h-4 w-4" />}
              label="Qualificados hoje"
              done={scoreboard.qualifiedLeadsToday.done}
              target={scoreboard.qualifiedLeadsToday.target}
              primary
            />
            <ScoreCard
              icon={<Target className="h-4 w-4" />}
              label="Meta do dia"
              done={scoreboard.qualifiedLeadsToday.target}
              target={0}
              hideTarget
            />
            <ScoreCard
              icon={<Phone className="h-4 w-4" />}
              label="Ligações hoje"
              done={scoreboard.calls.done}
              target={scoreboard.calls.target}
            />
            <ScoreCard
              icon={<Users2 className="h-4 w-4" />}
              label="Contatos efetivos"
              done={scoreboard.effectiveContacts.done}
              target={scoreboard.effectiveContacts.target}
              hideTarget={scoreboard.effectiveContacts.target === 0}
            />
            <ScoreCard
              icon={<CalendarDays className="h-4 w-4" />}
              label="Reuniões hoje"
              done={scoreboard.meetings.done}
              target={scoreboard.meetings.target}
              hideTarget={scoreboard.meetings.target === 0}
            />
            <ScoreCard
              icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
              label="Atrasadas"
              done={scoreboard.overdueActivities}
              target={0}
              hideTarget
              tone={scoreboard.overdueActivities > 0 ? 'bad' : undefined}
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

      {/* ============ PLANO DE ATAQUE ============ */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-red-500" />
            Plano de Ataque de Hoje
          </CardTitle>
          <CardDescription>
            Apenas oportunidades em aberto sob sua responsabilidade. Foque nestas antes de abrir novos contatos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attackPlan.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-10 w-10 mx-auto mb-2 opacity-50" />
              <p>Você não tem leads críticos sob sua responsabilidade agora.</p>
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

function HeroStat({
  icon, label, value, tone,
}: { icon: React.ReactNode; label: string; value: string | number; tone?: 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-500' : tone === 'bad' ? 'text-orange-500' : '';
  return (
    <div className="rounded-md border bg-background/70 backdrop-blur p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        {icon}<span>{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ScoreCard({
  icon, label, done, target, primary, hideTarget, tone,
}: {
  icon: React.ReactNode; label: string; done: number; target: number;
  primary?: boolean; hideTarget?: boolean; tone?: 'good' | 'bad';
}) {
  const pct = target > 0 ? Math.min(Math.round((done / target) * 100), 100) : 0;
  const color = tone === 'bad' ? 'text-orange-500' : tone === 'good' ? 'text-emerald-500' : '';
  return (
    <div className={`rounded-md border p-3 ${primary ? 'border-primary/40 bg-primary/5' : ''}`}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>
        {done}
        {!hideTarget && target > 0 && <span className="text-sm text-muted-foreground font-normal">/{target}</span>}
      </p>
      {target > 0 && !hideTarget && <Progress value={pct} className="h-1 mt-2" />}
    </div>
  );
}

export default SDRCommandCenterDashboard;
