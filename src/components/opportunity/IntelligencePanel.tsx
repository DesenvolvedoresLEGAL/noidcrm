import { X, Network, Brain } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { OpportunityGraphSignals } from '@/components/graph/OpportunityGraphSignals';
import { DealMemoryPanel } from '@/components/memory/DealMemoryPanel';
import type { IntelligencePanel as IntelligencePanelType } from './IntelligenceMiniSidebar';

interface IntelligencePanelProps {
  panel: IntelligencePanelType;
  opportunityId: string;
  stageId?: string;
  onClose: () => void;
}

const panelConfig = {
  graph: {
    icon: Network,
    title: 'Rede de Relacionamentos',
    colorClass: 'text-blue-500',
  },
  memories: {
    icon: Brain,
    title: 'Memórias do Deal',
    colorClass: 'text-purple-500',
  },
};

export function IntelligencePanel({ panel, opportunityId, stageId, onClose }: IntelligencePanelProps) {
  const config = panelConfig[panel];
  const Icon = config.icon;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-background/60 backdrop-blur-sm z-25"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute top-0 right-0 h-full w-full max-w-2xl bg-background border-l shadow-2xl z-30"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-muted/30">
          <h2 className="font-semibold flex items-center gap-2 text-base">
            <Icon className={`h-5 w-5 ${config.colorClass}`} />
            {config.title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8 hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="p-4">
            {panel === 'graph' && (
              <OpportunityGraphSignals opportunityId={opportunityId} />
            )}
            {panel === 'memories' && (
              <DealMemoryPanel
                opportunityId={opportunityId}
                stage={stageId}
              />
            )}
          </div>
        </ScrollArea>
      </motion.div>
    </>
  );
}
