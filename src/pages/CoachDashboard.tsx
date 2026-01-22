import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isToday, isTomorrow, startOfMonth, endOfMonth } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  Waves,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HEBREW_DAYS } from '@/lib/session-generator';
import { SessionMode } from '@/components/coach/SessionMode';

const DEFAULT_HOURLY_RATE = 150; // Default rate if not set in coach_rates

export default function CoachDashboard() {
  const { user } = useAuth();
  const [selectedSession, setSelectedSession] = useState<any>(null);

  // Fetch today's sessions for this coach
  const { data: todaySessions = [], isLoading } = useQuery({
    queryKey: ['coach-sessions', user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await (supabase
        .from('sessions' as any)
        .select(`
          *,
          class_type:class_types(name, duration_min),
          resource:resources(name, location:locations(name)),
          enrollments:enrollments(
            id,
            swimmer:swimmers(id, first_name, last_name, medical_notes, skill_level),
            status
          )
        `)
        .eq('coach_id', user?.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .neq('status', 'cancelled')
        .order('start_time') as any);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch upcoming sessions (next 7 days)
  const { data: upcomingSessions = [] } = useQuery({
    queryKey: ['coach-upcoming-sessions', user?.id],
    queryFn: async () => {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(tomorrow);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data, error } = await (supabase
        .from('sessions' as any)
        .select(`
          *,
          class_type:class_types(name),
          resource:resources(name)
        `)
        .eq('coach_id', user?.id)
        .gte('start_time', tomorrow.toISOString())
        .lt('start_time', nextWeek.toISOString())
        .neq('status', 'cancelled')
        .order('start_time')
        .limit(5) as any);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch monthly completed sessions for salary calculation
  const { data: monthlyStats } = useQuery({
    queryKey: ['coach-monthly-stats', user?.id],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      // Get completed sessions this month
      const { data: sessions, error: sessionsError } = await (supabase
        .from('sessions' as any)
        .select(`
          id,
          start_time,
          end_time,
          status,
          class_type:class_types(duration_min)
        `)
        .eq('coach_id', user?.id)
        .eq('status', 'completed')
        .gte('start_time', monthStart.toISOString())
        .lte('start_time', monthEnd.toISOString()) as any);

      if (sessionsError) throw sessionsError;

      // Get coach's rate (if set)
      const { data: rateData } = await (supabase
        .from('coach_rates' as any)
        .select('rate_per_hour')
        .eq('coach_id', user?.id)
        .lte('effective_from', new Date().toISOString().split('T')[0])
        .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().split('T')[0]}`)
        .order('effective_from', { ascending: false })
        .limit(1) as any);

      const hourlyRate = rateData?.[0]?.rate_per_hour || DEFAULT_HOURLY_RATE;

      // Calculate total hours
      let totalMinutes = 0;
      sessions?.forEach((session: any) => {
        const duration = session.class_type?.duration_min || 45;
        totalMinutes += duration;
      });

      const totalHours = totalMinutes / 60;
      const estimatedSalary = Math.round(totalHours * hourlyRate);

      return {
        completedSessions: sessions?.length || 0,
        totalHours: totalHours.toFixed(1),
        hourlyRate,
        estimatedSalary,
      };
    },
    enabled: !!user?.id,
  });

  const getSessionStatus = (session: any) => {
    const now = new Date();
    const start = new Date(session.start_time);
    const end = new Date(session.end_time);

    if (session.status === 'completed') return { label: 'הושלם', color: 'bg-green-500' };
    if (now >= start && now <= end) return { label: 'בתהליך', color: 'bg-yellow-500' };
    if (now < start) return { label: 'ממתין', color: 'bg-blue-500' };
    return { label: 'עבר', color: 'bg-muted' };
  };

  const formatSessionTime = (startTime: string, endTime: string) => {
    return `${format(new Date(startTime), 'HH:mm')} - ${format(new Date(endTime), 'HH:mm')}`;
  };

  if (selectedSession) {
    return (
      <SessionMode
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20" dir="rtl">
      {/* Mobile Header */}
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Waves className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold">המשמרת שלי</h1>
              <p className="text-sm opacity-80">
                יום {HEBREW_DAYS[new Date().getDay()]} - {format(new Date(), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {todaySessions.length} שיעורים
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Salary Preview Widget */}
        <section>
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                דוח שכר החודש
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">שיעורים שהושלמו</p>
                  <p className="text-2xl font-bold text-primary">
                    {monthlyStats?.completedSessions || 0}
                  </p>
                </div>
                <div className="text-center p-3 bg-background/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">סה"כ שעות</p>
                  <p className="text-2xl font-bold text-primary">
                    {monthlyStats?.totalHours || '0'}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-primary/10 rounded-lg text-center">
                <p className="text-sm text-muted-foreground mb-1">שכר משוער החודש</p>
                <p className="text-3xl font-bold text-primary flex items-center justify-center gap-1">
                  ₪{monthlyStats?.estimatedSalary?.toLocaleString() || 0}
                  <TrendingUp className="h-5 w-5" />
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  (₪{monthlyStats?.hourlyRate || DEFAULT_HOURLY_RATE} לשעה)
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Today's Sessions */}
        <section>
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            שיעורים להיום
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-24" />
                </Card>
              ))}
            </div>
          ) : todaySessions.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mb-3" />
                <p className="text-muted-foreground">אין שיעורים מתוכננים להיום</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {todaySessions.map((session: any) => {
                const status = getSessionStatus(session);
                const enrolledCount = session.enrollments?.filter(
                  (e: any) => e.status !== 'cancelled'
                ).length || 0;

                return (
                  <Card
                    key={session.id}
                    className={cn(
                      'cursor-pointer transition-all active:scale-[0.98]',
                      status.label === 'בתהליך' && 'ring-2 ring-yellow-500'
                    )}
                    onClick={() => setSelectedSession(session)}
                  >
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-bold text-lg">
                            {session.class_type?.name || 'שיעור שחייה'}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="h-4 w-4" />
                            {formatSessionTime(session.start_time, session.end_time)}
                          </div>
                        </div>
                        <Badge className={cn('text-white', status.color)}>
                          {status.label}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {session.resource?.name}
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-medium">{enrolledCount} רשומים</span>
                        </div>
                      </div>

                      <Button
                        className="w-full mt-3 gap-2"
                        size="lg"
                      >
                        כניסה לשיעור
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Upcoming Sessions */}
        {upcomingSessions.length > 0 && (
          <section>
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              שיעורים קרובים
            </h2>

            <div className="space-y-2">
              {upcomingSessions.map((session: any) => {
                const sessionDate = new Date(session.start_time);
                const dayLabel = isTomorrow(sessionDate)
                  ? 'מחר'
                  : `יום ${HEBREW_DAYS[sessionDate.getDay()]}`;

                return (
                  <Card key={session.id} className="bg-muted/50">
                    <CardContent className="p-3 flex justify-between items-center">
                      <div>
                        <p className="font-medium">{session.class_type?.name || 'שיעור'}</p>
                        <p className="text-sm text-muted-foreground">
                          {dayLabel} - {format(sessionDate, 'HH:mm')}
                        </p>
                      </div>
                      <Badge variant="outline">{session.resource?.name}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
