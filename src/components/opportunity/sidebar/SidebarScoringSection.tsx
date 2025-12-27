import { Gauge, Shield, AlertTriangle } from 'lucide-react';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { InfoCard } from '../InfoCard';
import { OpportunityScoreCard } from '@/components/scoring/OpportunityScoreCard';
import { DealGapsCard } from '@/components/graph/DealGapsCard';
import { NRHSSidebarCard } from '@/components/nrhs/NRHSSidebarCard';
import { useOpportunityScoring } from '@/hooks/useOpportunityScoring';

interface SidebarScoringSectionProps {
  opportunity: any;
  onUpdateField: (field: string, value: any) => Promise<void>;
}

export function SidebarScoringSection({ opportunity, onUpdateField }: SidebarScoringSectionProps) {
  const { scoring, recalculate, isRecalculating } = useOpportunityScoring(opportunity.id);

  return (
    <Accordion type="single" collapsible defaultValue="scoring">
      <AccordionItem value="scoring" className="border-none">
        <AccordionTrigger className="bg-card border rounded-t-lg px-3 py-2 hover:no-underline [&[data-state=open]]:rounded-b-none">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Gauge className="h-4 w-4 text-primary" />
            <span>Pontuação e Saúde</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="bg-card border border-t-0 rounded-b-lg px-3 pb-3">
          <div className="space-y-3 pt-1">
            {/* Score */}
            <div className="border rounded-md p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <Gauge className="h-3 w-3" />
                Score
              </div>
              <OpportunityScoreCard
                opportunityId={opportunity.id}
                opportunityName={opportunity.title}
                opportunityScore={scoring?.opportunity_score ?? opportunity.opportunity_score}
                engagementScore={scoring?.engagement_score ?? opportunity.engagement_score}
                velocityScore={scoring?.velocity_score ?? opportunity.velocity_score}
                riskScore={scoring?.risk_score ?? opportunity.risk_score}
                winProbabilityAi={scoring?.win_probability_ai ?? opportunity.win_probability_ai}
                scoringFactors={scoring?.scoring_factors ?? opportunity.scoring_factors}
                variant="compact"
                onRecalculate={recalculate}
                isRecalculating={isRecalculating}
              />
            </div>

            {/* NRHS */}
            {opportunity.organization_id && (
              <div className="border rounded-md p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                  <Shield className="h-3 w-3" />
                  Revenue Hygiene
                </div>
                <NRHSSidebarCard
                  opportunityId={opportunity.id}
                  organizationId={opportunity.organization_id}
                  onFixField={onUpdateField}
                />
              </div>
            )}

            {/* Deal Gaps */}
            <div className="border rounded-md p-3">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground mb-2">
                <AlertTriangle className="h-3 w-3" />
                Lacunas
              </div>
              <DealGapsCard opportunityId={opportunity.id} />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
