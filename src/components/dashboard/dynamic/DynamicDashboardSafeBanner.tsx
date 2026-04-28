import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ShieldCheck, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DynamicDashboardSafeBanner() {
  const navigate = useNavigate();
  return (
    <Alert className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
      <div className="flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 mt-0.5 text-primary" />
        <AlertDescription>
          <strong>Dashboard dinâmico em teste.</strong> O dashboard legado continua disponível e
          permanece como sua experiência principal.
        </AlertDescription>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => navigate('/app/dashboard')}
        className="self-start md:self-auto"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Voltar ao dashboard atual
      </Button>
    </Alert>
  );
}
