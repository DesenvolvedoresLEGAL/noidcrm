import { useState } from 'react';
import { Activity } from '@/services/crm/types';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ActivityCard } from './ActivityCard';
import { parseISO, format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ActivityCalendarProps {
  activities: Activity[];
  onComplete: (id: string) => void;
  onNoShow: (id: string) => void;
  onEdit: (activity: Activity) => void;
  onDelete: (id: string) => void;
}

export function ActivityCalendar({ activities, onComplete, onNoShow, onEdit, onDelete }: ActivityCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const getActivitiesForDate = (date: Date) => {
    return activities.filter(activity => {
      if (!activity.scheduled_date) return false;
      try {
        return isSameDay(parseISO(activity.scheduled_date), date);
      } catch {
        return false;
      }
    });
  };

  const selectedActivities = getActivitiesForDate(selectedDate);

  const getDayActivitiesCount = (date: Date) => {
    return getActivitiesForDate(date).length;
  };

  const hasOverdue = (date: Date) => {
    return getActivitiesForDate(date).some(
      a => a.status === 'pending' && parseISO(a.scheduled_date!) < new Date()
    );
  };

  return (
    <div className="grid lg:grid-cols-[350px_1fr] gap-6 animate-fade-in">
      <Card>
        <CardHeader>
          <CardTitle>Calendário</CardTitle>
        </CardHeader>
        <CardContent>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={(date) => date && setSelectedDate(date)}
            locale={ptBR}
            className={cn("rounded-md border pointer-events-auto")}
            modifiers={{
              hasActivities: (date) => getDayActivitiesCount(date) > 0,
              hasOverdue: (date) => hasOverdue(date),
            }}
            modifiersClassNames={{
              hasActivities: 'bg-primary/10 font-bold',
              hasOverdue: 'bg-red-100 text-red-900',
            }}
          />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-primary/10 border" />
              <span className="text-muted-foreground">Com atividades</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border" />
              <span className="text-muted-foreground">Com atrasadas</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>
              {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </CardTitle>
            <Badge variant="secondary">
              {selectedActivities.length} {selectedActivities.length === 1 ? 'atividade' : 'atividades'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {selectedActivities.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Nenhuma atividade agendada para este dia
            </div>
          ) : (
            <div className="space-y-3">
              {selectedActivities
                .sort((a, b) => {
                  const timeA = a.scheduled_time || '00:00';
                  const timeB = b.scheduled_time || '00:00';
                  return timeA.localeCompare(timeB);
                })
                .map((activity) => (
                  <ActivityCard
                    key={activity.id}
                    activity={activity}
                    onComplete={onComplete}
                    onNoShow={onNoShow}
                    onEdit={onEdit}
                    onDelete={onDelete}
                  />
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
