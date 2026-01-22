import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Heart, Save, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { toast } from 'sonner';

interface SwimmerNotesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  swimmer: {
    id: string;
    first_name: string;
    last_name: string;
    medical_notes?: string | null;
  } | null;
  enrollmentId: string;
  sessionId: string;
  existingNote?: string | null;
}

export function SwimmerNotesSheet({
  open,
  onOpenChange,
  swimmer,
  enrollmentId,
  sessionId,
  existingNote,
}: SwimmerNotesSheetProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [sessionNote, setSessionNote] = useState(existingNote || '');
  const [profileNote, setProfileNote] = useState(swimmer?.medical_notes || '');

  // Save session note to attendance
  const saveSessionNote = useMutation({
    mutationFn: async () => {
      // First check if attendance record exists
      const { data: existing } = await supabase
        .from('attendance')
        .select('id')
        .eq('enrollment_id', enrollmentId)
        .eq('session_id', sessionId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('attendance')
          .update({ notes: sessionNote })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Create attendance record with note
        const { error } = await supabase
          .from('attendance')
          .insert({
            enrollment_id: enrollmentId,
            session_id: sessionId,
            swimmer_id: swimmer?.id,
            status: 'present',
            notes: sessionNote,
            marked_by: user?.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['session-attendance', sessionId] });
      toast.success('הערה לשיעור נשמרה');
    },
    onError: () => {
      toast.error('שגיאה בשמירת ההערה');
    },
  });

  // Save profile note (medical/general)
  const saveProfileNote = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('swimmers')
        .update({ medical_notes: profileNote })
        .eq('id', swimmer?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['swimmers'] });
      toast.success('הערה רפואית/כללית נשמרה');
    },
    onError: () => {
      toast.error('שגיאה בשמירת ההערה');
    },
  });

  const handleSaveAll = () => {
    saveSessionNote.mutate();
    if (profileNote !== swimmer?.medical_notes) {
      saveProfileNote.mutate();
    }
  };

  const isSaving = saveSessionNote.isPending || saveProfileNote.isPending;

  if (!swimmer) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[75vh] overflow-y-auto" dir="rtl">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-xl flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            הערות - {swimmer.first_name} {swimmer.last_name}
          </SheetTitle>
          <SheetDescription>
            הוסף הערות לשיעור זה או עדכן הערות רפואיות/כלליות
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 pb-20">
          {/* Session Note */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              הערה לשיעור זה
            </Label>
            <Textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="רשום הערות על הביצועים, התנהגות, או כל דבר חשוב מהשיעור..."
              className="min-h-[120px] text-base leading-relaxed resize-none"
              style={{ fontSize: '16px' }} // Prevent iOS zoom
            />
            <p className="text-sm text-muted-foreground">
              הערה זו תישמר עבור שיעור זה בלבד
            </p>
          </div>

          {/* Medical/General Notes */}
          <div className="space-y-3">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <Heart className="h-4 w-4 text-red-500" />
              הערות רפואיות / כלליות
              {swimmer.medical_notes && (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  קיימת הערה
                </Badge>
              )}
            </Label>
            
            {swimmer.medical_notes && (
              <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                  הערה קיימת:
                </p>
                <p className="text-red-700 dark:text-red-300">
                  {swimmer.medical_notes}
                </p>
              </div>
            )}

            <Textarea
              value={profileNote}
              onChange={(e) => setProfileNote(e.target.value)}
              placeholder="הערות רפואיות, אלרגיות, פחדים, או מידע חשוב אחר..."
              className="min-h-[120px] text-base leading-relaxed resize-none"
              style={{ fontSize: '16px' }}
            />
            <p className="text-sm text-muted-foreground">
              הערה זו תופיע בכל השיעורים העתידיים
            </p>
          </div>
        </div>

        {/* Fixed Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t">
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full h-14 text-lg gap-2"
            size="lg"
          >
            {isSaving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            שמור הערות
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
