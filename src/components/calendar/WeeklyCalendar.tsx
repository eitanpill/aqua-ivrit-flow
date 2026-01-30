import { useMemo } from 'react';
import { format, startOfWeek, addDays, isSameDay } from 'date-fns';
import { cn } from '@/lib/utils';
import { HEBREW_DAYS, getStatusColor, SESSION_STATUS_HEBREW } from '@/lib/session-generator';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useIsMobile } from '@/hooks/use-mobile';
import { Card, CardContent } from '@/components/ui/card';

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  class_type?: { name: string } | null;
  coach?: { first_name: string | null; last_name: string | null } | null;
  resource?: { name: string } | null;
}

interface WeeklyCalendarProps {
  currentDate: Date;
  sessions: Session[];
  onSessionClick: (session: Session) => void;
}

// Generate time slots from 6:00 to 22:00
const TIME_SLOTS = Array.from({ length: 17 }, (_, i) => {
  const hour = i + 6;
  return `${hour.toString().padStart(2, '0')}:00`;
});

export function WeeklyCalendar({
  currentDate,
  sessions,
  onSessionClick,
}: WeeklyCalendarProps) {
  const isMobile = useIsMobile();
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Group sessions by day
  const sessionsByDay = useMemo(() => {
    const grouped: Record<string, Session[]> = {};
    weekDays.forEach((day) => {
      const dayKey = format(day, 'yyyy-MM-dd');
      grouped[dayKey] = sessions.filter((session) =>
        isSameDay(new Date(session.start_time), day)
      );
    });
    return grouped;
  }, [sessions, weekDays]);

  const getSessionPosition = (session: Session) => {
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (startHour - 6) * 60; // 60px per hour, starting from 6:00
    const height = (endHour - startHour) * 60;
    return { top, height: Math.max(height, 30) };
  };

  // Mobile: Show sessions as a list view
  if (isMobile) {
    return (
      <div className="space-y-4">
        {weekDays.map((day, dayIndex) => {
          const dayKey = format(day, 'yyyy-MM-dd');
          const daySessions = sessionsByDay[dayKey] || [];
          const isToday = isSameDay(day, new Date());
          
          if (daySessions.length === 0) return null;

          return (
            <Card key={dayIndex} className={cn(isToday && 'ring-2 ring-primary')}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{HEBREW_DAYS[dayIndex]}</span>
                  <span className="text-sm text-muted-foreground">
                    {format(day, 'dd/MM')}
                  </span>
                  {isToday && (
                    <Badge variant="default" className="text-xs">היום</Badge>
                  )}
                </div>
                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const coachName = session.coach
                      ? `${session.coach.first_name || ''} ${session.coach.last_name || ''}`.trim()
                      : '';
                    
                    return (
                      <div
                        key={session.id}
                        onClick={() => onSessionClick(session)}
                        className={cn(
                          'p-3 rounded-lg cursor-pointer transition-colors',
                          session.status === 'cancelled'
                            ? 'bg-muted text-muted-foreground'
                            : 'bg-primary/10 hover:bg-primary/20 border-r-4 border-primary'
                        )}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium">
                              {session.class_type?.name || 'שיעור'}
                            </div>
                            {coachName && (
                              <div className="text-sm text-muted-foreground">
                                {coachName}
                              </div>
                            )}
                            {session.resource && (
                              <div className="text-sm text-muted-foreground">
                                {session.resource.name}
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-medium">
                            {format(new Date(session.start_time), 'HH:mm')} - {format(new Date(session.end_time), 'HH:mm')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {sessions.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              אין שיעורים בשבוע זה
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Desktop: Original grid view
  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      {/* Header with day names */}
      <div className="grid grid-cols-8 border-b bg-muted/50">
        <div className="p-3 text-center text-sm font-medium text-muted-foreground border-l">
          שעה
        </div>
        {weekDays.map((day, index) => (
          <div
            key={index}
            className={cn(
              'p-3 text-center border-l last:border-l-0',
              isSameDay(day, new Date()) && 'bg-primary/10'
            )}
          >
            <div className="font-medium text-sm">{HEBREW_DAYS[index]}</div>
            <div className="text-xs text-muted-foreground">
              {format(day, 'dd/MM')}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <ScrollArea className="h-[600px]">
        <div className="grid grid-cols-8 relative">
          {/* Time column */}
          <div className="border-l">
            {TIME_SLOTS.map((time) => (
              <div
                key={time}
                className="h-[60px] border-b text-xs text-muted-foreground flex items-start justify-center pt-1"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekDays.map((day, dayIndex) => {
            const dayKey = format(day, 'yyyy-MM-dd');
            const daySessions = sessionsByDay[dayKey] || [];

            return (
              <div
                key={dayIndex}
                className={cn(
                  'border-l last:border-l-0 relative',
                  isSameDay(day, new Date()) && 'bg-primary/5'
                )}
              >
                {/* Time slot backgrounds */}
                {TIME_SLOTS.map((time) => (
                  <div key={time} className="h-[60px] border-b" />
                ))}

                {/* Sessions */}
                {daySessions.map((session) => {
                  const { top, height } = getSessionPosition(session);
                  const coachName = session.coach
                    ? `${session.coach.first_name || ''} ${session.coach.last_name || ''}`.trim()
                    : '';

                  return (
                    <div
                      key={session.id}
                      onClick={() => onSessionClick(session)}
                      className={cn(
                        'absolute inset-x-1 rounded-md p-1 cursor-pointer transition-all hover:ring-2 hover:ring-primary',
                        session.status === 'cancelled'
                          ? 'bg-muted/80 text-muted-foreground'
                          : 'bg-primary/20 border-r-2 border-primary'
                      )}
                      style={{ top: `${top}px`, height: `${height}px` }}
                    >
                      <div className="text-xs font-medium truncate">
                        {session.class_type?.name || 'שיעור'}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {format(new Date(session.start_time), 'HH:mm')}
                      </div>
                      {height > 40 && coachName && (
                        <div className="text-xs text-muted-foreground truncate">
                          {coachName}
                        </div>
                      )}
                      {height > 55 && session.resource && (
                        <div className="text-xs text-muted-foreground truncate">
                          {session.resource.name}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
