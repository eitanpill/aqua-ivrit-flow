import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';
import {
  Users,
  Clock,
  MapPin,
  User,
  Phone,
  CheckCircle2,
  XCircle,
  ChevronUp,
  AlertTriangle,
  Settings,
  Save,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { WhatsAppButton } from '@/components/ui/whatsapp-button';

interface SessionCommandCenterProps {
  sessionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SessionDetails {
  session: {
    id: string;
    class_type_name: string;
    resource_name: string;
    location_name: string;
    coach_name: string;
    start_time: string;
    end_time: string;
    max_participants: number;
    is_cancelled: boolean;
    status: string;
    allow_overbooking: boolean;
  };
  enrolled_count: number;
  waitlist_count: number;
  spots_remaining: number;
  is_full: boolean;
  enrolled: Array<{
    enrollment_id: string;
    swimmer_id: string;
    swimmer_name: string;
    parent_id: string;
    parent_name: string;
    parent_phone: string | null;
    enrolled_at: string;
    status: string;
    type: string;
  }>;
  waitlist: Array<{
    waitlist_id: string;
    swimmer_id: string;
    swimmer_name: string;
    parent_id: string;
    parent_name: string;
    parent_phone: string | null;
    position: number;
    created_at: string;
    status: string;
    time_waiting: number;
  }>;
}

export function SessionCommandCenter({ sessionId, open, onOpenChange }: SessionCommandCenterProps) {
  const queryClient = useQueryClient();
  const [newCapacity, setNewCapacity] = useState<number | null>(null);
  const [isEditingCapacity, setIsEditingCapacity] = useState(false);

  // Fetch session details
  const { data, isLoading, refetch } = useQuery<SessionDetails>({
    queryKey: ['session-details', sessionId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_session_enrollment_details', {
        p_session_id: sessionId,
      });
      if (error) throw error;
      return data;
    },
    enabled: open && !!sessionId,
    refetchInterval: open ? 10000 : false, // Refresh every 10 seconds when open
  });

  // Cancel enrollment mutation
  const cancelEnrollment = useMutation({
    mutationFn: async (enrollmentId: string) => {
      const { data, error } = await (supabase.rpc as any)('cancel_enrollment_with_promotion', {
        p_enrollment_id: enrollmentId,
        p_notify_waitlist: true,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['available-sessions'] });
      if (result?.waitlist_notified) {
        toast.success('ההרשמה בוטלה והבא בתור קיבל התראה!');
      } else {
        toast.success('ההרשמה בוטלה בהצלחה');
      }
    },
    onError: () => {
      toast.error('שגיאה בביטול ההרשמה');
    },
  });

  // Promote from waitlist mutation
  const promoteFromWaitlist = useMutation({
    mutationFn: async (waitlistId: string) => {
      const { data, error } = await (supabase.rpc as any)('admin_promote_from_waitlist', {
        p_waitlist_id: waitlistId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['available-sessions'] });
      toast.success(result?.message || 'השחיין קודם לשיעור!');
    },
    onError: () => {
      toast.error('שגיאה בקידום מרשימת ההמתנה');
    },
  });

  // Update capacity mutation
  const updateCapacity = useMutation({
    mutationFn: async (capacity: number) => {
      const { data, error } = await (supabase.rpc as any)('update_session_capacity', {
        p_session_id: sessionId,
        p_max_participants: capacity,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (result) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ['available-sessions'] });
      setIsEditingCapacity(false);
      toast.success('הקיבולת עודכנה בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בעדכון הקיבולת');
    },
  });

  const formatTimeWaiting = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    
    if (days > 0) {
      return `${days} ימים`;
    } else if (hours > 0) {
      return `${hours} שעות`;
    } else {
      return 'פחות משעה';
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Settings className="h-5 w-5" />
            מרכז פיקוד שיעור
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-4">
            <div className="h-24 bg-muted animate-pulse rounded-lg" />
            <div className="h-48 bg-muted animate-pulse rounded-lg" />
          </div>
        ) : data ? (
          <div className="space-y-6">
            {/* Session Header */}
            <Card className={data.is_full ? 'border-amber-500/50' : 'border-green-500/50'}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{data.session.class_type_name}</CardTitle>
                    <CardDescription className="flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {data.session.location_name} - {data.session.resource_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(data.session.start_time), 'dd/MM HH:mm', { locale: he })}
                      </span>
                    </CardDescription>
                  </div>
                  {/* Capacity Status */}
                  <div className="text-left">
                    {data.is_full ? (
                      <Badge variant="destructive" className="text-base px-3 py-1">
                        מלא + {data.waitlist_count} ממתינים
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-base px-3 py-1 bg-green-100 text-green-800">
                        {data.enrolled_count}/{data.session.max_participants} רשומים
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
            </Card>

            {/* Capacity Control */}
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-base flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    ניהול קיבולת
                  </span>
                  {!isEditingCapacity && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setNewCapacity(data.session.max_participants);
                        setIsEditingCapacity(true);
                      }}
                    >
                      שנה קיבולת
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              {isEditingCapacity && (
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Label htmlFor="capacity">קיבולת מקסימלית</Label>
                      <Input
                        id="capacity"
                        type="number"
                        min={1}
                        max={20}
                        value={newCapacity || ''}
                        onChange={(e) => setNewCapacity(parseInt(e.target.value))}
                        className="mt-1"
                      />
                    </div>
                    <div className="flex gap-2 pt-6">
                      <Button
                        size="sm"
                        onClick={() => newCapacity && updateCapacity.mutate(newCapacity)}
                        disabled={updateCapacity.isPending || !newCapacity}
                      >
                        <Save className="h-4 w-4 ml-1" />
                        שמור
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setIsEditingCapacity(false)}
                      >
                        ביטול
                      </Button>
                    </div>
                  </div>
                  {newCapacity && newCapacity < data.enrolled_count && (
                    <p className="text-amber-600 text-sm mt-2 flex items-center gap-1">
                      <AlertTriangle className="h-4 w-4" />
                      הקיבולת החדשה נמוכה ממספר הרשומים הנוכחי
                    </p>
                  )}
                </CardContent>
              )}
            </Card>

            <Separator />

            {/* Enrolled List */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                רשומים ({data.enrolled_count})
              </h3>
              {data.enrolled.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    אין רשומים לשיעור זה
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.enrolled.map((enrollment, index) => (
                    <Card key={enrollment.enrollment_id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{enrollment.swimmer_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              {enrollment.parent_name}
                              {enrollment.parent_phone && (
                                <>
                                  <Phone className="h-3 w-3 mr-2" />
                                  <span dir="ltr">{enrollment.parent_phone}</span>
                                  <WhatsAppButton
                                    phone={enrollment.parent_phone}
                                    message={`שלום ${enrollment.parent_name}, לגבי השיעור של ${enrollment.swimmer_name}`}
                                    size="icon"
                                    variant="ghost"
                                    name={enrollment.parent_name}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {enrollment.type === 'permanent' ? 'קבוע' : enrollment.type === 'makeup' ? 'השלמה' : 'בודד'}
                          </Badge>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent dir="rtl">
                              <AlertDialogHeader>
                                <AlertDialogTitle>ביטול הרשמה</AlertDialogTitle>
                                <AlertDialogDescription>
                                  האם לבטל את ההרשמה של {enrollment.swimmer_name}?
                                  {data.waitlist_count > 0 && ' הבא בתור ברשימת ההמתנה יקבל התראה.'}
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="flex gap-2">
                                <AlertDialogCancel>ביטול</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => cancelEnrollment.mutate(enrollment.enrollment_id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  בטל הרשמה
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Waitlist */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                רשימת המתנה ({data.waitlist_count})
              </h3>
              {data.waitlist.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="py-8 text-center text-muted-foreground">
                    אין ממתינים
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-2">
                  {data.waitlist.map((waitlistEntry) => (
                    <Card key={waitlistEntry.waitlist_id} className="hover:shadow-sm transition-shadow border-amber-200">
                      <CardContent className="py-3 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-sm font-medium">
                            {waitlistEntry.position}
                          </div>
                          <div>
                            <p className="font-medium">{waitlistEntry.swimmer_name}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <User className="h-3 w-3" />
                              {waitlistEntry.parent_name}
                              {waitlistEntry.parent_phone && (
                                <>
                                  <Phone className="h-3 w-3 mr-2" />
                                  <span dir="ltr">{waitlistEntry.parent_phone}</span>
                                  <WhatsAppButton
                                    phone={waitlistEntry.parent_phone}
                                    message={`שלום ${waitlistEntry.parent_name}, התפנה מקום בשיעור! ${waitlistEntry.swimmer_name} יכול/ה להצטרף.`}
                                    size="icon"
                                    variant="ghost"
                                    name={waitlistEntry.parent_name}
                                  />
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            ממתין {formatTimeWaiting(waitlistEntry.time_waiting)}
                          </Badge>
                          {waitlistEntry.status === 'notified' && (
                            <Badge className="bg-blue-100 text-blue-800">קיבל התראה</Badge>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => promoteFromWaitlist.mutate(waitlistEntry.waitlist_id)}
                            disabled={promoteFromWaitlist.isPending}
                            className="gap-1"
                          >
                            <ChevronUp className="h-4 w-4" />
                            קדם לשיעור
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            לא נמצאו נתונים
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
