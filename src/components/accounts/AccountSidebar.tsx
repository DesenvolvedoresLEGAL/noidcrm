import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { AccountDetails } from '@/hooks/useAccountDetails';
import { useAccountScoring } from '@/hooks/useAccountScoring';

interface AccountSidebarProps {
  account: AccountDetails;
}

export function AccountSidebar({ account }: AccountSidebarProps) {
  const { scoring, recalculate, isRecalculating } = useAccountScoring(account.id);

  return (
    <div className="space-y-4">
      <LeadScoreCard
        accountId={account.id}
        accountName={account.nome_fantasia || account.razao_social}
        leadScore={scoring?.lead_score ?? account.lead_score}
        fitScore={scoring?.fit_score ?? account.fit_score}
        intentScore={scoring?.intent_score ?? account.intent_score}
        leadGrade={scoring?.lead_grade ?? account.lead_grade}
        scoringFactors={account.scoring_factors}
        variant="full"
        onRecalculate={recalculate}
        isRecalculating={isRecalculating}
        showRecommendations
      />
    </div>
  );
}
