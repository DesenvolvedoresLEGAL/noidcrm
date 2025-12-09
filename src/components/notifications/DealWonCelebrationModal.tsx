import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, FileText, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import type { Notification } from '@/services/crm/notifications';

interface DealWonCelebrationModalProps {
  notification: Notification | null;
  open: boolean;
  onClose: () => void;
}

export function DealWonCelebrationModal({ notification, open, onClose }: DealWonCelebrationModalProps) {
  const navigate = useNavigate();
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  useEffect(() => {
    if (open && !hasTriggeredConfetti) {
      // Trigger confetti animation
      const duration = 3000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 9999 };

      const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          clearInterval(interval);
          return;
        }

        const particleCount = 50 * (timeLeft / duration);

        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
          colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
        });
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
          colors: ['#4D2BFB', '#03F9FF', '#FFD700', '#FF6B6B', '#4ECDC4'],
        });
      }, 250);

      setHasTriggeredConfetti(true);

      return () => clearInterval(interval);
    }
  }, [open, hasTriggeredConfetti]);

  // Reset confetti trigger when modal closes
  useEffect(() => {
    if (!open) {
      setHasTriggeredConfetti(false);
    }
  }, [open]);

  if (!notification) return null;

  const metadata = notification.metadata as {
    proposal_id?: string;
    opportunity_id?: string;
    cs_opportunity_id?: string;
    contract_id?: string;
    acceptor_name?: string;
    value?: number;
    account_name?: string;
    role?: string;
  };

  const formattedValue = metadata.value
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.value)
    : null;

  const getRoleMessage = () => {
    switch (metadata.role) {
      case 'seller':
        return 'Parabéns! Você fechou mais um negócio!';
      case 'manager':
        return 'Um membro do seu time fechou negócio!';
      case 'finance':
        return 'Novo contrato pronto para faturamento!';
      case 'cs':
        return 'Nova conta chegou para onboarding!';
      case 'owner':
      case 'admin':
        return 'Mais um negócio fechado na sua organização!';
      default:
        return 'Negócio fechado com sucesso!';
    }
  };

  const handleViewOpportunity = () => {
    if (metadata.opportunity_id) {
      navigate(`/app/opportunities/${metadata.opportunity_id}`);
      onClose();
    }
  };

  const handleViewContract = () => {
    if (metadata.contract_id) {
      navigate(`/app/contracts/${metadata.contract_id}`);
      onClose();
    }
  };

  const handleViewCsOpportunity = () => {
    if (metadata.cs_opportunity_id) {
      navigate(`/app/opportunities/${metadata.cs_opportunity_id}`);
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="sm:max-w-md border-0 bg-gradient-to-br from-primary/10 via-background to-secondary/10 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </button>

        <div className="flex flex-col items-center text-center py-6">
          {/* Trophy Animation */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-2xl animate-pulse" />
            <div className="relative bg-gradient-to-br from-yellow-400 to-yellow-600 p-4 rounded-full shadow-lg">
              <Trophy className="h-12 w-12 text-white" />
            </div>
          </div>

          {/* Title */}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {notification.title}
          </h2>

          {/* Role-specific message */}
          <p className="text-muted-foreground mb-4">
            {getRoleMessage()}
          </p>

          {/* Deal Info Card */}
          <div className="w-full bg-card border rounded-lg p-4 mb-6 space-y-2">
            {metadata.account_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-medium">{metadata.account_name}</span>
              </div>
            )}
            {metadata.acceptor_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aprovado por</span>
                <span className="font-medium">{metadata.acceptor_name}</span>
              </div>
            )}
            {formattedValue && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-bold text-primary text-lg">{formattedValue}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-2">
            {metadata.opportunity_id && (
              <Button onClick={handleViewOpportunity} className="w-full">
                <ArrowRight className="h-4 w-4 mr-2" />
                Ver Oportunidade
              </Button>
            )}
            
            {metadata.contract_id && (
              <Button onClick={handleViewContract} variant="outline" className="w-full">
                <FileText className="h-4 w-4 mr-2" />
                Ver Contrato
              </Button>
            )}

            {metadata.cs_opportunity_id && metadata.role === 'cs' && (
              <Button onClick={handleViewCsOpportunity} variant="secondary" className="w-full">
                <ArrowRight className="h-4 w-4 mr-2" />
                Iniciar Onboarding
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
