import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, isSameDay } from 'date-fns';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Calendar,
  MapPin,
  User,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSchool } from '@/contexts/SchoolContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { HEBREW_DAYS } from '@/lib/session-generator';
import { MakeUpTokensBanner } from '@/components/booking/MakeUpTokensBanner';
import { WaitlistNotification } from '@/components/booking/WaitlistNotification';
import { WaitlistButton } from '@/components/booking/WaitlistButton';

const STEPS = [
  { id: 1, title: 'בחר ילד', icon: User },
  { id: 2, title: 'בחר בריכה ורמה', icon: MapPin },
  { id: 3, title: 'בחר מועד', icon: Calendar },
  { id: 4, title: 'אישור הרשמה', icon: CheckCircle2 },
];

export default function Booking() {
  const { user } = useAuth();
  const { activeSchoolId, isLoadingSchool } = useSchool();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedSwimmer, setSelectedSwimmer] = useState<any>(null);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<string>('');
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [enrollmentResult, setEnrollmentResult] = useState<{ action: string; position?: number } | null>(null);

  // Fetch swimmers
  const { data: swimmers = [] } = useQuery({
    queryKey: ['my-swimmers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('swimmers')
        .select('*')
        .eq('parent_id', user?.id)
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch locations - filtered by school_id
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', activeSchoolId],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('*')
        .order('name');
      
      // CRITICAL: Filter by school_id
      if (activeSchoolId) {
        query = query.eq('school_id', activeSchoolId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeSchoolId && !isLoadingSchool,
  });

  // Fetch class levels - filtered by school_id
  const { data: levels = [] } = useQuery({
    queryKey: ['class-levels', activeSchoolId],
    queryFn: async () => {
      let query = supabase
        .from('class_levels')
        .select('*')
        .order('sort_order');
      
      // CRITICAL: Filter by school_id
      if (activeSchoolId) {
        query = query.eq('school_id', activeSchoolId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeSchoolId && !isLoadingSchool,
  });

  // Fetch available sessions - filtered by school_id
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['available-sessions', activeSchoolId, selectedLocation, selectedLevel],
    queryFn: async () => {
      const now = new Date();
      const nextWeek = addDays(now, 14);

      let query = supabase
        .from('sessions' as any)
        .select(`
          *,
          class_type:class_types(name, level_id, max_participants),
          coach:profiles!sessions_coach_id_fkey(first_name, last_name),
          resource:resources(name, location_id, location:locations(name)),
          enrollments:enrollments(id)
        `)
        .eq('status', 'scheduled')
        .gte('start_time', now.toISOString())
        .lte('start_time', nextWeek.toISOString())
        .order('start_time');
      
      // CRITICAL: Filter by school_id
      if (activeSchoolId) {
        query = query.eq('school_id', activeSchoolId);
      }

      const { data, error } = await (query as any);

      if (error) throw error;
      return data || [];
    },
    enabled: currentStep >= 3 && !!selectedLocation && !!activeSchoolId && !isLoadingSchool,
  });

  // Filter sessions based on location and level (include full sessions for waitlist)
  const filteredSessions = useMemo(() => {
    return sessions.filter((session: any) => {
      if (selectedLocation && session.resource?.location_id !== selectedLocation) {
        return false;
      }
      if (selectedLevel && session.class_type?.level_id !== selectedLevel) {
        return false;
      }
      return true; // Show all sessions, including full ones
    });
  }, [sessions, selectedLocation, selectedLevel]);

  // Check swimmer's waitlist entries
  const { data: swimmerWaitlist = [] } = useQuery({
    queryKey: ['swimmer-waitlist', selectedSwimmer?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist' as any)
        .select('session_id, position, status')
        .eq('swimmer_id', selectedSwimmer?.id)
        .in('status', ['waiting', 'notified']) as any;

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedSwimmer?.id,
  });

  // Check if swimmer already enrolled
  const { data: existingEnrollments = [] } = useQuery({
    queryKey: ['swimmer-enrollments', selectedSwimmer?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('enrollments' as any)
        .select('session_id')
        .eq('swimmer_id', selectedSwimmer?.id)
        .neq('status', 'cancelled') as any);

      if (error) throw error;
      return data?.map((e: any) => e.session_id) || [];
    },
    enabled: !!selectedSwimmer?.id,
  });

  // Smart enrollment mutation using the new RPC function
  const enrollMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase.rpc as any)('smart_enroll_swimmer', {
        p_session_id: selectedSession.id,
        p_swimmer_id: selectedSwimmer.id,
        p_parent_id: user?.id,
        p_force_override: false,
      });

      if (error) throw error;
      
      if (!data?.success) {
        throw new Error(data?.message || 'שגיאה בהרשמה');
      }
      
      return data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['available-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['swimmer-enrollments'] });
      queryClient.invalidateQueries({ queryKey: ['swimmer-waitlist'] });
      
      setEnrollmentResult({ action: result.action, position: result.position });
      
      if (result.action === 'enrolled') {
        toast.success('ההרשמה בוצעה בהצלחה!');
      } else if (result.action === 'waitlisted') {
        toast.success(`נוספת לרשימת ההמתנה במקום ${result.position}`);
      }
      setCurrentStep(5); // Success state
    },
    onError: (error: any) => {
      toast.error(error.message || 'שגיאה בהרשמה');
    },
  });

  const handleNext = () => {
    if (currentStep === 1 && !selectedSwimmer) {
      toast.error('יש לבחור ילד');
      return;
    }
    if (currentStep === 2 && !selectedLocation) {
      toast.error('יש לבחור בריכה');
      return;
    }
    if (currentStep === 3 && !selectedSession) {
      toast.error('יש לבחור מועד');
      return;
    }
    if (currentStep === 4) {
      enrollMutation.mutate();
      return;
    }
    setCurrentStep((prev) => Math.min(prev + 1, 4));
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center mb-6 sm:mb-8 overflow-x-auto py-2">
      {STEPS.map((step, index) => (
        <div key={step.id} className="flex items-center flex-shrink-0">
          <div
            className={cn(
              'flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-full border-2 transition-all',
              currentStep > step.id
                ? 'bg-primary border-primary text-primary-foreground'
                : currentStep === step.id
                ? 'border-primary text-primary'
                : 'border-muted-foreground/30 text-muted-foreground'
            )}
          >
            {currentStep > step.id ? (
              <Check className="h-4 w-4 sm:h-5 sm:w-5" />
            ) : (
              <step.icon className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </div>
          <span
            className={cn(
              'mx-1 sm:mx-2 text-xs sm:text-sm hidden sm:block',
              currentStep >= step.id ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {step.title}
          </span>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                'w-4 sm:w-8 h-0.5 mx-1 sm:mx-2',
                currentStep > step.id ? 'bg-primary' : 'bg-muted-foreground/30'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-center mb-6">בחר ילד להרשמה</h2>
      {swimmers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8">
            <p className="text-muted-foreground mb-4">לא נמצאו ילדים</p>
            <Button onClick={() => navigate('/family')}>
              הוסף ילד ראשון
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {swimmers.map((swimmer: any) => (
            <Card
              key={swimmer.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                selectedSwimmer?.id === swimmer.id
                  ? 'ring-2 ring-primary border-primary'
                  : ''
              )}
              onClick={() => setSelectedSwimmer(swimmer)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">
                    {swimmer.first_name} {swimmer.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {swimmer.skill_level === 'beginner' && 'מתחיל'}
                    {swimmer.skill_level === 'intermediate' && 'בינוני'}
                    {swimmer.skill_level === 'advanced' && 'מתקדם'}
                    {swimmer.skill_level === 'competitive' && 'תחרותי'}
                  </p>
                </div>
                {selectedSwimmer?.id === swimmer.id && (
                  <Check className="h-5 w-5 text-primary mr-auto" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-center mb-6">בחר בריכה ורמה</h2>

      <div className="space-y-4">
        <h3 className="font-medium">בריכה</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {locations.map((location: any) => (
            <Card
              key={location.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                selectedLocation === location.id
                  ? 'ring-2 ring-primary border-primary'
                  : ''
              )}
              onClick={() => setSelectedLocation(location.id)}
            >
              <CardContent className="p-4 flex items-center gap-4">
                <MapPin className="h-5 w-5 text-primary" />
                <div>
                  <h4 className="font-medium">{location.name}</h4>
                  {location.address && (
                    <p className="text-sm text-muted-foreground">{location.address}</p>
                  )}
                </div>
                {selectedLocation === location.id && (
                  <Check className="h-5 w-5 text-primary mr-auto" />
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-medium">רמה (אופציונלי)</h3>
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={selectedLevel === '' ? 'default' : 'outline'}
            className="cursor-pointer px-4 py-2"
            onClick={() => setSelectedLevel('')}
          >
            כל הרמות
          </Badge>
          {levels.map((level: any) => (
            <Badge
              key={level.id}
              variant={selectedLevel === level.id ? 'default' : 'outline'}
              className="cursor-pointer px-4 py-2"
              onClick={() => setSelectedLevel(level.id)}
            >
              {level.name}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => {
    // Group sessions by date
    const sessionsByDate = filteredSessions.reduce((acc: any, session: any) => {
      const dateKey = format(new Date(session.start_time), 'yyyy-MM-dd');
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(session);
      return acc;
    }, {});

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-center mb-6">בחר מועד</h2>

        {isLoadingSessions ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">טוען שיעורים זמינים...</p>
          </div>
        ) : Object.keys(sessionsByDate).length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">אין שיעורים זמינים בתקופה זו</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {Object.entries(sessionsByDate).map(([dateKey, daySessions]: [string, any]) => {
              const date = new Date(dateKey);
              const dayName = HEBREW_DAYS[date.getDay()];

              return (
                <div key={dateKey} className="space-y-3">
                  <h3 className="font-medium text-muted-foreground">
                    יום {dayName} - {format(date, 'dd/MM/yyyy')}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {daySessions.map((session: any) => {
                      const isEnrolled = existingEnrollments.includes(session.id);
                      const enrolledCount = session.enrollments?.length || 0;
                      const maxParticipants = session.max_participants || 8;
                      const spotsLeft = maxParticipants - enrolledCount;
                      const isFull = spotsLeft <= 0;
                      const waitlistEntry = swimmerWaitlist.find(
                        (w: any) => w.session_id === session.id
                      );
                      const isOnWaitlist = !!waitlistEntry;

                      return (
                        <Card
                          key={session.id}
                          className={cn(
                            'transition-all cursor-pointer hover:shadow-md',
                            isEnrolled
                              ? 'opacity-75 cursor-not-allowed'
                              : '',
                            selectedSession?.id === session.id
                              ? 'ring-2 ring-primary border-primary'
                              : '',
                            isFull && !isEnrolled && !isOnWaitlist
                              ? 'border-amber-500/50 bg-amber-50/30 dark:bg-amber-950/10'
                              : '',
                            isOnWaitlist
                              ? 'border-blue-500/50 bg-blue-50/30 dark:bg-blue-950/10'
                              : ''
                          )}
                          onClick={() => {
                            if (!isEnrolled && !isOnWaitlist) {
                              setSelectedSession(session);
                            }
                          }}
                        >
                          <CardContent className="p-4">
                            <div className="flex justify-between items-start">
                              <div className="flex-1">
                                <h4 className="font-medium">
                                  {session.class_type?.name || 'שיעור שחייה'}
                                </h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                  <Clock className="h-4 w-4" />
                                  {format(new Date(session.start_time), 'HH:mm')} - 
                                  {format(new Date(session.end_time), 'HH:mm')}
                                </div>
                                {session.coach && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {session.coach.first_name} {session.coach.last_name}
                                  </p>
                                )}
                                {/* Waitlist warning */}
                                {isFull && !isEnrolled && !isOnWaitlist && (
                                  <p className="text-xs text-amber-600 mt-2">
                                    השיעור מלא. בחר כדי להצטרף לרשימת המתנה
                                  </p>
                                )}
                              </div>
                              <div className="text-left flex flex-col items-end gap-2">
                                {isEnrolled ? (
                                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                                    <CheckCircle2 className="h-3 w-3 ml-1" />
                                    רשום
                                  </Badge>
                                ) : isOnWaitlist ? (
                                  <Badge className="bg-blue-100 text-blue-800">
                                    <Clock className="h-3 w-3 ml-1" />
                                    מקום {waitlistEntry?.position} בתור
                                  </Badge>
                                ) : isFull ? (
                                  <Badge variant="destructive">
                                    מלא ({enrolledCount}/{maxParticipants})
                                  </Badge>
                                ) : spotsLeft <= 2 ? (
                                  <Badge variant="destructive">
                                    {spotsLeft} מקומות אחרונים!
                                  </Badge>
                                ) : (
                                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                                    {spotsLeft} מקומות פנויים
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderStep4 = () => {
    const sessionDate = new Date(selectedSession?.start_time);
    const location = locations.find((l: any) => l.id === selectedLocation);
    const enrolledCount = selectedSession?.enrollments?.length || 0;
    const maxParticipants = selectedSession?.max_participants || 8;
    const isFull = enrolledCount >= maxParticipants;

    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold text-center mb-6">
          {isFull ? 'הצטרפות לרשימת המתנה' : 'אישור הרשמה'}
        </h2>

        {/* Waitlist Warning */}
        {isFull && (
          <Card className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <Clock className="h-6 w-6 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">
                    השיעור מלא - תצטרף/י לרשימת ההמתנה
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    נודיע לך ברגע שיתפנה מקום
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>פרטי ההרשמה</CardTitle>
            <CardDescription>אנא וודא שהפרטים נכונים</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <User className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">ילד</p>
                <p className="font-medium">
                  {selectedSwimmer?.first_name} {selectedSwimmer?.last_name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <MapPin className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">בריכה</p>
                <p className="font-medium">{location?.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Calendar className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">שיעור</p>
                <p className="font-medium">
                  {selectedSession?.class_type?.name || 'שיעור שחייה'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">מועד</p>
                <p className="font-medium">
                  יום {HEBREW_DAYS[sessionDate.getDay()]} - {format(sessionDate, 'dd/MM/yyyy')}
                  {' '}בשעה {format(sessionDate, 'HH:mm')}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderSuccess = () => {
    const isWaitlist = enrollmentResult?.action === 'waitlisted';
    
    return (
      <div className="text-center py-12">
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6",
          isWaitlist ? "bg-blue-100" : "bg-green-100"
        )}>
          {isWaitlist ? (
            <Clock className="h-10 w-10 text-blue-600" />
          ) : (
            <CheckCircle2 className="h-10 w-10 text-green-600" />
          )}
        </div>
        <h2 className="text-2xl font-bold mb-2">
          {isWaitlist ? 'נוספת לרשימת ההמתנה!' : 'ההרשמה בוצעה בהצלחה!'}
        </h2>
        <p className="text-muted-foreground mb-6">
          {isWaitlist ? (
            <>
              {selectedSwimmer?.first_name} נמצא/ת במקום {enrollmentResult?.position} בתור.
              <br />
              נודיע לך ברגע שיתפנה מקום.
            </>
          ) : (
            <>{selectedSwimmer?.first_name} נרשם/ה לשיעור</>
          )}
        </p>
        <div className="flex justify-center gap-4">
          <Button onClick={() => navigate('/family')}>
            חזרה למשפחה שלי
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCurrentStep(1);
              setSelectedSwimmer(null);
              setSelectedSession(null);
              setEnrollmentResult(null);
            }}
          >
            הרשמה נוספת
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      {/* Waitlist Notifications */}
      <WaitlistNotification />

      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold">הרשמה לשיעורים</h1>
        <p className="text-muted-foreground mt-1">בצע הרשמה בארבעה שלבים פשוטים</p>
      </div>

      {/* Make-up Tokens Banner */}
      {selectedSwimmer && <MakeUpTokensBanner swimmerId={selectedSwimmer.id} />}

      {/* Step Indicator */}
      {currentStep <= 4 && renderStepIndicator()}

      {/* Step Content */}
      <Card className="p-6">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderSuccess()}
      </Card>

      {/* Navigation Buttons */}
      {currentStep <= 4 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            הקודם
          </Button>
          <Button
            onClick={handleNext}
            disabled={
              (currentStep === 1 && !selectedSwimmer) ||
              (currentStep === 2 && !selectedLocation) ||
              (currentStep === 3 && !selectedSession) ||
              enrollMutation.isPending
            }
            className="gap-2"
          >
            {currentStep === 4 ? (
              enrollMutation.isPending ? 'מבצע הרשמה...' : 'אישור הרשמה'
            ) : (
              'הבא'
            )}
            {currentStep < 4 && <ArrowLeft className="h-4 w-4" />}
          </Button>
        </div>
      )}
    </div>
  );
}
