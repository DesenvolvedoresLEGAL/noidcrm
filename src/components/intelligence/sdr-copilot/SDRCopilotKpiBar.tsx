import { useSDRCopilotTasks } from '@/hooks/intelligence/useSDRCopilotTasks';
import { KpiBarSkeleton, PremiumKpi } from '@/components/intelligence/kairos/premium';
import { CheckCircle2, MessageCircle, Phone, Sparkles, Trash2, ListChecks, Send } from 'lucide-react';

export function SDRCopilotKpiBar() {
  const { data: tasks = [], isLoading } = useSDRCopilotTasks();

  if (isLoading) return <KpiBarSkeleton count={7} />;

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
      <PremiumKpi icon={Sparkles} label="Prontos para ação" value={ready} accent="violet" />
      <PremiumKpi icon={Phone} label="Com telefone" value={withPhone} accent="blue" />
      <PremiumKpi icon={MessageCircle} label="Com WhatsApp" value={withWhats} accent="emerald" />
      <PremiumKpi icon={ListChecks} label="Com brief" value={withBrief} />
      <PremiumKpi icon={Send} label="Promovidos hoje" value={promotedToday} accent="emerald" />
      <PremiumKpi icon={CheckCircle2} label="Atividades hoje" value={activitiesToday} accent="emerald" />
      <PremiumKpi icon={Trash2} label="Descartados" value={dismissed} accent="rose" />
    </div>
  );
}
