import { cn } from '@/lib/utils';
import { CheckCircle2, Clock } from 'lucide-react';

interface EnrichmentTimelineProps {
  run: {
    status: string;
    started_at?: string | null;
    finished_at?: string | null;
    providers_completed?: any;
    providers_failed?: any;
    merge_status?: string | null;
  } | null;
  hasProfile: boolean;
  hasBrief: boolean;
}

function Step({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
      ) : (
        <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      )}
      <span className={cn(done ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
    </div>
  );
}

export function EnrichmentTimeline({ run, hasProfile, hasBrief }: EnrichmentTimelineProps) {
  if (!run) return null;
  const started = !!run.started_at;
  const scraped = ((run.providers_completed as string[]) || []).length > 0;
  const analyzed = hasProfile;
  const briefGenerated = hasBrief;
  const completed = run.status === 'completed';

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timeline</h4>
      <div className="space-y-1.5 pl-1">
        <Step label="Enrichment iniciado" done={started} />
        <Step label="Website scrapeado" done={scraped} />
        <Step label="Perfil analisado por IA" done={analyzed} />
        <Step label="Brief comercial gerado" done={briefGenerated} />
        <Step label="Enrichment concluído" done={completed} />
      </div>
    </div>
  );
}
