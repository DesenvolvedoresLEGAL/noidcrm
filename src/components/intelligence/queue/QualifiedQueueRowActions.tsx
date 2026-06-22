import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useDiscardQueueItem,
  useFindDecisionMakers,
  useGenerateApproachBrief,
  usePromoteToCrm,
  useRunEnrichment,
  useSendToReview,
} from '@/hooks/intelligence/useQualifiedQueueActions';
import { useCreateSDRCopilotTask } from '@/hooks/intelligence/useSDRCopilotTasks';
import { toast } from 'sonner';
import type { QualifiedQueueItem } from '@/services/intelligence/qualifiedQueue';

interface Props {
  item: QualifiedQueueItem;
  onOpenBrief: (item: QualifiedQueueItem) => void;
}

export function QualifiedQueueRowActions({ item, onOpenBrief }: Props) {
  const enrich = useRunEnrichment();
  const decision = useFindDecisionMakers();
  const brief = useGenerateApproachBrief();
  const promote = usePromoteToCrm();
  const discard = useDiscardQueueItem();
  const review = useSendToReview();

  const createSdrTask = useCreateSDRCopilotTask();

  const canPromote = item.qualification_status === 'ready_for_sdr' || item.sdr_ready;
  const canCreateSdrTask = item.sdr_ready || ['human_review', 'approach_ready', 'contact_revealed', 'ready_for_sdr'].includes(item.qualification_status);

  const handleCreateSdrTask = async () => {
    try {
      const r = await createSdrTask.mutateAsync({ queueId: item.id });
      toast.success(r.reused ? 'Tarefa SDR já existia — reaberta.' : 'Tarefa SDR criada no Copilot.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Falha ao criar tarefa SDR.');
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ações">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => enrich.mutate(item)}>Executar enriquecimento</DropdownMenuItem>
        <DropdownMenuItem onClick={() => decision.mutate(item)}>Buscar decisores</DropdownMenuItem>
        <DropdownMenuItem onClick={() => brief.mutate(item)}>Gerar brief de abordagem</DropdownMenuItem>
        <DropdownMenuItem onClick={() => onOpenBrief(item)} disabled={!item.approach_brief}>
          Abrir brief
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => promote.mutate(item)}
          disabled={!canPromote}
          className="text-primary"
        >
          Enviar para SDR (promover ao CRM)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => review.mutate({ id: item.id, reason: 'Revisão manual solicitada' })}>
          Enviar para revisão
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => discard.mutate({ id: item.id, reason: 'Descartado manualmente' })}
          className="text-destructive"
        >
          Descartar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
