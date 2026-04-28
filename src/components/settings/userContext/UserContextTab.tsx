import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Loader2, Search, Edit, Info, AlertTriangle } from 'lucide-react';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  useUserContexts,
  useUserContextStats,
  useUserContextOptions,
  getReviewStatus,
  type ReviewStatus,
} from '@/hooks/userContext/useUserContextData';
import type { UserContextRow } from '@/services/crm/userContext';
import { UserContextStatsCards } from './UserContextStatsCards';
import { ReviewStatusBadge, PermissionBadge, DepartmentBadge } from './UserContextBadges';
import { EditUserContextModal } from './EditUserContextModal';

const REVIEW_FILTER: Array<{ value: 'all' | ReviewStatus; label: string }> = [
  { value: 'all', label: 'Todos' },
  { value: 'needs_review', label: 'Revisar' },
  { value: 'validated', label: 'Validado' },
  { value: 'incomplete', label: 'Incompleto' },
  { value: 'no_context', label: 'Sem contexto' },
];

function getInitials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

export default function UserContextTab() {
  const { data: currentUser, isLoading: loadingUser } = useCurrentUser();
  const tenantId = currentUser?.organization?.id ?? null;
  const organizationId = currentUser?.organization?.id ?? null;
  const isAdmin = !!currentUser?.isOrgAdmin;

  const { data: rows, isLoading, error } = useUserContexts(tenantId, organizationId);
  const { data: options } = useUserContextOptions(tenantId);
  const stats = useUserContextStats(rows);

  const [search, setSearch] = useState('');
  const [permFilter, setPermFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [funcFilter, setFuncFilter] = useState<string>('all');
  const [reviewFilter, setReviewFilter] = useState<'all' | ReviewStatus>('all');

  const [editing, setEditing] = useState<UserContextRow | null>(null);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const hay = `${r.full_name || ''} ${r.email || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (permFilter !== 'all' && r.permission_key !== permFilter) return false;
      if (deptFilter !== 'all' && r.department_key !== deptFilter) return false;
      if (funcFilter !== 'all' && r.business_function_key !== funcFilter) return false;
      if (reviewFilter !== 'all' && getReviewStatus(r) !== reviewFilter) return false;
      return true;
    });
  }, [rows, search, permFilter, deptFilter, funcFilter, reviewFilter]);

  if (loadingUser) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Apenas owners e administradores podem visualizar o contexto CRM dos usuários.
        </AlertDescription>
      </Alert>
    );
  }

  if (!tenantId || !organizationId) return null;

  return (
    <div className="space-y-4">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Esta tela prepara dashboards, automações e regras futuras. Ela <strong>não altera</strong> o acesso real dos
          usuários — a lógica atual de permissões continua ativa.
        </AlertDescription>
      </Alert>

      <UserContextStatsCards
        withContext={stats.withContext}
        needsReview={stats.needsReview}
        noContext={stats.noContext}
        incomplete={stats.incomplete}
      />

      <Card>
        <CardHeader>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="relative md:col-span-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={permFilter} onValueChange={setPermFilter}>
              <SelectTrigger><SelectValue placeholder="Permissão" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as permissões</SelectItem>
                {options?.permissions.map((p) => (
                  <SelectItem key={p.id} value={p.key}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger><SelectValue placeholder="Área" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as áreas</SelectItem>
                {options?.departments.map((d) => (
                  <SelectItem key={d.id} value={d.key}>{d.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={funcFilter} onValueChange={setFuncFilter}>
              <SelectTrigger><SelectValue placeholder="Função" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as funções</SelectItem>
                {options?.functions.map((f) => (
                  <SelectItem key={f.id} value={f.key}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {REVIEW_FILTER.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant={reviewFilter === r.value ? 'default' : 'outline'}
                onClick={() => setReviewFilter(r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {error ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não foi possível carregar o contexto CRM. A tela de Usuários continua funcionando normalmente.
              </AlertDescription>
            </Alert>
          ) : isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              {rows && rows.length === 0
                ? 'Nenhum contexto CRM encontrado. Execute o backfill ou crie contexto manualmente para os usuários.'
                : 'Nenhum usuário encontrado para os filtros aplicados.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Permissão</TableHead>
                    <TableHead className="hidden md:table-cell">Área</TableHead>
                    <TableHead>Função</TableHead>
                    <TableHead>Revisão</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((row) => {
                    const status = getReviewStatus(row);
                    return (
                      <TableRow key={row.user_id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback>{getInitials(row.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{row.full_name || 'Sem nome'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground">
                          {row.email || '—'}
                        </TableCell>
                        <TableCell>
                          <PermissionBadge permissionKey={row.permission_key} fallback={row.permission_name} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <DepartmentBadge departmentKey={row.department_key} fallback={row.department_name} />
                        </TableCell>
                        <TableCell>
                          {row.business_function_name || (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ReviewStatusBadge status={status} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditing(row)}
                            title={row.context_id ? 'Editar contexto' : 'Criar contexto'}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            {row.context_id ? 'Editar' : 'Criar'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <EditUserContextModal
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        row={editing}
        tenantId={tenantId}
        organizationId={organizationId}
        canEdit={isAdmin}
      />
    </div>
  );
}
