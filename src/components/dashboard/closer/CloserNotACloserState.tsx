import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function CloserNotACloserState() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Dashboard exclusivo para Closer</AlertTitle>
      <AlertDescription>
        Este dashboard é exclusivo para usuários com função Closer. O usuário selecionado tem outra
        função no contexto do CRM.
      </AlertDescription>
    </Alert>
  );
}
