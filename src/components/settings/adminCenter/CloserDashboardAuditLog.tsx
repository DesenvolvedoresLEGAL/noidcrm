import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Eye, Activity, Info } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCloserDashboardViews } from '@/hooks/dashboard/useCloserDashboardViews';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  tenantId: string;
}

export function CloserDashboardAuditLog({ tenantId }: Props) {
  const { data, isLoading, error } = useCloserDashboardViews(tenantId, 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4" />
          Auditoria — Closer Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Não foi possível carregar a auditoria.</AlertDescription>
          </Alert>
        ) : !data || data.length === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Nenhuma visualização do Closer Dashboard foi registrada ainda.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quem visualizou</TableHead>
                  <TableHead>Usuário visualizado</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead className="text-right">Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.viewer_name || '—'}</span>
                        <span className="text-xs text-muted-foreground">{row.viewer_email || row.viewer_user_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{row.target_name || '—'}</span>
                        <span className="text-xs text-muted-foreground">{row.target_email || row.target_user_id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {row.source === 'runtime' ? (
                        <Badge variant="default" className="gap-1">
                          <Activity className="h-3 w-3" />
                          Runtime
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <Eye className="h-3 w-3" />
                          Preview
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.period || '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatDistanceToNow(new Date(row.created_at), { addSuffix: true, locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
