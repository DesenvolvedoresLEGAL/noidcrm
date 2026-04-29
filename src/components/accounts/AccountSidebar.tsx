import { LeadScoreCard } from '@/components/scoring/LeadScoreCard';
import { AccountLeadScoreAIPanel } from '@/components/scoring/lead/AccountLeadScoreAIPanel';
import { AccountDetails } from '@/hooks/useAccountDetails';
import { useAccountScoring } from '@/hooks/useAccountScoring';
import { useLeadScoreRealtime } from '@/hooks/scoring/useLeadScoreRealtime';
import { Loader2 } from 'lucide-react';

interface AccountSidebarProps {
  account: AccountDetails;
}

export function AccountSidebar({ account }: AccountSidebarProps) {
  const { scoring, recalculate, isRecalculating } = useAccountScoring(account.id);
  // Sprint Scoring 1.1 — propagate live lead-score updates without hard refresh.
  useLeadScoreRealtime(account.id, account.organization_id);

  return (
    <div className="space-y-4">
      {isRecalculating && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Atualizando score…
        </div>
      )}
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
      <AccountLeadScoreAIPanel accountId={account.id} />
    </div>
  );
}
