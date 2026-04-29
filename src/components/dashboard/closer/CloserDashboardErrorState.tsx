import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

export function CloserDashboardErrorState({ message }: { message?: string }) {
  // Mensagem segura — nunca expor stack trace cru.
  const safeDetail =
    message && message.length < 200 && !/at\s+\w+/.test(message) ? message : null;

  return (
    <Alert variant="destructive">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>Não foi possível carregar o Dashboard Comercial</AlertTitle>
      <AlertDescription>
        Abrimos o dashboard atual para manter sua operação.
        {safeDetail ? ` Detalhe: ${safeDetail}` : ''}
      </AlertDescription>
    </Alert>
  );
}
