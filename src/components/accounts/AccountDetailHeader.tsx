import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Pencil, Trash2, ArrowLeft, MoreVertical } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AccountDetails } from '@/hooks/useAccountDetails';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface AccountDetailHeaderProps {
  account: AccountDetails;
  onDelete: () => void;
}

export function AccountDetailHeader({ account, onDelete }: AccountDetailHeaderProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/app/accounts')}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar para Contas
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        {/* Company Info */}
        <div className="flex gap-4 flex-1">
          <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2 flex-1">
            <h1 className="text-2xl md:text-3xl font-black text-foreground">
              {account.nome_fantasia || account.razao_social}
            </h1>
            {account.nome_fantasia && (
              <p className="text-sm text-muted-foreground">
                {account.razao_social}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {account.cnpj && (
                <Badge variant="outline" className="font-mono">
                  {account.cnpj}
                </Badge>
              )}
              {account.segmento && (
                <Badge variant="secondary">
                  {account.segmento}
                </Badge>
              )}
              {account.tamanho && (
                <Badge>
                  {account.tamanho}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={() => navigate(`/app/accounts/${account.id}/edit`)}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Conta
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}
