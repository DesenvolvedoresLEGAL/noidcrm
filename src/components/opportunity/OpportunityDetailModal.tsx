import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import { OpportunityHeader } from './OpportunityHeader';
import { OpportunitySidebar } from './OpportunitySidebar';
import { OpportunityTabs } from './OpportunityTabs';
import { EditOpportunityModal } from './EditOpportunityModal';
import { Pipeline } from '@/services/crm/types';
import { useToast } from '@/hooks/use-toast';

interface OpportunityDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity: any;
  pipeline: Pipeline;
  pipelines: Pipeline[];
  onWon: () => void;
  onLost: () => void;
  onUpdate: (id: string, data: any) => Promise<void>;
}

export function OpportunityDetailModal({
  open,
  onOpenChange,
  opportunity,
  pipeline,
  pipelines,
  onWon,
  onLost,
  onUpdate,
}: OpportunityDetailModalProps) {
  const { toast } = useToast();
  const [editModalOpen, setEditModalOpen] = useState(false);

  if (!opportunity) return null;

  const handleUpdateTitle = async (newTitle: string) => {
    try {
      await onUpdate(opportunity.id, { title: newTitle });
      toast({
        title: 'Sucesso',
        description: 'Título atualizado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar título',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const handleUpdateField = async (field: string, value: any) => {
    try {
      // Handle nested fields like meta.mrr
      const updateData: any = {};
      if (field.includes('.')) {
        const [parent, child] = field.split('.');
        updateData[parent] = {
          ...opportunity[parent],
          [child]: value,
        };
      } else {
        updateData[field] = value;
      }

      await onUpdate(opportunity.id, updateData);
      toast({
        title: 'Sucesso',
        description: 'Campo atualizado com sucesso',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao atualizar campo',
        variant: 'destructive',
      });
      throw error;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] p-0 overflow-hidden">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-6 pb-4">
              <OpportunityHeader
                opportunity={opportunity}
                pipeline={pipeline}
                onWon={onWon}
                onLost={onLost}
                onUpdateTitle={handleUpdateTitle}
                onEditClick={() => setEditModalOpen(true)}
              />
            </div>

            <Separator />

            {/* Main Content: Sidebar + Tabs */}
            <div className="flex flex-1 overflow-hidden">
              {/* Sidebar - 30% */}
              <div className="w-[350px] border-r overflow-y-auto p-6">
                <OpportunitySidebar opportunity={opportunity} onUpdateField={handleUpdateField} />
              </div>

              {/* Main Area - 70% */}
              <div className="flex-1 overflow-y-auto p-6">
                <OpportunityTabs opportunityId={opportunity.id} />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <EditOpportunityModal
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        opportunity={opportunity}
        pipelines={pipelines}
        onSave={onUpdate}
      />
    </>
  );
}
