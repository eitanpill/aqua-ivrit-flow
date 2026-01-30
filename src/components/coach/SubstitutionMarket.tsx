import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  RefreshCw, 
  Calendar, 
  Clock, 
  MapPin, 
  User,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Plus,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { HEBREW_DAYS } from '@/lib/session-generator';

interface Substitution {
  id: string;
  session_id: string;
  original_coach_id: string;
  sub_coach_id: string | null;
  status: 'requested' | 'approved' | 'rejected' | 'cancelled';
  reason: string | null;
  requested_at: string;
  responded_at: string | null;
  session?: {
    id: string;
    start_time: string;
    end_time: string;
    class_type?: { name: string };
    resource?: { name: string };
  };
  original_coach?: { first_name: string; last_name: string };
  sub_coach?: { first_name: string; last_name: string } | null;
}

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  class_type?: { name: string };
  resource?: { name: string };
}

export function SubstitutionMarket() {
  const { user, isAdmin } = useAuth();
  const { notifyCoachChange } = useNotifications();
  const queryClient = useQueryClient();
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [reason, setReason] = useState('');
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedSubstitution, setSelectedSubstitution] = useState<Substitution | null>(null);

  // Fetch substitution requests
  const { data: substitutions = [], isLoading: subsLoading } = useQuery({
    queryKey: ['substitutions'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('substitutions' as any)
        .select(`
          *,
          session:sessions(
            id,
            start_time,
            end_time,
            class_type:class_types(name),
            resource:resources(name)
          ),
          original_coach:profiles!substitutions_original_coach_id_fkey(first_name, last_name),
          sub_coach:profiles!substitutions_sub_coach_id_fkey(first_name, last_name)
        `)
        .order('requested_at', { ascending: false }) as any);

      if (error) throw error;
      return (data || []) as Substitution[];
    },
  });

  // Fetch my upcoming sessions (for requesting substitution)
  const { data: mySessions = [] } = useQuery({
    queryKey: ['my-sessions-for-sub', user?.id],
    queryFn: async () => {
      const tomorrow = new Date();
      tomorrow.setHours(0, 0, 0, 0);

      const { data, error } = await (supabase
        .from('sessions' as any)
        .select(`
          id,
          start_time,
          end_time,
          class_type:class_types(name),
          resource:resources(name)
        `)
        .eq('coach_id', user?.id)
        .gte('start_time', tomorrow.toISOString())
        .neq('status', 'cancelled')
        .order('start_time')
        .limit(20) as any);

      if (error) throw error;
      return (data || []) as Session[];
    },
    enabled: !!user?.id,
  });

  // Fetch coaches for admin to assign
  const { data: coaches = [] } = useQuery({
    queryKey: ['coaches-list'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('profiles' as any)
        .select('id, first_name, last_name')
        .eq('role', 'coach') as any);

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
  });

  // Request substitution mutation
  const requestSubMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('substitutions' as any)
        .insert({
          session_id: selectedSession,
          original_coach_id: user?.id,
          reason,
          status: 'requested',
        } as any) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      toast.success('בקשת ההחלפה נשלחה בהצלחה');
      setRequestDialogOpen(false);
      setSelectedSession('');
      setReason('');
    },
    onError: () => {
      toast.error('שגיאה בשליחת הבקשה');
    },
  });

  // Approve substitution mutation (coach accepts shift)
  const acceptShiftMutation = useMutation({
    mutationFn: async (substitution: Substitution) => {
      const { data, error } = await (supabase.rpc as any)('approve_substitution', {
        p_substitution_id: substitution.id,
        p_sub_coach_id: user?.id,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      return { result, substitution };
    },
    onSuccess: async ({ result, substitution }) => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      queryClient.invalidateQueries({ queryKey: ['coach-sessions'] });
      toast.success('קיבלת את המשמרת בהצלחה!');
      setAcceptDialogOpen(false);
      
      // Notify parents about coach change
      if (substitution.session?.id) {
        const originalCoachName = `${substitution.original_coach?.first_name || ''} ${substitution.original_coach?.last_name || ''}`.trim();
        const newCoachName = `${user?.user_metadata?.first_name || ''} ${user?.user_metadata?.last_name || ''}`.trim() || 'מאמן חדש';
        await notifyCoachChange(substitution.session.id, originalCoachName, newCoachName);
      }
      
      setSelectedSubstitution(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'שגיאה בקבלת המשמרת');
    },
  });

  // Admin assign coach mutation
  const assignCoachMutation = useMutation({
    mutationFn: async ({ substitutionId, coachId, substitution }: { substitutionId: string; coachId: string; substitution: Substitution }) => {
      const { data, error } = await (supabase.rpc as any)('approve_substitution', {
        p_substitution_id: substitutionId,
        p_sub_coach_id: coachId,
      });

      if (error) throw error;
      const result = data as any;
      if (!result.success) throw new Error(result.error);
      
      // Fetch the new coach name
      const { data: newCoach } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', coachId)
        .single();
      
      return { result, substitution, newCoach };
    },
    onSuccess: async ({ result, substitution, newCoach }) => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      toast.success('המאמן שובץ בהצלחה');
      
      // Notify parents about coach change
      if (substitution.session?.id) {
        const originalCoachName = `${substitution.original_coach?.first_name || ''} ${substitution.original_coach?.last_name || ''}`.trim();
        const newCoachName = newCoach ? `${newCoach.first_name || ''} ${newCoach.last_name || ''}`.trim() : 'מאמן חדש';
        await notifyCoachChange(substitution.session.id, originalCoachName, newCoachName);
      }
    },
    onError: (error: any) => {
      toast.error(error.message || 'שגיאה בשיבוץ המאמן');
    },
  });

  // Cancel substitution mutation
  const cancelMutation = useMutation({
    mutationFn: async (substitutionId: string) => {
      const { error } = await (supabase
        .from('substitutions' as any)
        .update({ status: 'cancelled' } as any)
        .eq('id', substitutionId) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['substitutions'] });
      toast.success('הבקשה בוטלה');
    },
    onError: () => {
      toast.error('שגיאה בביטול הבקשה');
    },
  });

  const openRequests = substitutions.filter(s => s.status === 'requested');
  const myRequests = substitutions.filter(s => s.original_coach_id === user?.id);
  const historyRequests = substitutions.filter(s => s.status !== 'requested');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'requested':
        return <Badge className="bg-amber-500">ממתין</Badge>;
      case 'approved':
        return <Badge className="bg-green-500">אושר</Badge>;
      case 'rejected':
        return <Badge variant="destructive">נדחה</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">בוטל</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  const formatSessionTime = (session: any) => {
    if (!session) return '';
    const date = new Date(session.start_time);
    const dayName = HEBREW_DAYS[date.getDay()];
    return `יום ${dayName}, ${format(date, 'dd/MM')} בשעה ${format(date, 'HH:mm')}`;
  };

  if (subsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <RefreshCw className="h-6 w-6 text-primary" />
            שוק החלפות
          </h2>
          <p className="text-muted-foreground">בקש החלפה או קבל משמרות פנויות</p>
        </div>

        <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              בקש החלפה
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>בקשת החלפה</DialogTitle>
              <DialogDescription>
                בחר שיעור שברצונך לבקש עבורו מחליף
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">בחר שיעור</label>
                <Select value={selectedSession} onValueChange={setSelectedSession}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר שיעור..." />
                  </SelectTrigger>
                  <SelectContent>
                    {mySessions.map((session) => (
                      <SelectItem key={session.id} value={session.id}>
                        {session.class_type?.name} - {formatSessionTime(session)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">סיבה (אופציונלי)</label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="נא לציין את סיבת הבקשה..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                onClick={() => requestSubMutation.mutate()}
                disabled={!selectedSession || requestSubMutation.isPending}
              >
                {requestSubMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'שלח בקשה'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="open" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="open" className="gap-2">
            <AlertCircle className="h-4 w-4" />
            פתוחות ({openRequests.length})
          </TabsTrigger>
          <TabsTrigger value="my" className="gap-2">
            <User className="h-4 w-4" />
            הבקשות שלי ({myRequests.length})
          </TabsTrigger>
          <TabsTrigger value="history" className="gap-2">
            <Clock className="h-4 w-4" />
            היסטוריה
          </TabsTrigger>
        </TabsList>

        {/* Open Requests - Available shifts */}
        <TabsContent value="open" className="space-y-4 mt-4">
          {openRequests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <RefreshCw className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">אין בקשות החלפה פתוחות</p>
              </CardContent>
            </Card>
          ) : (
            openRequests.map((sub) => (
              <Card key={sub.id} className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/10">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {sub.session?.class_type?.name || 'שיעור'}
                        </Badge>
                        {getStatusBadge(sub.status)}
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatSessionTime(sub.session)}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          {sub.session?.resource?.name}
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          מאמן מקורי: {sub.original_coach?.first_name} {sub.original_coach?.last_name}
                        </div>
                      </div>

                      {sub.reason && (
                        <p className="text-sm text-muted-foreground bg-background/50 p-2 rounded">
                          סיבה: {sub.reason}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2">
                      {sub.original_coach_id !== user?.id && (
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedSubstitution(sub);
                            setAcceptDialogOpen(true);
                          }}
                        >
                          קבל משמרת
                        </Button>
                      )}
                      
                      {isAdmin && (
                        <Select
                          onValueChange={(coachId) => {
                            assignCoachMutation.mutate({
                              substitutionId: sub.id,
                              coachId,
                              substitution: sub,
                            });
                          }}
                        >
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="שבץ מאמן" />
                          </SelectTrigger>
                          <SelectContent>
                            {coaches
                              .filter((c: any) => c.id !== sub.original_coach_id)
                              .map((coach: any) => (
                                <SelectItem key={coach.id} value={coach.id}>
                                  {coach.first_name} {coach.last_name}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* My Requests */}
        <TabsContent value="my" className="space-y-4 mt-4">
          {myRequests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <User className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">לא הגשת בקשות החלפה</p>
              </CardContent>
            </Card>
          ) : (
            myRequests.map((sub) => (
              <Card key={sub.id}>
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">
                          {sub.session?.class_type?.name || 'שיעור'}
                        </Badge>
                        {getStatusBadge(sub.status)}
                      </div>
                      
                      <div className="space-y-1 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {formatSessionTime(sub.session)}
                        </div>
                        {sub.sub_coach && (
                          <div className="flex items-center gap-2 text-green-600">
                            <CheckCircle2 className="h-4 w-4" />
                            מחליף: {sub.sub_coach.first_name} {sub.sub_coach.last_name}
                          </div>
                        )}
                      </div>
                    </div>

                    {sub.status === 'requested' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => cancelMutation.mutate(sub.id)}
                      >
                        <XCircle className="h-4 w-4 ml-1" />
                        ביטול
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4 mt-4">
          {historyRequests.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">אין היסטוריית החלפות</p>
              </CardContent>
            </Card>
          ) : (
            historyRequests.slice(0, 10).map((sub) => (
              <Card key={sub.id} className="bg-muted/50">
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusBadge(sub.status)}
                      <span className="text-sm">
                        {sub.session?.class_type?.name} - {formatSessionTime(sub.session)}
                      </span>
                    </div>
                    {sub.sub_coach && (
                      <span className="text-sm text-muted-foreground">
                        מחליף: {sub.sub_coach.first_name} {sub.sub_coach.last_name}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Accept Shift Confirmation Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>אישור קבלת משמרת</DialogTitle>
            <DialogDescription>
              האם אתה בטוח שברצונך לקבל את המשמרת הזו?
            </DialogDescription>
          </DialogHeader>

          {selectedSubstitution && (
            <div className="py-4 space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{formatSessionTime(selectedSubstitution.session)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{selectedSubstitution.session?.resource?.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>
                  במקום: {selectedSubstitution.original_coach?.first_name}{' '}
                  {selectedSubstitution.original_coach?.last_name}
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>
              ביטול
            </Button>
            <Button
              onClick={() => selectedSubstitution && acceptShiftMutation.mutate(selectedSubstitution)}
              disabled={acceptShiftMutation.isPending}
            >
              {acceptShiftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'קבל משמרת'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
