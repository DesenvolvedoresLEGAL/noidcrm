import { Activity } from '@/services/crm/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActivityTypeIcon } from './ActivityTypeIcon';
import { ActivityStatusBadge } from './ActivityStatusBadge';
import { Check, X, Pencil, Trash2, Clock, Mail, Calendar, ExternalLink } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ActivityCardProps {
  activity: Activity;
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (id: string) => void;
}

export function ActivityCard({ activity, onComplete, onNoShow, onEdit, onDelete }: ActivityCardProps) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      return format(parseISO(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="mt-1">
            <ActivityTypeIcon type={activity.type} className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm leading-tight">{activity.title}</h3>
                {activity.sync_source && activity.sync_source !== 'manual' && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {activity.sync_source === 'email' && <Mail className="h-3 w-3 mr-1" />}
                    {activity.sync_source === 'calendar' && <Calendar className="h-3 w-3 mr-1" />}
                    {activity.sync_provider}
                  </Badge>
                )}
              </div>
              <ActivityStatusBadge status={activity.status} />
            </div>
            {activity.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">{activity.description}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{formatDate(activity.scheduled_date)}</span>
              {activity.external_link && (
                <a 
                  href={activity.external_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="ml-auto flex items-center gap-1 hover:text-primary transition-colors"
                >
                  Ver original <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
            <div className="flex items-center gap-1 pt-2">
              {activity.status === 'pending' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => onComplete(activity.id)}
                  >
                    <Check className="h-3 w-3 mr-1" />
                    Concluir
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                    onClick={() => onNoShow(activity.id)}
                  >
                    <X className="h-3 w-3 mr-1" />
                    No-show
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-7"
                onClick={() => onEdit(activity)}
              >
                <Pencil className="h-3 w-3 mr-1" />
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDelete(activity.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
