import { useState } from 'react';
import { format } from 'date-fns';
import { X, Clock, MapPin, User, Users, FileText, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
import { SESSION_STATUS_HEBREW, getStatusColor, getHebrewDayName } from '@/lib/session-generator';

interface Session {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  notes: string | null;
  max_participants: number;
  class_type?: { name: string } | null;
  coach?: { first_name: string | null; last_name: string | null } | null;
  resource?: { name: string; location?: { name: string } | null } | null;
}

interface SessionModalProps {
  session: Session | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCancel: (sessionId: string) => void;
  onUpdateNotes: (sessionId: string, notes: string) => void;
}

export function SessionModal({
  session,
  open,
  onOpenChange,
  onCancel,
  onUpdateNotes,
}: SessionModalProps) {
  const [notes, setNotes] = useState(session?.notes || '');
  const [isEditing, setIsEditing] = useState(false);

  if (!session) return null;

  const startTime = new Date(session.start_time);
  const endTime = new Date(session.end_time);
  const dayName = getHebrewDayName(startTime.getDay());
  const coachName = session.coach
    ? `${session.coach.first_name || ''} ${session.coach.last_name || ''}`.trim()
    : 'לא משויך';

  const handleSaveNotes = () => {
    onUpdateNotes(session.id, notes);
    setIsEditing(false);
  };

  const handleCancel = () => {
    onCancel(session.id);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            פרטי שיעור
            <Badge className={getStatusColor(session.status)}>
              {SESSION_STATUS_HEBREW[session.status]}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            {session.class_type?.name || 'שיעור'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Time info */}
          <div className="flex items-center gap-3 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">יום {dayName}</span>
            <span className="text-muted-foreground">
              {format(startTime, 'dd/MM/yyyy')}
            </span>
            <span className="font-medium">
              {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
            </span>
          </div>

          {/* Location info */}
          {session.resource && (
            <div className="flex items-center gap-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>{session.resource.name}</span>
              {session.resource.location && (
                <span className="text-muted-foreground">
                  ({session.resource.location.name})
                </span>
              )}
            </div>
          )}

          {/* Coach info */}
          <div className="flex items-center gap-3 text-sm">
            <User className="h-4 w-4 text-muted-foreground" />
            <span>מאמן: {coachName}</span>
          </div>

          {/* Participants info */}
          <div className="flex items-center gap-3 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span>מקסימום משתתפים: {session.max_participants}</span>
          </div>

          <Separator />

          {/* Participants list placeholder */}
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              רשימת משתתפים
            </h4>
            <div className="bg-muted/50 rounded-lg p-4 text-center text-sm text-muted-foreground">
              אין משתתפים רשומים עדיין
            </div>
          </div>

          <Separator />

          {/* Notes section */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              הערות
            </Label>
            {isEditing ? (
              <div className="space-y-2">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="הוסף הערות לשיעור..."
                  className="min-h-[80px]"
                  dir="rtl"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSaveNotes}>
                    שמור
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setNotes(session.notes || '');
                      setIsEditing(false);
                    }}
                  >
                    ביטול
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="bg-muted/50 rounded-lg p-3 text-sm cursor-pointer hover:bg-muted transition-colors"
                onClick={() => setIsEditing(true)}
              >
                {session.notes || 'לחץ להוספת הערות...'}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          {session.status !== 'cancelled' && session.status !== 'completed' && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  ביטול שיעור
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent dir="rtl">
                <AlertDialogHeader>
                  <AlertDialogTitle>האם לבטל את השיעור?</AlertDialogTitle>
                  <AlertDialogDescription>
                    פעולה זו תבטל את השיעור. כל המשתתפים הרשומים יקבלו הודעה על הביטול.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex gap-2 sm:gap-2">
                  <AlertDialogCancel>חזרה</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    אישור ביטול
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
