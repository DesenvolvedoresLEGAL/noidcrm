import { Activity } from '@/services/crm/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ActivityTypeIcon } from './ActivityTypeIcon';
import { ActivityStatusBadge } from './ActivityStatusBadge';
import { Check, X, Pencil, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatDateBR } from '@/lib/dateUtils';

interface ActivityTableProps {
  activities: Activity[];
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (id: string) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: (ids: string[], select: boolean) => void;
}

export function ActivityTable({
  activities,
  onComplete,
  onNoShow,
  onEdit,
  onDelete,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ActivityTableProps) {
  const formatDate = (dateStr?: string) => {
    return formatDateBR(dateStr);
  };

  const formatTime = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const date = new Date(dateStr);
      return format(date, 'HH:mm', { locale: ptBR });
    } catch {
      return '-';
    }
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes}min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  };

  const selectionEnabled = !!selectedIds && !!onToggleSelect && !!onToggleSelectAll;
  const pageIds = activities.map((a) => a.id);
  const allOnPageSelected =
    selectionEnabled && pageIds.length > 0 && pageIds.every((id) => selectedIds!.has(id));
  const someOnPageSelected =
    selectionEnabled && pageIds.some((id) => selectedIds!.has(id)) && !allOnPageSelected;

  return (
    <div className="rounded-md border animate-fade-in">
      <Table>
        <TableHeader>
          <TableRow>
            {selectionEnabled && (
              <TableHead className="w-[40px]">
                <Checkbox
                  checked={allOnPageSelected ? true : someOnPageSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => onToggleSelectAll!(pageIds, !!checked)}
                  aria-label="Selecionar todos"
                />
              </TableHead>
            )}
            <TableHead className="w-[40px]">Tipo</TableHead>
            <TableHead>Título</TableHead>
            <TableHead className="hidden md:table-cell">Empresa</TableHead>
            <TableHead className="hidden lg:table-cell max-w-xs">Descrição</TableHead>
            <TableHead className="hidden lg:table-cell">Responsável</TableHead>
            <TableHead className="hidden xl:table-cell">Data</TableHead>
            <TableHead className="hidden xl:table-cell">Hora</TableHead>
            <TableHead className="hidden xl:table-cell">Duração</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities.length === 0 ? (
            <TableRow>
              <TableCell colSpan={selectionEnabled ? 11 : 10} className="text-center text-muted-foreground py-8">
                Nenhuma atividade encontrada
              </TableCell>
            </TableRow>
          ) : (
            activities.map((activity) => (
              <TableRow key={activity.id} data-state={selectedIds?.has(activity.id) ? 'selected' : undefined}>
                {selectionEnabled && (
                  <TableCell>
                    <Checkbox
                      checked={selectedIds!.has(activity.id)}
                      onCheckedChange={() => onToggleSelect!(activity.id)}
                      aria-label={`Selecionar ${activity.title}`}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <ActivityTypeIcon type={activity.type} />
                </TableCell>
                <TableCell className="font-medium">{activity.title}</TableCell>
                <TableCell className="hidden md:table-cell max-w-[200px] truncate" title={(activity as any).account_name || ''}>
                  {(activity as any).account_name || '-'}
                </TableCell>
                <TableCell className="hidden lg:table-cell max-w-xs truncate">
                  {activity.description || '-'}
                </TableCell>
                <TableCell className="hidden lg:table-cell">
                  {activity.owner_name || '-'}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {formatDate(activity.scheduled_date)}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {formatTime(activity.scheduled_date)}
                </TableCell>
                <TableCell className="hidden xl:table-cell">
                  {formatDuration(activity.duration_minutes)}
                </TableCell>
                <TableCell>
                  <ActivityStatusBadge status={activity.status} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {activity.status === 'pending' && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => onComplete(activity.id)}
                          title="Concluir"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => onNoShow(activity.id)}
                          title="No-show"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => onEdit(activity)}
                      title="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => onDelete(activity.id)}
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
