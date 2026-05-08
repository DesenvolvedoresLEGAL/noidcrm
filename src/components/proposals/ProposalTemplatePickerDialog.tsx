import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { listTemplates, type ProposalTemplate } from '@/services/crm/proposal-templates';
import { templateBadges } from '@/lib/proposals/proposalTemplateRules';

interface ProposalTemplatePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (templateId: string) => void;
}

export function ProposalTemplatePickerDialog({
  open,
  onOpenChange,
  onConfirm,
}: ProposalTemplatePickerDialogProps) {
  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['proposal-templates'],
    queryFn: listTemplates,
    enabled: open,
  });

  const defaultId = useMemo(
    () => templates.find((t: ProposalTemplate) => t.is_default)?.id ?? templates[0]?.id ?? null,
    [templates],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (open) setSelectedId(defaultId);
  }, [open, defaultId]);

  const handleConfirm = () => {
    if (!selectedId) return;
    onConfirm(selectedId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Selecionar template da proposta</DialogTitle>
          <DialogDescription>
            Escolha o template que será aplicado como padrão. Você poderá ajustar os detalhes na sequência.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando templates...
          </div>
        ) : templates.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            Nenhum template disponível. Crie um em Configurações &gt; Modelos de Proposta.
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="grid gap-2">
              {templates.map((template: any) => {
                const isSelected = selectedId === template.id;
                const badges = templateBadges(template);
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => setSelectedId(template.id)}
                    className={cn(
                      'text-left rounded-lg border p-4 transition-colors',
                      'hover:border-primary/60 hover:bg-accent',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={cn(
                          'mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md',
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                        )}
                      >
                        {isSelected ? <Check className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">{template.name}</span>
                          {template.is_default && (
                            <Badge variant="secondary" className="text-xs">Padrão</Badge>
                          )}
                          {template.control_prefix && (
                            <Badge variant="outline" className="text-xs">{template.control_prefix}</Badge>
                          )}
                        </div>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {template.description}
                          </p>
                        )}
                        {badges.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {badges.map((b, i) => (
                              <Badge key={i} variant={b.variant} className="text-xs">
                                {b.label}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedId || isLoading}>
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
