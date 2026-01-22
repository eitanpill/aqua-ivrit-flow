import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  ArrowRight,
  Clock,
  MapPin,
  Users,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Star,
  MessageSquare,
  CheckCheck,
  CircleDashed,
  UserX,
  UserCheck,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { SwimmerNotesSheet } from './SwimmerNotesSheet';
import { InlineSkillsEvaluation } from './InlineSkillsEvaluation';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';
import { TooltipProvider } from '@/components/ui/tooltip';

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

// 3-state attendance cycle: null -> present -> absent -> null
type AttendanceStatus = 'present' | 'absent' | null;

const getNextStatus = (current: AttendanceStatus): AttendanceStatus => {
  if (current === null) return 'present';
  if (current === 'present') return 'absent';
  return null;
};

export function SessionMode({ session, onBack }: SessionModeProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [attendanceState, setAttendanceState] = useState<Record<string, AttendanceStatus>>({});
  const [activeTab, setActiveTab] = useState<'attendance' | 'skills'>('attendance');
  const [notesSheet, setNotesSheet] = useState<{
    open: boolean;
    swimmer: any;
    enrollmentId: string;
    existingNote?: string;
  }>({ open: false, swimmer: null, enrollmentId: '' });

  // Fetch existing attendance records
  const { data: existingAttendance = [] } = useQuery({
    queryKey: ['session-attendance', session.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('session_id', session.id);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch session details including waitlist
  const { data: sessionDetails } = useQuery({
    queryKey: ['session-coach-details', session.id],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_session_enrollment_details', {
        p_session_id: session.id,
      });
      if (error) throw error;
      return data;
    },
  });

  // Initialize attendance state from existing records
  useMemo(() => {
    const initialState: Record<string, AttendanceStatus> = {};
    existingAttendance.forEach((att: any) => {
      initialState[att.enrollment_id] = att.status as 'present' | 'absent';
    });
    session.enrollments?.forEach((enrollment: any) => {
      if (enrollment.status !== 'cancelled' && !(enrollment.id in initialState)) {
        initialState[enrollment.id] = null;
      }
    });
    setAttendanceState(initialState);
  }, [existingAttendance, session.enrollments]);

  // Save attendance mutation
  const saveAttendance = useMutation({
    mutationFn: async (data: { enrollmentId: string; swimmerId: string; status: 'present' | 'absent' | null }) => {
      const existing = existingAttendance.find((a: any) => a.enrollment_id === data.enrollmentId);

      if (data.status === null) {
        // Delete attendance record
        if (existing) {
          const { error } = await supabase
            .from('attendance')
            .delete()
            .eq('id', existing.id);
          if (error) throw error;
        }
      } else if (existing) {
        const { error } = await supabase
          .from('attendance')
          .update({
            status: data.status,
            marked_by: user?.id,
            marked_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('attendance')
          .insert({
            enrollment_id: data.enrollmentId,
            session_id: session.id,
            swimmer_id: data.swimmerId,
            status: data.status,
            marked_by: user?.id,
          });
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
      const { error } = await supabase
        .from('sessions')
        .update({ status: 'completed' })
        .eq('id', session.id);
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

  // Handle 3-state toggle
  const handleAttendanceToggle = useCallback((enrollmentId: string, swimmerId: string) => {
    const currentStatus = attendanceState[enrollmentId];
    const nextStatus = getNextStatus(currentStatus);
    setAttendanceState(prev => ({ ...prev, [enrollmentId]: nextStatus }));
    saveAttendance.mutate({ enrollmentId, swimmerId, status: nextStatus });
  }, [attendanceState, saveAttendance]);

  // Mark all present
  const markAllPresent = useCallback(() => {
    const activeEnrollments = session.enrollments?.filter((e: any) => e.status !== 'cancelled') || [];
    activeEnrollments.forEach((enrollment: any) => {
      if (attendanceState[enrollment.id] !== 'present') {
        setAttendanceState(prev => ({ ...prev, [enrollment.id]: 'present' }));
        saveAttendance.mutate({
          enrollmentId: enrollment.id,
          swimmerId: enrollment.swimmer?.id,
          status: 'present',
        });
      }
    });
    toast.success('כל המשתתפים סומנו כנוכחים');
  }, [session.enrollments, attendanceState, saveAttendance]);

  const activeEnrollments = session.enrollments?.filter((e: any) => e.status !== 'cancelled') || [];
  const presentCount = Object.values(attendanceState).filter(s => s === 'present').length;
  const absentCount = Object.values(attendanceState).filter(s => s === 'absent').length;
  const unmarkedCount = activeEnrollments.length - presentCount - absentCount;

  // Get swimmers for skills tab
  const swimmersList = activeEnrollments.map((e: any) => e.swimmer).filter(Boolean);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background pb-28" dir="rtl">
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
          <div className="flex gap-2 justify-center flex-wrap">
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              הגיעו: {presentCount}
            </Badge>
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
              <XCircle className="h-4 w-4 text-red-600" />
              חסרים: {absentCount}
            </Badge>
            <Badge variant="secondary" className="gap-1 px-3 py-1.5 text-sm">
              <Users className="h-4 w-4" />
              סה"כ: {activeEnrollments.length}/{session.max_participants || 8}
            </Badge>
            {sessionDetails?.waitlist_count > 0 && (
              <Badge className="gap-1 px-3 py-1.5 text-sm bg-amber-100 text-amber-800">
                <Clock className="h-4 w-4" />
                ממתינים: {sessionDetails.waitlist_count}
              </Badge>
            )}
          </div>
        </div>

        {/* Tabs for Attendance / Skills */}
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 h-12">
              <TabsTrigger value="attendance" className="gap-2 text-base h-full">
                <Users className="h-5 w-5" />
                נוכחות
              </TabsTrigger>
              <TabsTrigger value="skills" className="gap-2 text-base h-full">
                <Star className="h-5 w-5" />
                מיומנויות
              </TabsTrigger>
            </TabsList>

            {/* Attendance Tab */}
            <TabsContent value="attendance" className="space-y-3 mt-0">
              {/* Mark All Present Button */}
              {activeEnrollments.length > 0 && unmarkedCount > 0 && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 text-lg gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-950/30"
                  onClick={markAllPresent}
                  disabled={saveAttendance.isPending}
                >
                  <CheckCheck className="h-6 w-6" />
                  סמן את כולם כנוכחים
                </Button>
              )}

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
                    const attendanceRecord = existingAttendance.find(
                      (a: any) => a.enrollment_id === enrollment.id
                    );

                    return (
                      <Card
                        key={enrollment.id}
                        className={cn(
                          'transition-all overflow-hidden',
                          currentStatus === 'present' && 'ring-2 ring-green-500 bg-green-50/50 dark:bg-green-950/20',
                          currentStatus === 'absent' && 'ring-2 ring-red-500 bg-red-50/50 dark:bg-red-950/20'
                        )}
                      >
                        <CardContent className="p-0">
                          {/* Medical Warning Banner */}
                          {hasMedicalNotes && (
                            <div className="bg-red-500 text-white px-4 py-2 flex items-center gap-2 animate-pulse">
                              <AlertTriangle className="h-5 w-5" />
                              <span className="font-medium text-sm">רגישות רפואית - {swimmer.medical_notes}</span>
                            </div>
                          )}

                          <div className="p-4">
                            {/* Swimmer Info Row */}
                            <div className="flex items-center gap-4 mb-4">
                              {/* Large Avatar */}
                              <div
                                className={cn(
                                  'w-16 h-16 rounded-full flex items-center justify-center text-xl font-bold transition-all shrink-0',
                                  currentStatus === 'present'
                                    ? 'bg-green-500 text-white'
                                    : currentStatus === 'absent'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-muted text-muted-foreground'
                                )}
                              >
                                {swimmer?.first_name?.[0]}{swimmer?.last_name?.[0]}
                              </div>

                              {/* Name and Level */}
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-xl truncate">
                                  {swimmer?.first_name} {swimmer?.last_name}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                  {SKILL_LEVELS[swimmer?.skill_level as keyof typeof SKILL_LEVELS] || 'מתחיל'}
                                </p>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0">
                                {/* Notes Button */}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-12 w-12 rounded-full"
                                  onClick={() =>
                                    setNotesSheet({
                                      open: true,
                                      swimmer,
                                      enrollmentId: enrollment.id,
                                      existingNote: attendanceRecord?.notes,
                                    })
                                  }
                                >
                                  <MessageSquare className="h-6 w-6 text-muted-foreground" />
                                </Button>

                                {/* WhatsApp */}
                                {swimmer?.parent?.phone && (
                                  <WhatsAppButton
                                    phone={swimmer.parent.phone}
                                    name={`הורה של ${swimmer?.first_name}`}
                                    message={`שלום, בקשר לשיעור השחייה של ${swimmer?.first_name}`}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Large 3-State Toggle */}
                            <button
                              onClick={() => handleAttendanceToggle(enrollment.id, swimmer.id)}
                              disabled={saveAttendance.isPending}
                              className={cn(
                                'w-full h-16 rounded-xl flex items-center justify-center gap-3 text-xl font-bold transition-all',
                                'active:scale-[0.98] touch-manipulation',
                                currentStatus === null &&
                                  'bg-muted border-2 border-dashed border-muted-foreground/30 text-muted-foreground',
                                currentStatus === 'present' &&
                                  'bg-green-500 text-white shadow-lg shadow-green-500/30',
                                currentStatus === 'absent' &&
                                  'bg-red-500 text-white shadow-lg shadow-red-500/30'
                              )}
                            >
                              {saveAttendance.isPending ? (
                                <Loader2 className="h-7 w-7 animate-spin" />
                              ) : currentStatus === null ? (
                                <>
                                  <CircleDashed className="h-7 w-7" />
                                  טרם סומן
                                </>
                              ) : currentStatus === 'present' ? (
                                <>
                                  <UserCheck className="h-7 w-7" />
                                  הגיע
                                </>
                              ) : (
                                <>
                                  <UserX className="h-7 w-7" />
                                  לא הגיע
                                </>
                              )}
                            </button>

                            {/* Status hint */}
                            <p className="text-center text-xs text-muted-foreground mt-2">
                              לחץ לשינוי סטטוס (טרם סומן → הגיע → לא הגיע)
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </TabsContent>

            {/* Skills Tab */}
            <TabsContent value="skills" className="mt-0">
              <InlineSkillsEvaluation
                swimmers={swimmersList}
                classTypeId={session.class_type_id}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Notes Sheet */}
        <SwimmerNotesSheet
          open={notesSheet.open}
          onOpenChange={open => setNotesSheet(prev => ({ ...prev, open }))}
          swimmer={notesSheet.swimmer}
          enrollmentId={notesSheet.enrollmentId}
          sessionId={session.id}
          existingNote={notesSheet.existingNote}
        />

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
    </TooltipProvider>
  );
}
