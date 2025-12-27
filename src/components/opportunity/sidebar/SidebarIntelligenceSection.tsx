import { Brain, AlertCircle, MessageSquare, FileText } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { LeadEmotionalMemoryCard } from '@/components/opportunity/LeadEmotionalMemoryCard';
import { VibeNarrativeCard } from '@/components/opportunity/VibeNarrativeCard';
import { VibeAlertsCard } from '@/components/opportunity/VibeAlertsCard';
import { VibeAdvisorChat } from '@/components/opportunity/VibeAdvisorChat';
import { useLeadEmotionalMemory } from '@/hooks/useLeadEmotionalMemory';

interface SidebarIntelligenceSectionProps {
  opportunityId: string;
  opportunityTitle: string;
}

export function SidebarIntelligenceSection({ opportunityId, opportunityTitle }: SidebarIntelligenceSectionProps) {
  const { data: emotionalMemory } = useLeadEmotionalMemory(opportunityId);

  return (
    <Accordion type="single" collapsible defaultValue="intelligence">
      <AccordionItem value="intelligence" className="border-none">
        <AccordionTrigger className="bg-card border rounded-t-lg px-3 py-2 hover:no-underline [&[data-state=open]]:rounded-b-none">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4 text-purple-500" />
            <span>Inteligência do Deal</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-card border border-t-0 rounded-b-lg px-3 pb-3">
          <div className="space-y-3 pt-1">
            {/* Memória Emocional */}
            <div className="border rounded-md overflow-hidden">
              <LeadEmotionalMemoryCard opportunityId={opportunityId} />
            </div>

            {/* Narrativa Recomendada */}
            <div className="border rounded-md overflow-hidden">
              <VibeNarrativeCard vibeState={emotionalMemory?.last_emotional_state || undefined} />
            </div>

            {/* Alertas de Vibe */}
            <div className="border rounded-md overflow-hidden">
              <VibeAlertsCard opportunityId={opportunityId} />
            </div>

            {/* Conselheiro de Vibe */}
            <div className="border rounded-md overflow-hidden">
              <VibeAdvisorChat opportunityId={opportunityId} opportunityTitle={opportunityTitle} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
