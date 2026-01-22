import { X, Award, Calendar, Heart, MessageSquare, TrendingUp } from 'lucide-react';
import { differenceInYears, format } from 'date-fns';
import { he } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { SwimmerProgress } from './SwimmerProgress';
import { CoachNotesDisplay } from './CoachNotesDisplay';
import { SwimmerEnrollments } from '@/components/booking/SwimmerEnrollments';

interface SwimmerDetailSheetProps {
  swimmer: {
    id: string;
    first_name: string;
    last_name: string;
    birth_date: string | null;
    gender: string | null;
    skill_level: string | null;
    medical_notes: string | null;
  } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SKILL_LEVELS: Record<string, string> = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
  competitive: 'תחרותי',
};

const GENDER_OPTIONS: Record<string, string> = {
  male: 'זכר',
  female: 'נקבה',
  other: 'אחר',
};

export function SwimmerDetailSheet({ swimmer, open, onOpenChange }: SwimmerDetailSheetProps) {
  if (!swimmer) return null;

  const age = swimmer.birth_date
    ? differenceInYears(new Date(), new Date(swimmer.birth_date))
    : null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto" dir="rtl">
        <SheetHeader className="pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-xl">
              {swimmer.first_name} {swimmer.last_name}
            </SheetTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {age !== null && (
              <Badge variant="outline">גיל {age}</Badge>
            )}
            {swimmer.gender && (
              <Badge variant="outline">
                {GENDER_OPTIONS[swimmer.gender] || swimmer.gender}
              </Badge>
            )}
            <Badge variant="secondary">
              {SKILL_LEVELS[swimmer.skill_level || 'beginner']}
            </Badge>
            {swimmer.birth_date && (
              <span className="text-xs text-muted-foreground">
                נולד/ה: {format(new Date(swimmer.birth_date), 'dd/MM/yyyy', { locale: he })}
              </span>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-6">
          {/* Progress Section */}
          <div>
            <h3 className="font-medium text-sm flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-primary" />
              התקדמות מקצועית
            </h3>
            <SwimmerProgress
              swimmerId={swimmer.id}
              swimmerName={`${swimmer.first_name} ${swimmer.last_name}`}
            />
          </div>

          <Separator />

          {/* Coach Notes */}
          <CoachNotesDisplay swimmerId={swimmer.id} />

          <Separator />

          {/* Medical Notes */}
          {swimmer.medical_notes && (
            <>
              <div>
                <h3 className="font-medium text-sm flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  הערות רפואיות
                </h3>
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 rounded-lg p-3">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    {swimmer.medical_notes}
                  </p>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Upcoming Enrollments */}
          <div>
            <h3 className="font-medium text-sm flex items-center gap-2 mb-3">
              <Calendar className="h-4 w-4 text-primary" />
              שיעורים קרובים
            </h3>
            <SwimmerEnrollments
              swimmerId={swimmer.id}
              swimmerName={`${swimmer.first_name} ${swimmer.last_name}`}
            />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
