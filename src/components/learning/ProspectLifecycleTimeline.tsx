import { useLifecycleTimeline } from "@/hooks/useLifecycleTimeline";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sparkles,
  Brain,
  Mail,
  MailOpen,
  Reply,
  CalendarCheck,
  Trophy,
  XCircle,
  Phone,
  MessageSquare,
  Plus,
  CircleDot,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  prospectId: string | undefined;
}

const ICONS: Record<string, any> = {
  enrichment_completed: Sparkles,
  decision_executed: Brain,
  opportunity_created: Plus,
  task_created: CircleDot,
  email_sent: Mail,
  email_opened: MailOpen,
  email_replied: Reply,
  whatsapp_sent: MessageSquare,
  whatsapp_replied: Reply,
  call_made: Phone,
  meeting_booked: CalendarCheck,
  deal_won: Trophy,
  deal_lost: XCircle,
};

const LABELS: Record<string, string> = {
  enrichment_completed: "Enrichment concluído",
  decision_executed: "Decisão executada",
  opportunity_created: "Oportunidade criada",
  task_created: "Tarefa criada",
  email_sent: "Email enviado",
  email_opened: "Email aberto",
  email_replied: "Email respondido",
  whatsapp_sent: "WhatsApp enviado",
  whatsapp_replied: "WhatsApp respondido",
  call_made: "Ligação realizada",
  meeting_booked: "Reunião agendada",
  deal_won: "Negócio ganho",
  deal_lost: "Negócio perdido",
};

export function ProspectLifecycleTimeline({ prospectId }: Props) {
  const { data, isLoading } = useLifecycleTimeline(prospectId);

  if (isLoading) return <Skeleton className="h-48 w-full" />;

  const events = data ?? [];

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        Nenhum evento registrado ainda.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-border ml-3 space-y-4">
      {events.map((e: any) => {
        const Icon = ICONS[e.event_type] ?? CircleDot;
        const label = LABELS[e.event_type] ?? e.event_type;
        return (
          <li key={e.id} className="ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-border">
              <Icon className="h-3 w-3 text-primary" />
            </span>
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-foreground">{label}</p>
              <time className="text-xs text-muted-foreground tabular-nums">
                {format(new Date(e.created_at), "dd/MM HH:mm", { locale: ptBR })}
              </time>
            </div>
            {e.event_subtype && (
              <p className="text-xs text-muted-foreground">{e.event_subtype}</p>
            )}
            {e.payload?.quality_label && (
              <p className="text-xs text-muted-foreground">
                qualidade: {e.payload.quality_label}
              </p>
            )}
            {e.payload?.priority_label && (
              <p className="text-xs text-muted-foreground">
                regra: {e.payload.priority_label}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
