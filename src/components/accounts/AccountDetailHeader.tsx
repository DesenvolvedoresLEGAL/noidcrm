import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Pencil, Trash2, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AccountDetails } from '@/hooks/useAccountDetails';

interface AccountDetailHeaderProps {
  account: AccountDetails;
  onEdit: () => void;
  onDelete: () => void;
}

export function AccountDetailHeader({ account, onEdit, onDelete }: AccountDetailHeaderProps) {
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

      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex gap-4">
          <div className="h-16 w-16 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2">
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

        <div className="flex gap-2">
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Editar
          </Button>
          <Button variant="destructive" onClick={onDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Excluir
          </Button>
        </div>
      </div>
    </div>
  );
}
