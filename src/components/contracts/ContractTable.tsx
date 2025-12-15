import { Contract } from '@/services/crm/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Eye, Edit, Trash2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContractTableProps {
  contracts: Contract[];
  onView: (contract: Contract) => void;
  onEdit: (contract: Contract) => void;
  onDelete: (contractId: string) => void;
}

export function ContractTable({ contracts, onView, onEdit, onDelete }: ContractTableProps) {
  const getStatusBadge = (status: Contract['status']) => {
    const statusMap = {
      draft: { label: 'Rascunho', variant: 'outline' as const },
      pending: { label: 'Pendente', variant: 'secondary' as const },
      active: { label: 'Ativo', variant: 'default' as const },
      expiring: { label: 'Expirando', variant: 'destructive' as const },
      expired: { label: 'Expirado', variant: 'outline' as const },
      cancelled: { label: 'Cancelado', variant: 'destructive' as const },
      renewed: { label: 'Renovado', variant: 'default' as const },
    };
    const config = statusMap[status];
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTypeBadge = (type: Contract['type']) => {
    const typeMap = {
      monthly: 'Mensal',
      quarterly: 'Trimestral',
      annual: 'Anual',
      'one-time': 'Único',
    };
    return <Badge variant="outline">{typeMap[type]}</Badge>;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return format(date, 'dd/MM/yyyy', { locale: ptBR });
  };

  if (contracts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          Nenhum contrato encontrado
        </h3>
        <p className="text-sm text-muted-foreground">
          Ajuste os filtros ou crie um novo contrato
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Cliente</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Início</TableHead>
            <TableHead>Término</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow key={contract.id}>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium text-foreground">{contract.clientName}</span>
                  <span className="text-xs text-muted-foreground">{contract.clientDocument}</span>
                </div>
              </TableCell>
              <TableCell>{getStatusBadge(contract.status)}</TableCell>
              <TableCell>{getTypeBadge(contract.type)}</TableCell>
              <TableCell className="font-medium">{formatCurrency(contract.value)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(contract.startDate)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(contract.endDate)}</TableCell>
              <TableCell className="text-right">
                <div className="flex gap-2 justify-end">
                  <Button variant="ghost" size="icon" onClick={() => onView(contract)}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(contract)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(contract.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
