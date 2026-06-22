import { Card, CardContent } from '@/components/ui/card';
import { useSDRCopilotTasks } from '@/hooks/intelligence/useSDRCopilotTasks';
import { CheckCircle2, MessageCircle, Phone, Sparkles, Trash2, ListChecks, Send } from 'lucide-react';

function Kpi({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: number | string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-start gap-3">
        <div className="rounded-md bg-muted p-2"><Icon className="h-4 w-4" /></div>
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-lg font-semibold leading-tight">{value}</div>
          {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
        </div>
      </CardContent>
    </Card>
  );
}

export function SDRCopilotKpiBar() {
  const { data: tasks = [] } = useSDRCopilotTasks();
  const todayIso = new Date().toISOString().slice(0, 10);
  const completedToday = (t: { status: string; completed_at: string | null }) =>
    !!t.completed_at && t.completed_at.slice(0, 10) === todayIso;

  const ready = tasks.filter((t) => ['pending', 'in_review', 'approved'].includes(t.status)).length;
  const withPhone = tasks.filter((t) => t.preferred_channel === 'whatsapp' || t.preferred_channel === 'call').length;
  const withWhats = tasks.filter((t) => t.preferred_channel === 'whatsapp').length;
  const withBrief = tasks.filter((t) => t.commercial_brief && Object.keys(t.commercial_brief).length > 0).length;
  const promotedToday = tasks.filter((t) => t.status === 'promoted_to_crm' && completedToday(t)).length;
  const activitiesToday = tasks.filter((t) => t.status === 'activity_created' && completedToday(t)).length;
  const dismissed = tasks.filter((t) => t.status === 'dismissed').length;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
      <Kpi icon={Sparkles} label="Prontos para ação" value={ready} />
      <Kpi icon={Phone} label="Com telefone" value={withPhone} />
      <Kpi icon={MessageCircle} label="Com WhatsApp" value={withWhats} />
      <Kpi icon={ListChecks} label="Com brief" value={withBrief} />
      <Kpi icon={Send} label="Promovidos hoje" value={promotedToday} />
      <Kpi icon={CheckCircle2} label="Atividades hoje" value={activitiesToday} />
      <Kpi icon={Trash2} label="Descartados" value={dismissed} />
    </div>
  );
}
