import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useDynamicDashboardRuntimeGate } from '@/hooks/dashboard/useDynamicDashboardRuntimeGate';

/**
 * Banner used inside the dynamic dashboard shell when rendered as the home gate.
 * Lets the pilot user opt back into the legacy dashboard for the current session.
 */
export function RuntimeGateSafeBanner() {
  const gate = useDynamicDashboardRuntimeGate();
  return (
    <Alert className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />
        <AlertDescription>
          <strong>Novo Dashboard Closer em piloto.</strong> Você está usando a nova home comercial.
          O dashboard antigo continua disponível a qualquer momento.
        </AlertDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => gate.setUseLegacyForSession(true)}
        className="self-start md:self-auto"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar ao dashboard atual
      </Button>
    </Alert>
  );
}
