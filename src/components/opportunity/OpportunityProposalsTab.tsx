import { ProposalsList } from '@/components/proposals/ProposalsList';

interface OpportunityProposalsTabProps {
  opportunityId: string;
}

export function OpportunityProposalsTab({ opportunityId }: OpportunityProposalsTabProps) {
  return (
    <div className="space-y-4">
      <ProposalsList opportunityId={opportunityId} />
    </div>
  );
}
