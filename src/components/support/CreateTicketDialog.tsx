import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CreateTicketForm } from './CreateTicketForm';
import { CreateTicketData, RequestType } from '@/hooks/useSupportTickets';

interface CreateTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CreateTicketData) => Promise<void>;
  isSubmitting: boolean;
  defaultType?: RequestType;
}

export function CreateTicketDialog({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
  defaultType,
}: CreateTicketDialogProps) {
  const handleSubmit = async (data: CreateTicketData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Abrir novo chamado</DialogTitle>
          <DialogDescription>
            Preencha os detalhes abaixo para que nossa equipe possa ajudá-lo da melhor forma.
          </DialogDescription>
        </DialogHeader>
        <CreateTicketForm
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
          defaultType={defaultType}
        />
      </DialogContent>
    </Dialog>
  );
}
