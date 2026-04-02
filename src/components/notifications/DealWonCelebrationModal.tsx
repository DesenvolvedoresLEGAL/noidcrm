import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Trophy, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/services/crm/notifications';

interface DealWonCelebrationModalProps {
  notification: Notification | null;
  open: boolean;
  onClose: () => void;
}

export function DealWonCelebrationModal({ notification, open, onClose }: DealWonCelebrationModalProps) {
  const navigate = useNavigate();

  if (!notification) return null;

  const metadata = notification.metadata as {
    proposal_id?: string;
    opportunity_id?: string;
    cs_opportunity_id?: string;
    contract_id?: string;
    acceptor_name?: string;
    seller_name?: string;
    value?: number;
    account_name?: string;
    role?: string;
  };

  const formattedValue = metadata.value
    ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.value)
    : null;

  const handleViewOpportunity = () => {
    if (metadata.opportunity_id) {
      navigate(`/app/opportunities/${metadata.opportunity_id}`);
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
            🎉 Negócio Fechado!
          </h2>

          {/* Deal Info Card */}
          <div className="w-full bg-card border rounded-lg p-4 mb-6 space-y-3">
            {metadata.seller_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Vendedor</span>
                <span className="font-semibold">{metadata.seller_name}</span>
              </div>
            )}
            {metadata.account_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente</span>
                <span className="font-semibold">{metadata.account_name}</span>
              </div>
            )}
            {metadata.acceptor_name && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Aprovado por</span>
                <span className="font-medium">{metadata.acceptor_name}</span>
              </div>
            )}
            {formattedValue && (
              <div className="flex justify-between items-center text-sm pt-2 border-t">
                <span className="text-muted-foreground">Valor</span>
                <span className="font-bold text-primary text-lg">{formattedValue}</span>
              </div>
            )}
          </div>

          {/* Action Button */}
          {metadata.opportunity_id && (
            <Button onClick={handleViewOpportunity} className="w-full">
              <ArrowRight className="h-4 w-4 mr-2" />
              Ver Oportunidade
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
