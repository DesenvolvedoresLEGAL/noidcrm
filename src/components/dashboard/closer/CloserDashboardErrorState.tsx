import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export function CloserDashboardErrorState({ message }: { message?: string }) {
  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Não foi possível carregar o Dashboard Comercial</AlertTitle>
      <AlertDescription>
        O dashboard atual do CRM permanece seguro. {message ? `Detalhe: ${message}` : ''}
      </AlertDescription>
    </Alert>
  );
}
