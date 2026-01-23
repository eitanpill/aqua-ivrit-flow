import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format, addMinutes } from 'date-fns';
import { Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface CreateSessionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillData?: {
    class_type_id: string;
    coach_id: string | null;
    resource_id: string | null;
    max_participants: number;
    notes: string | null;
  } | null;
}

export function CreateSessionModal({
  open,
  onOpenChange,
  prefillData,
}: CreateSessionModalProps) {
  const queryClient = useQueryClient();
  
  // Form state
  const [classTypeId, setClassTypeId] = useState('');
  const [coachId, setCoachId] = useState('');
  const [resourceId, setResourceId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('16:00');
  const [duration, setDuration] = useState('45');
  const [maxParticipants, setMaxParticipants] = useState('8');
  const [notes, setNotes] = useState('');
  const [coachConflictError, setCoachConflictError] = useState<string | null>(null);

  // Apply prefill data when modal opens
  useEffect(() => {
    if (prefillData && open) {
      setClassTypeId(prefillData.class_type_id || '');
      setCoachId(prefillData.coach_id || '');
      setResourceId(prefillData.resource_id || '');
      setMaxParticipants(String(prefillData.max_participants || 8));
      setNotes(prefillData.notes || '');
      // Clear date/time for user to fill
      setDate('');
      setTime('16:00');
    }
  }, [prefillData, open]);

  // Reset form when closing
  useEffect(() => {
    if (!open) {
      setClassTypeId('');
      setCoachId('');
      setResourceId('');
      setDate('');
      setTime('16:00');
      setDuration('45');
      setMaxParticipants('8');
      setNotes('');
      setCoachConflictError(null);
    }
  }, [open]);

  // Fetch class types
  const { data: classTypes = [] } = useQuery({
    queryKey: ['class_types'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_types')
        .select('id, name, duration_min')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Fetch coaches
  const { data: coaches = [] } = useQuery({
    queryKey: ['coaches-list'],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('user_id')
        .in('role', ['coach', 'admin']);
      if (roleError) throw roleError;
      
      if (!roleData?.length) return [];
      
      const userIds = roleData.map((r) => r.user_id);
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .in('id', userIds);
      if (error) throw error;
      return data;
    },
  });

  // Fetch resources
  const { data: resources = [] } = useQuery({
    queryKey: ['resources-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('resources')
        .select('id, name, locations (name)')
        .order('name');
      if (error) throw error;
      return data as Array<{ id: string; name: string; locations: { name: string } | null }>;
    },
  });

  // Check coach conflict
  const checkCoachConflict = async () => {
    if (!coachId || !date || !time) {
      setCoachConflictError(null);
      return false;
    }

    const startTime = new Date(`${date}T${time}`);
    const endTime = addMinutes(startTime, parseInt(duration) || 45);

    const { data, error } = await (supabase.rpc as any)('check_coach_conflict', {
      p_coach_id: coachId,
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
    });

    if (error) {
      console.error('Error checking coach conflict:', error);
      return false;
    }

    if (data?.has_conflict) {
      const conflictTime = data.conflict_start_time
        ? format(new Date(data.conflict_start_time), 'HH:mm')
        : '';
      setCoachConflictError(
        `המאמן כבר משובץ לשיעור אחר בשעה זו (${data.conflict_class_name || 'שיעור'} ב-${conflictTime})`
      );
      return true;
    }

    setCoachConflictError(null);
    return false;
  };

  // Create session mutation
  const createSession = useMutation({
    mutationFn: async () => {
      // First check for coach conflict
      const hasConflict = await checkCoachConflict();
      if (hasConflict) {
        throw new Error('coach_conflict');
      }

      const startTime = new Date(`${date}T${time}`);
      const endTime = addMinutes(startTime, parseInt(duration) || 45);

      const { data, error } = await supabase
        .from('sessions')
        .insert({
          class_type_id: classTypeId,
          coach_id: coachId || null,
          resource_id: resourceId || null,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          max_participants: parseInt(maxParticipants) || 8,
          notes: notes || null,
          status: 'scheduled',
          is_cancelled: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions'] });
      toast.success('השיעור נוצר בהצלחה');
      onOpenChange(false);
    },
    onError: (error: Error) => {
      if (error.message === 'coach_conflict') {
        // Error already displayed
        return;
      }
      toast.error('שגיאה ביצירת השיעור');
      console.error(error);
    },
  });

  // When class type changes, update duration
  useEffect(() => {
    const selectedClassType = classTypes.find((ct) => ct.id === classTypeId);
    if (selectedClassType?.duration_min) {
      setDuration(String(selectedClassType.duration_min));
    }
  }, [classTypeId, classTypes]);

  // Check conflict when coach/date/time changes
  useEffect(() => {
    if (coachId && date && time) {
      checkCoachConflict();
    } else {
      setCoachConflictError(null);
    }
  }, [coachId, date, time, duration]);

  const canSubmit = classTypeId && date && time && !coachConflictError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>יצירת שיעור חדש</DialogTitle>
          <DialogDescription>
            {prefillData ? 'שכפל שיעור קיים - בחר תאריך ושעה חדשים' : 'הוסף שיעור חדש למערכת'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Class Type */}
          <div className="space-y-2">
            <Label>סוג שיעור *</Label>
            <Select value={classTypeId} onValueChange={setClassTypeId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר סוג שיעור" />
              </SelectTrigger>
              <SelectContent>
                {classTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">תאריך *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                autoFocus={!!prefillData}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">שעה *</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          {/* Coach */}
          <div className="space-y-2">
            <Label>מאמן</Label>
            <Select value={coachId} onValueChange={setCoachId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר מאמן (אופציונלי)" />
              </SelectTrigger>
              <SelectContent>
                {coaches.map((coach) => (
                  <SelectItem key={coach.id} value={coach.id}>
                    {coach.first_name} {coach.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Coach Conflict Warning */}
          {coachConflictError && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{coachConflictError}</AlertDescription>
            </Alert>
          )}

          {/* Resource */}
          <div className="space-y-2">
            <Label>בריכה / מסלול</Label>
            <Select value={resourceId} onValueChange={setResourceId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר בריכה (אופציונלי)" />
              </SelectTrigger>
              <SelectContent>
                {resources.map((resource) => (
                  <SelectItem key={resource.id} value={resource.id}>
                    {resource.name} {resource.locations?.name ? `(${resource.locations.name})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Duration and Max Participants */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">משך (דקות)</Label>
              <Input
                id="duration"
                type="number"
                min="15"
                max="120"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="maxParticipants">מקסימום משתתפים</Label>
              <Input
                id="maxParticipants"
                type="number"
                min="1"
                max="20"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערות לשיעור..."
              className="min-h-[60px]"
            />
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={() => createSession.mutate()}
            disabled={!canSubmit || createSession.isPending}
          >
            {createSession.isPending && (
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            )}
            צור שיעור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}