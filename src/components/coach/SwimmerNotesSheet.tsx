import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Heart, Save, Loader2, AlertTriangle, Sparkles } from 'lucide-react';
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

  const saveSessionNote = useMutation({
    mutationFn: async () => {
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
      <SheetContent side="bottom" className="h-[80vh] overflow-y-auto rounded-t-3xl" dir="rtl">
        <SheetHeader className="pb-6">
          <SheetTitle className="text-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-glow">
              <MessageSquare className="h-5 w-5 text-primary-foreground" />
            </div>
            <span>הערות - {swimmer.first_name} {swimmer.last_name}</span>
          </SheetTitle>
          <SheetDescription className="text-base">
            הוסף הערות לשיעור זה או עדכן הערות רפואיות/כלליות
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-8 pb-24">
          {/* Session Note */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              הערה לשיעור זה
            </Label>
            <Textarea
              value={sessionNote}
              onChange={(e) => setSessionNote(e.target.value)}
              placeholder="רשום הערות על הביצועים, התנהגות, או כל דבר חשוב מהשיעור..."
              className="min-h-[140px] text-base leading-relaxed resize-none rounded-xl border-2 focus:border-primary/50 transition-colors"
              style={{ fontSize: '16px' }}
            />
            <p className="text-sm text-muted-foreground">
              הערה זו תישמר עבור שיעור זה בלבד
            </p>
          </div>

          {/* Divider */}
          <div className="divider-gradient" />

          {/* Medical/General Notes */}
          <div className="space-y-4">
            <Label className="text-lg font-semibold flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
                <Heart className="h-4 w-4 text-destructive" />
              </div>
              הערות רפואיות / כלליות
              {swimmer.medical_notes && (
                <Badge variant="destructive" className="gap-1 mr-2">
                  <AlertTriangle className="h-3 w-3" />
                  קיימת הערה
                </Badge>
              )}
            </Label>
            
            {swimmer.medical_notes && (
              <div className="p-4 bg-destructive/5 rounded-xl border-2 border-destructive/20">
                <p className="text-sm font-medium text-destructive mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  הערה קיימת:
                </p>
                <p className="text-destructive/80 leading-relaxed">
                  {swimmer.medical_notes}
                </p>
              </div>
            )}

            <Textarea
              value={profileNote}
              onChange={(e) => setProfileNote(e.target.value)}
              placeholder="הערות רפואיות, אלרגיות, פחדים, או מידע חשוב אחר..."
              className="min-h-[140px] text-base leading-relaxed resize-none rounded-xl border-2 focus:border-destructive/50 transition-colors"
              style={{ fontSize: '16px' }}
            />
            <p className="text-sm text-muted-foreground">
              הערה זו תופיע בכל השיעורים העתידיים
            </p>
          </div>
        </div>

        {/* Fixed Save Button */}
        <div className="fixed bottom-0 left-0 right-0 p-4 glass-strong border-t-0">
          <Button
            onClick={handleSaveAll}
            disabled={isSaving}
            className="w-full h-14 text-lg gap-2 btn-premium rounded-2xl font-bold"
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
