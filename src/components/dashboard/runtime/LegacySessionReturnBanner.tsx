import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { useDynamicDashboardRuntimeGate } from '@/hooks/dashboard/useDynamicDashboardRuntimeGate';

/**
 * Shown above the legacy dashboard ONLY when the user is a pilot-eligible Closer
 * who voluntarily switched to legacy mode for the current session.
 */
export function LegacySessionReturnBanner() {
  const gate = useDynamicDashboardRuntimeGate();

  if (!gate.isPilotEligible) return null;
  if (!gate.useLegacyForSession) return null;

  return (
    <Alert className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 mt-0.5 text-primary" />
        <AlertDescription>
          <strong>Você está no dashboard atual.</strong> A nova home comercial está disponível
          quando quiser voltar.
        </AlertDescription>
      </div>
      <Button
        size="sm"
        onClick={() => gate.setUseLegacyForSession(false)}
        className="self-start md:self-auto"
      >
        Abrir novo Dashboard Closer
      </Button>
    </Alert>
  );
}
