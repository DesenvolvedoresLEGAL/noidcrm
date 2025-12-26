import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Users, DollarSign, ArrowUpRight } from 'lucide-react';
import { useSeatMetrics } from '@/hooks/useSeatMetrics';

interface AddUserCostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  usersToAdd?: number;
  isLoading?: boolean;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export function AddUserCostModal({ 
  open, 
  onOpenChange, 
  onConfirm, 
  usersToAdd = 1,
  isLoading = false 
}: AddUserCostModalProps) {
  const { data: metrics } = useSeatMetrics();

  if (!metrics) return null;

  const { 
    active_seats, 
    mrr, 
    price_per_seat 
  } = metrics;

  const additionalCost = price_per_seat * usersToAdd;
  const newMrr = mrr + additionalCost;
  const newSeats = active_seats + usersToAdd;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Confirmar adição de {usersToAdd === 1 ? 'usuário' : 'usuários'}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                Adicionar {usersToAdd === 1 ? 'este usuário' : `${usersToAdd} usuários`} aumentará 
                seu custo mensal.
              </p>

              {/* Cost breakdown */}
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Custo atual</span>
                  <span className="font-medium">{formatCurrency(mrr)}/mês</span>
                </div>
                
                <div className="flex items-center justify-between text-green-600">
                  <span className="flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    Acréscimo ({usersToAdd} {usersToAdd === 1 ? 'usuário' : 'usuários'})
                  </span>
                  <span className="font-medium">+{formatCurrency(additionalCost)}/mês</span>
                </div>

                <div className="border-t pt-3 flex items-center justify-between">
                  <span className="font-medium">Novo custo mensal</span>
                  <span className="text-lg font-bold">{formatCurrency(newMrr)}/mês</span>
                </div>
              </div>

              {/* Seats info */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Usuários após adição</span>
                <Badge variant="outline" className="gap-1">
                  <Users className="h-3 w-3" />
                  {newSeats} usuários
                </Badge>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction 
            onClick={onConfirm} 
            disabled={isLoading}
            className="gap-2"
          >
            <DollarSign className="h-4 w-4" />
            {isLoading ? 'Processando...' : `Confirmar (+${formatCurrency(additionalCost)}/mês)`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
