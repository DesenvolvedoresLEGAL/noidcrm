import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCloserPilotEntrypoint } from '@/hooks/dashboard/useCloserPilotEntrypoint';
import { useDynamicDashboardRuntimeGate } from '@/hooks/dashboard/useDynamicDashboardRuntimeGate';

export function CloserPilotEntryButton() {
  const navigate = useNavigate();
  const { visible } = useCloserPilotEntrypoint();
  const gate = useDynamicDashboardRuntimeGate();

  // If the runtime gate is already substituting the home for this user,
  // hide the legacy opt-in (a session-return banner handles the inverse case).
  if (gate.isPilotEligible) return null;
  if (!visible) return null;

  return (
    <Card className="border-primary/40 bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 mt-0.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="font-semibold text-sm">Experimentar novo Dashboard Comercial</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nova visão com Central do Dia, pace diário, propostas e ações prioritárias.
              Você pode voltar ao dashboard atual a qualquer momento.
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={() =>
            navigate('/app/dynamic-dashboard', { state: { from: 'legacy_button' } })
          }
          className="gap-1 self-start md:self-auto"
        >
          Abrir agora
          <ArrowRight className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
