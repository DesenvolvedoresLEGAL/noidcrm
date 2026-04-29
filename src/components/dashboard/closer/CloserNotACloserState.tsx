import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info } from 'lucide-react';

export function CloserNotACloserState() {
  return (
    <Alert>
      <Info className="h-4 w-4" />
      <AlertTitle>Dashboard Comercial indisponível</AlertTitle>
      <AlertDescription>
        O Dashboard Comercial é carregado para usuários cuja função técnica no Contexto CRM é{' '}
        <strong>Closer</strong> (responsável por fechamento). Ajuste o Contexto CRM deste usuário
        para habilitá-lo.
      </AlertDescription>
    </Alert>
  );
}
