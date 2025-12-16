import { useState } from 'react';
import { usePlaybookVersions, useRollbackPlaybook } from '@/hooks/usePlaybookSystem';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { formatCurrencyFull } from '@/lib/i18n';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface PlaybookVersionHistoryProps {
  playbookId: string | null;
  currentVersionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaybookVersionHistory({ 
  playbookId, 
  currentVersionId, 
  open, 
  onOpenChange 
}: PlaybookVersionHistoryProps) {
  const { data: versions, isLoading } = usePlaybookVersions(playbookId);
  const rollbackMutation = useRollbackPlaybook();
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  const handleRollback = (versionId: string) => {
    if (!playbookId) return;
    
    rollbackMutation.mutate({
      playbookId,
      targetVersionId: versionId,
      reason: 'Rollback manual pelo usuário',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Histórico de Versões</DialogTitle>
          <DialogDescription>
            Visualize e compare versões do playbook. Faça rollback se necessário.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !versions?.length ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhuma versão encontrada. Deploy uma versão para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Versão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Deploy</TableHead>
                <TableHead className="text-right">Execuções</TableHead>
                <TableHead className="text-right">Conversão</TableHead>
                <TableHead className="text-right">ROI</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {versions.map((version) => (
                <TableRow 
                  key={version.id}
                  className={cn(
                    version.id === currentVersionId && "bg-primary/5"
                  )}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {version.id === currentVersionId && (
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                      )}
                      <div>
                        <div className="font-medium">{version.version_label || `v${version.version_number}`}</div>
                        <div className="text-xs text-muted-foreground">{version.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge 
                      variant={
                        version.status === 'active' ? 'default' : 
                        version.status === 'rolled_back' ? 'destructive' : 
                        'secondary'
                      }
                    >
                      {version.status === 'active' ? 'Ativa' : 
                       version.status === 'rolled_back' ? 'Rollback' : 
                       version.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {format(new Date(version.deployed_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {version.executions_count}
                  </TableCell>
                  <TableCell className="text-right">
                    {(version.conversion_rate || 0).toFixed(1)}%
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrencyFull(version.roi_score || 0)}
                  </TableCell>
                  <TableCell>
                    {version.id !== currentVersionId && version.status !== 'rolled_back' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRollback(version.id)}
                        disabled={rollbackMutation.isPending}
                      >
                        {rollbackMutation.isPending && selectedVersion === version.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCcw className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
