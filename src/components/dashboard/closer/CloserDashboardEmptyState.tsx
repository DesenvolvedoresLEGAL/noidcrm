import { Alert, AlertDescription } from '@/components/ui/alert';
import { Inbox } from 'lucide-react';

export function CloserDashboardEmptyState() {
  return (
    <Alert>
      <Inbox className="h-4 w-4" />
      <AlertDescription>
        Nenhuma oportunidade encontrada para este período.
      </AlertDescription>
    </Alert>
  );
}
