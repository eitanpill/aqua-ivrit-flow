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
  Sparkles,
  Waves,
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

  const saveAttendance = useMutation({
    mutationFn: async (data: { enrollmentId: string; swimmerId: string; status: 'present' | 'absent' | null }) => {
      const existing = existingAttendance.find((a: any) => a.enrollment_id === data.enrollmentId);

      if (data.status === null) {
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

  const handleAttendanceToggle = useCallback((enrollmentId: string, swimmerId: string) => {
    const currentStatus = attendanceState[enrollmentId];
    const nextStatus = getNextStatus(currentStatus);
    setAttendanceState(prev => ({ ...prev, [enrollmentId]: nextStatus }));
    saveAttendance.mutate({ enrollmentId, swimmerId, status: nextStatus });
  }, [attendanceState, saveAttendance]);

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

  const swimmersList = activeEnrollments.map((e: any) => e.swimmer).filter(Boolean);

  // Check if session is in the future - block attendance marking
  const isFutureSession = new Date() < new Date(session.start_time);
  const isAttendanceDisabled = isFutureSession || saveAttendance.isPending;

  return (
    <TooltipProvider>
      <div className="min-h-screen pb-28" dir="rtl">
        {/* Premium Header */}
        <div className="sticky top-0 z-10 header-premium text-primary-foreground p-5 shadow-glow">
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <Button
                variant="ghost"
                size="icon"
                className="text-primary-foreground hover:bg-primary-foreground/20 rounded-xl h-11 w-11"
                onClick={onBack}
              >
                <ArrowRight className="h-6 w-6" />
              </Button>
              <div className="flex-1">
                <h1 className="text-xl font-bold flex items-center gap-2">
                  {session.class_type?.name || 'שיעור שחייה'}
                  <Sparkles className="h-4 w-4 animate-pulse-soft" />
                </h1>
                <div className="flex items-center gap-4 text-sm opacity-80 mt-1">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-4 w-4" />
                    {format(new Date(session.start_time), 'HH:mm')} - {format(new Date(session.end_time), 'HH:mm')}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {session.resource?.name}
                  </span>
                </div>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-2 justify-center flex-wrap">
              <Badge className="gap-1.5 px-4 py-2 text-sm glass text-primary-foreground border-0">
                <CheckCircle2 className="h-4 w-4" />
                הגיעו: {presentCount}
              </Badge>
              <Badge className="gap-1.5 px-4 py-2 text-sm glass text-primary-foreground border-0">
                <XCircle className="h-4 w-4" />
                חסרים: {absentCount}
              </Badge>
              <Badge className="gap-1.5 px-4 py-2 text-sm glass text-primary-foreground border-0">
                <Users className="h-4 w-4" />
                סה"כ: {activeEnrollments.length}/{session.max_participants || 8}
              </Badge>
              {sessionDetails?.waitlist_count > 0 && (
                <Badge className="gap-1.5 px-4 py-2 text-sm bg-warning/20 text-warning-foreground border-0">
                  <Clock className="h-4 w-4" />
                  ממתינים: {sessionDetails.waitlist_count}
                </Badge>
              )}
            </div>
          </div>

          {/* Decorative wave */}
          <div className="absolute bottom-0 left-0 right-0 h-6 overflow-hidden">
            <svg viewBox="0 0 1200 60" className="w-full h-full fill-background" preserveAspectRatio="none">
              <path d="M0,60 L0,30 Q150,0 300,30 T600,30 T900,30 T1200,30 L1200,60 Z" />
            </svg>
          </div>
        </div>

        {/* Tabs */}
        <div className="p-4">
          <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4 h-14 p-1.5 bg-muted/50 rounded-2xl">
              <TabsTrigger 
                value="attendance" 
                className="gap-2 text-base h-full rounded-xl data-[state=active]:shadow-premium data-[state=active]:bg-background font-semibold"
              >
                <Users className="h-5 w-5" />
                נוכחות
              </TabsTrigger>
              <TabsTrigger 
                value="skills" 
                className="gap-2 text-base h-full rounded-xl data-[state=active]:shadow-premium data-[state=active]:bg-background font-semibold"
              >
                <Star className="h-5 w-5" />
                מיומנויות
              </TabsTrigger>
            </TabsList>

            {/* Attendance Tab */}
            <TabsContent value="attendance" className="space-y-4 mt-0">
              {/* Future Session Warning */}
              {isFutureSession && (
                <div className="bg-warning/10 border border-warning/30 rounded-2xl p-4 flex items-center gap-3 text-warning">
                  <Clock className="h-5 w-5 shrink-0" />
                  <span className="font-medium">ניתן לסמן נוכחות רק לאחר תחילת השיעור</span>
                </div>
              )}

              {/* Mark All Present Button */}
              {activeEnrollments.length > 0 && unmarkedCount > 0 && !isFutureSession && (
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 text-lg gap-2 border-2 border-success/50 text-success hover:bg-success/10 rounded-2xl font-semibold interactive"
                  onClick={markAllPresent}
                  disabled={isAttendanceDisabled}
                >
                  <CheckCheck className="h-6 w-6" />
                  סמן את כולם כנוכחים
                </Button>
              )}

              {activeEnrollments.length === 0 ? (
                <Card className="border-dashed border-2 border-muted bg-muted/20 rounded-2xl">
                  <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                      <Users className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground font-medium">אין משתתפים רשומים לשיעור זה</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {activeEnrollments.map((enrollment: any, index: number) => {
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
                          'card-premium overflow-hidden border-0 rounded-2xl animate-slide-up',
                          currentStatus === 'present' && 'ring-2 ring-success/50 shadow-[0_0_20px_-5px_hsl(var(--success)/0.3)]',
                          currentStatus === 'absent' && 'ring-2 ring-destructive/50 shadow-[0_0_20px_-5px_hsl(var(--destructive)/0.3)]'
                        )}
                        style={{ animationDelay: `${index * 0.05}s` }}
                      >
                        <CardContent className="p-0">
                          {/* Medical Warning Banner */}
                          {hasMedicalNotes && (
                            <div className="bg-gradient-to-r from-destructive to-destructive/80 text-destructive-foreground px-4 py-2.5 flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 animate-pulse-soft" />
                              <span className="font-semibold text-sm truncate">{swimmer.medical_notes}</span>
                            </div>
                          )}

                          <div className="p-5">
                            {/* Swimmer Info Row */}
                            <div className="flex items-center gap-4 mb-4">
                              {/* Large Avatar with glow */}
                              <div
                                className={cn(
                                  'w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold transition-all shrink-0 shadow-soft',
                                  currentStatus === 'present'
                                    ? 'gradient-primary text-primary-foreground shadow-[0_0_25px_-5px_hsl(var(--success)/0.5)]'
                                    : currentStatus === 'absent'
                                    ? 'bg-destructive text-destructive-foreground shadow-[0_0_25px_-5px_hsl(var(--destructive)/0.5)]'
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
                                <Badge variant="secondary" className="mt-1 text-xs">
                                  {SKILL_LEVELS[swimmer?.skill_level as keyof typeof SKILL_LEVELS] || 'מתחיל'}
                                </Badge>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex items-center gap-2 shrink-0">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-12 w-12 rounded-xl hover:bg-primary/10"
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
                              onClick={() => !isAttendanceDisabled && handleAttendanceToggle(enrollment.id, swimmer.id)}
                              disabled={isAttendanceDisabled}
                              className={cn(
                                'w-full h-16 rounded-2xl flex items-center justify-center gap-3 text-xl font-bold transition-all',
                                'active:scale-[0.98] touch-manipulation relative overflow-hidden',
                                isAttendanceDisabled && 'opacity-50 cursor-not-allowed',
                                currentStatus === null &&
                                  'bg-muted/50 border-2 border-dashed border-muted-foreground/30 text-muted-foreground',
                                currentStatus === 'present' &&
                                  'gradient-primary text-primary-foreground shadow-float',
                                currentStatus === 'absent' &&
                                  'bg-destructive text-destructive-foreground shadow-float'
                              )}
                            >
                              {/* Shimmer effect on active states */}
                              {currentStatus && (
                                <div className="absolute inset-0 bg-shimmer bg-shimmer animate-shimmer opacity-20" />
                              )}
                              
                              {saveAttendance.isPending ? (
                                <Loader2 className="h-7 w-7 animate-spin relative z-10" />
                              ) : currentStatus === null ? (
                                <>
                                  <CircleDashed className="h-7 w-7 relative z-10" />
                                  <span className="relative z-10">טרם סומן</span>
                                </>
                              ) : currentStatus === 'present' ? (
                                <>
                                  <UserCheck className="h-7 w-7 relative z-10" />
                                  <span className="relative z-10">הגיע</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="h-7 w-7 relative z-10" />
                                  <span className="relative z-10">לא הגיע</span>
                                </>
                              )}
                            </button>

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
        <div className="fixed bottom-0 left-0 right-0 p-4 glass-strong border-t-0">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="lg"
                className="w-full h-14 text-lg gap-2 btn-premium rounded-2xl font-bold"
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
            <AlertDialogContent dir="rtl" className="rounded-2xl">
              <AlertDialogHeader>
                <AlertDialogTitle className="text-xl">האם לסיים את השיעור?</AlertDialogTitle>
                <AlertDialogDescription>
                  <div className="space-y-3 text-right mt-4">
                    <p className="font-medium">סיכום נוכחות:</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-success/10 text-success p-3 rounded-xl text-center">
                        <p className="text-2xl font-bold">{presentCount}</p>
                        <p className="text-sm">הגיעו</p>
                      </div>
                      <div className="bg-destructive/10 text-destructive p-3 rounded-xl text-center">
                        <p className="text-2xl font-bold">{absentCount}</p>
                        <p className="text-sm">חסרים</p>
                      </div>
                    </div>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="flex gap-2 mt-4">
                <AlertDialogCancel className="rounded-xl">חזרה</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => finishSession.mutate()}
                  className="bg-success hover:bg-success/90 rounded-xl"
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
