import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, isTomorrow, startOfMonth, endOfMonth } from 'date-fns';
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  ChevronLeft,
  Waves,
  DollarSign,
  TrendingUp,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { HEBREW_DAYS } from '@/lib/session-generator';
import { SessionMode } from '@/components/coach/SessionMode';

const DEFAULT_HOURLY_RATE = 150;

export default function CoachDashboard() {
  const { user } = useAuth();
  const [selectedSession, setSelectedSession] = useState<any>(null);

  const { data: todaySessions = [], isLoading } = useQuery({
    queryKey: ['coach-sessions', user?.id],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data, error } = await supabase
        .from('sessions')
        .select(`
          *,
          class_type:class_types(name, duration_min),
          resource:resources(name, location:locations(name)),
          enrollments:enrollments(
            id,
            swimmer:swimmers(id, first_name, last_name, medical_notes, skill_level, parent:profiles(phone)),
            status
          )
        `)
        .eq('coach_id', user?.id)
        .gte('start_time', today.toISOString())
        .lt('start_time', tomorrow.toISOString())
        .neq('status', 'cancelled')
        .order('start_time');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: upcomingSessions = [] } = useQuery({
    queryKey: ['coach-upcoming-sessions', user?.id],
    queryFn: async () => {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const nextWeek = new Date(tomorrow);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const { data, error } = await supabase
        .from('sessions')
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
        .limit(5);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  const { data: monthlyStats } = useQuery({
    queryKey: ['coach-monthly-stats', user?.id],
    queryFn: async () => {
      const monthStart = startOfMonth(new Date());
      const monthEnd = endOfMonth(new Date());

      const { data: sessions, error: sessionsError } = await supabase
        .from('sessions')
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
        .lte('start_time', monthEnd.toISOString());

      if (sessionsError) throw sessionsError;

      const { data: rateData } = await supabase
        .from('coach_rates')
        .select('rate_per_hour')
        .eq('coach_id', user?.id)
        .lte('effective_from', new Date().toISOString().split('T')[0])
        .or(`effective_to.is.null,effective_to.gte.${new Date().toISOString().split('T')[0]}`)
        .order('effective_from', { ascending: false })
        .limit(1);

      const hourlyRate = rateData?.[0]?.rate_per_hour || DEFAULT_HOURLY_RATE;

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

    if (session.status === 'completed') return { label: 'הושלם', color: 'bg-success', glow: false };
    if (now >= start && now <= end) return { label: 'בתהליך', color: 'bg-warning', glow: true };
    if (now < start) return { label: 'ממתין', color: 'bg-primary', glow: false };
    return { label: 'עבר', color: 'bg-muted', glow: false };
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
    <div className="min-h-screen pb-20" dir="rtl">
      {/* Premium Header */}
      <div className="sticky top-0 z-10 header-premium text-primary-foreground p-5 shadow-glow">
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center animate-float">
              <Waves className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">המשמרת שלי</h1>
              <p className="text-sm opacity-80 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                יום {HEBREW_DAYS[new Date().getDay()]} - {format(new Date(), 'dd/MM/yyyy')}
              </p>
            </div>
          </div>
          <Badge 
            variant="secondary" 
            className="text-lg px-4 py-2 glass text-primary-foreground border-0 font-bold"
          >
            {todaySessions.length} שיעורים
          </Badge>
        </div>

        {/* Decorative wave */}
        <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden">
          <svg viewBox="0 0 1200 60" className="w-full h-full fill-background" preserveAspectRatio="none">
            <path d="M0,60 L0,30 Q150,0 300,30 T600,30 T900,30 T1200,30 L1200,60 Z" />
          </svg>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Salary Preview Widget */}
        <section className="animate-slide-up">
          <Card className="card-premium overflow-hidden border-0 shadow-premium">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-aqua/5" />
            <CardHeader className="relative pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
                  <DollarSign className="h-5 w-5 text-primary-foreground" />
                </div>
                <span className="text-gradient-primary font-bold">דוח שכר החודש</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="relative">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 card-hover">
                  <p className="text-sm text-muted-foreground mb-2">שיעורים שהושלמו</p>
                  <p className="text-3xl font-black text-gradient-primary">
                    {monthlyStats?.completedSessions || 0}
                  </p>
                </div>
                <div className="text-center p-4 rounded-xl bg-gradient-to-br from-muted/50 to-muted/30 border border-border/50 card-hover">
                  <p className="text-sm text-muted-foreground mb-2">סה"כ שעות</p>
                  <p className="text-3xl font-black text-gradient-primary">
                    {monthlyStats?.totalHours || '0'}
                  </p>
                </div>
              </div>
              <div className="mt-4 p-5 rounded-2xl gradient-primary text-primary-foreground text-center relative overflow-hidden shadow-float">
                <div className="absolute inset-0 bg-shimmer bg-shimmer animate-shimmer opacity-30" />
                <p className="text-sm opacity-90 mb-1 relative z-10">שכר משוער החודש</p>
                <p className="text-4xl font-black flex items-center justify-center gap-2 relative z-10">
                  ₪{monthlyStats?.estimatedSalary?.toLocaleString() || 0}
                  <TrendingUp className="h-6 w-6 animate-bounce-soft" />
                </p>
                <p className="text-xs opacity-80 mt-2 relative z-10">
                  (₪{monthlyStats?.hourlyRate || DEFAULT_HOURLY_RATE} לשעה)
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Today's Sessions */}
        <section className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-primary" />
            </div>
            שיעורים להיום
          </h2>

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="card-premium animate-pulse">
                  <CardContent className="h-32 bg-gradient-to-r from-muted/50 to-muted/30" />
                </Card>
              ))}
            </div>
          ) : todaySessions.length === 0 ? (
            <Card className="border-dashed border-2 border-muted bg-muted/20">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                  <Calendar className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">אין שיעורים מתוכננים להיום</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {todaySessions.map((session: any, index: number) => {
                const status = getSessionStatus(session);
                const enrolledCount = session.enrollments?.filter(
                  (e: any) => e.status !== 'cancelled'
                ).length || 0;

                return (
                  <Card
                    key={session.id}
                    className={cn(
                      'card-premium cursor-pointer card-hover overflow-hidden border-0',
                      status.glow && 'ring-2 ring-warning shadow-glow animate-glow-pulse'
                    )}
                    style={{ animationDelay: `${index * 0.05}s` }}
                    onClick={() => setSelectedSession(session)}
                  >
                    {/* Top accent line */}
                    <div className={cn(
                      'h-1 w-full',
                      status.label === 'בתהליך' && 'gradient-wave',
                      status.label === 'ממתין' && 'gradient-primary',
                      status.label === 'הושלם' && 'bg-success',
                      status.label === 'עבר' && 'bg-muted'
                    )} />
                    
                    <CardContent className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-bold text-xl flex items-center gap-2">
                            {session.class_type?.name || 'שיעור שחייה'}
                            {status.glow && (
                              <Sparkles className="h-4 w-4 text-warning animate-pulse-soft" />
                            )}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1.5">
                            <Clock className="h-4 w-4" />
                            <span className="font-medium">
                              {formatSessionTime(session.start_time, session.end_time)}
                            </span>
                          </div>
                        </div>
                        <Badge 
                          className={cn(
                            'text-white px-3 py-1 font-semibold shadow-sm',
                            status.color,
                            status.glow && 'animate-pulse-soft'
                          )}
                        >
                          {status.label}
                        </Badge>
                      </div>

                      <div className="divider-gradient my-3" />

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{session.resource?.name}</span>
                        </div>
                        <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-full">
                          <Users className="h-4 w-4 text-primary" />
                          <span className="font-bold text-primary">{enrolledCount} רשומים</span>
                        </div>
                      </div>

                      <Button
                        className="w-full mt-4 gap-2 btn-premium h-12 text-base font-semibold"
                        size="lg"
                      >
                        <span>כניסה לשיעור</span>
                        <ChevronLeft className="h-5 w-5" />
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
          <section className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-primary" />
              </div>
              שיעורים קרובים
            </h2>

            <div className="space-y-2">
              {upcomingSessions.map((session: any, index: number) => {
                const sessionDate = new Date(session.start_time);
                const dayLabel = isTomorrow(sessionDate)
                  ? 'מחר'
                  : `יום ${HEBREW_DAYS[sessionDate.getDay()]}`;

                return (
                  <Card 
                    key={session.id} 
                    className="card-hover bg-muted/30 border-border/50 hover:bg-muted/50 transition-all"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <CardContent className="p-4 flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Calendar className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold">{session.class_type?.name || 'שיעור'}</p>
                          <p className="text-sm text-muted-foreground">
                            {dayLabel} - {format(sessionDate, 'HH:mm')}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-background/50">
                        {session.resource?.name}
                      </Badge>
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
