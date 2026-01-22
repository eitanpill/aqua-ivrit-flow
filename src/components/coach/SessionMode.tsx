import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRight,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  Check,
  X,
  CheckCircle2,
  XCircle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface SessionModeProps {
  session: any;
  onBack: () => void;
}

const SKILL_LEVELS = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
  competitive: 'תחרותי',
};

export function SessionMode({ session, onBack }: SessionModeProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [attendanceState, setAttendanceState] = useState<Record<string, 'present' | 'absent' | null>>({});

  // Fetch existing attendance records
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['session-attendance', session.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('attendance' as any)
        .select('*')
        .eq('session_id', session.id) as any);

      if (error) throw error;
      return data || [];
    },
  });

  // Initialize attendance state from existing records
  useMemo(() => {
    const initialState: Record<string, 'present' | 'absent' | null> = {};
    existingAttendance.forEach((att: any) => {
      initialState[att.enrollment_id] = att.status as 'present' | 'absent';
    });
    session.enrollments?.forEach((enrollment: any) => {
      if (enrollment.status !== 'cancelled' && !initialState[enrollment.id]) {
        initialState[enrollment.id] = null;
      }
    });
    setAttendanceState(initialState);
  }, [existingAttendance, session.enrollments]);

  // Save attendance mutation
  const saveAttendance = useMutation({
    mutationFn: async (data: { enrollmentId: string; swimmerId: string; status: 'present' | 'absent' }) => {
      // Check if attendance already exists
      const existing = existingAttendance.find((a: any) => a.enrollment_id === data.enrollmentId);

      if (existing) {
        const { error } = await (supabase
          .from('attendance' as any)
          .update({
            status: data.status,
            marked_by: user?.id,
            marked_at: new Date().toISOString(),
          } as any)
          .eq('id', existing.id) as any);

        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('attendance' as any)
          .insert({
            enrollment_id: data.enrollmentId,
            session_id: session.id,
            swimmer_id: data.swimmerId,
            status: data.status,
            marked_by: user?.id,
          } as any) as any);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-attendance', session.id] });
    },
    onError: () => {
      toast.error('שגיאה בשמירת הנוכחות');
    },
  });

  // Finish session mutation
  const finishSession = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('sessions' as any)
        .update({ status: 'completed' } as any)
        .eq('id', session.id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coach-sessions'] });
      toast.success('השיעור הסתיים בהצלחה!');
      onBack();
    },
    onError: () => {
      toast.error('שגיאה בסיום השיעור');
    },
  });

  const handleAttendanceToggle = (enrollmentId: string, swimmerId: string, status: 'present' | 'absent') => {
    setAttendanceState((prev) => ({ ...prev, [enrollmentId]: status }));
    saveAttendance.mutate({ enrollmentId, swimmerId, status });
  };

  const activeEnrollments = session.enrollments?.filter((e: any) => e.status !== 'cancelled') || [];
  const presentCount = Object.values(attendanceState).filter((s) => s === 'present').length;
  const absentCount = Object.values(attendanceState).filter((s) => s === 'absent').length;
  const unmarkedCount = activeEnrollments.length - presentCount - absentCount;

  return (
    <div className="min-h-screen bg-background pb-24" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-primary text-primary-foreground p-4 shadow-lg">
        <div className="flex items-center gap-3 mb-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-primary-foreground hover:bg-primary-foreground/20"
            onClick={onBack}
          >
            <ArrowRight className="h-6 w-6" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-bold">
              {session.class_type?.name || 'שיעור שחייה'}
            </h1>
            <div className="flex items-center gap-3 text-sm opacity-80">
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {format(new Date(session.start_time), 'HH:mm')} - {format(new Date(session.end_time), 'HH:mm')}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {session.resource?.name}
              </span>
            </div>
          </div>
        </div>

        {/* Attendance Summary */}
        <div className="flex gap-2 justify-center">
          <Badge variant="secondary" className="gap-1 px-3 py-1">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            הגיעו: {presentCount}
          </Badge>
          <Badge variant="secondary" className="gap-1 px-3 py-1">
            <XCircle className="h-4 w-4 text-red-600" />
            חסרים: {absentCount}
          </Badge>
          <Badge variant="secondary" className="gap-1 px-3 py-1">
            <Users className="h-4 w-4" />
            סה"כ: {activeEnrollments.length}
          </Badge>
        </div>
      </div>

      {/* Swimmers List */}
      <div className="p-4 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          רשימת משתתפים
        </h2>

        {activeEnrollments.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <Users className="h-12 w-12 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">אין משתתפים רשומים לשיעור זה</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {activeEnrollments.map((enrollment: any) => {
              const swimmer = enrollment.swimmer;
              const currentStatus = attendanceState[enrollment.id];
              const hasMedicalNotes = !!swimmer?.medical_notes;

              return (
                <Card
                  key={enrollment.id}
                  className={cn(
                    'transition-all',
                    currentStatus === 'present' && 'border-green-500 bg-green-50 dark:bg-green-950/20',
                    currentStatus === 'absent' && 'border-red-500 bg-red-50 dark:bg-red-950/20'
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                            currentStatus === 'present'
                              ? 'bg-green-500 text-white'
                              : currentStatus === 'absent'
                              ? 'bg-red-500 text-white'
                              : 'bg-muted text-muted-foreground'
                          )}
                        >
                          {swimmer?.first_name?.[0]}{swimmer?.last_name?.[0]}
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">
                            {swimmer?.first_name} {swimmer?.last_name}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {SKILL_LEVELS[swimmer?.skill_level as keyof typeof SKILL_LEVELS] || 'מתחיל'}
                          </p>
                        </div>
                      </div>

                      {hasMedicalNotes && (
                        <Badge variant="destructive" className="gap-1 animate-pulse">
                          <AlertTriangle className="h-3 w-3" />
                          רגישות רפואית
                        </Badge>
                      )}
                    </div>

                    {hasMedicalNotes && (
                      <div className="mb-3 p-2 bg-red-100 dark:bg-red-950/50 rounded-lg text-sm text-red-800 dark:text-red-200">
                        <strong>הערה רפואית:</strong> {swimmer.medical_notes}
                      </div>
                    )}

                    {/* Large Touch-Friendly Attendance Toggles */}
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        size="lg"
                        variant={currentStatus === 'present' ? 'default' : 'outline'}
                        className={cn(
                          'h-14 text-lg gap-2 transition-all',
                          currentStatus === 'present' && 'bg-green-600 hover:bg-green-700'
                        )}
                        onClick={() => handleAttendanceToggle(enrollment.id, swimmer.id, 'present')}
                        disabled={saveAttendance.isPending}
                      >
                        <Check className="h-6 w-6" />
                        הגיע
                      </Button>
                      <Button
                        size="lg"
                        variant={currentStatus === 'absent' ? 'default' : 'outline'}
                        className={cn(
                          'h-14 text-lg gap-2 transition-all',
                          currentStatus === 'absent' && 'bg-red-600 hover:bg-red-700'
                        )}
                        onClick={() => handleAttendanceToggle(enrollment.id, swimmer.id, 'absent')}
                        disabled={saveAttendance.isPending}
                      >
                        <X className="h-6 w-6" />
                        לא הגיע
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Fixed Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t shadow-lg">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="lg"
              className="w-full h-14 text-lg gap-2"
              disabled={unmarkedCount > 0 || finishSession.isPending}
            >
              {finishSession.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              סיים שיעור
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>האם לסיים את השיעור?</AlertDialogTitle>
              <AlertDialogDescription>
                <div className="space-y-2 text-right">
                  <p>סיכום נוכחות:</p>
                  <ul className="list-disc list-inside">
                    <li>הגיעו: {presentCount} משתתפים</li>
                    <li>חסרים: {absentCount} משתתפים</li>
                  </ul>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex gap-2">
              <AlertDialogCancel>חזרה</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => finishSession.mutate()}
                className="bg-green-600 hover:bg-green-700"
              >
                אישור וסיום
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {unmarkedCount > 0 && (
          <p className="text-center text-sm text-muted-foreground mt-2">
            נותרו {unmarkedCount} משתתפים ללא סימון נוכחות
          </p>
        )}
      </div>
    </div>
  );
}
