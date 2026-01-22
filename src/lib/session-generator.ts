import { addDays, startOfWeek, setHours, setMinutes, parseISO, format } from 'date-fns';

interface ScheduleTemplate {
  id: string;
  class_type_id: string;
  day_of_week: number;
  start_time: string;
  coach_id: string | null;
  resource_id: string | null;
}

interface ClassType {
  id: string;
  duration_min: number;
  max_participants: number;
}

interface GeneratedSession {
  template_id: string;
  class_type_id: string;
  start_time: string;
  end_time: string;
  coach_id: string | null;
  resource_id: string | null;
  max_participants: number;
  status: 'scheduled';
}

export function generateSessionsFromTemplates(
  templates: ScheduleTemplate[],
  classTypes: ClassType[],
  startDate: Date,
  endDate: Date
): GeneratedSession[] {
  const sessions: GeneratedSession[] = [];
  const classTypeMap = new Map(classTypes.map(ct => [ct.id, ct]));

  // Start from the beginning of the week
  let currentDate = startOfWeek(startDate, { weekStartsOn: 0 }); // Sunday = 0

  while (currentDate <= endDate) {
    for (const template of templates) {
      const classType = classTypeMap.get(template.class_type_id);
      if (!classType) continue;

      // Calculate the date for this template's day of week
      const sessionDate = addDays(currentDate, template.day_of_week);
      
      if (sessionDate >= startDate && sessionDate <= endDate) {
        // Parse the time and set it on the session date
        const [hours, minutes] = template.start_time.split(':').map(Number);
        const sessionStart = setMinutes(setHours(sessionDate, hours), minutes);
        const sessionEnd = new Date(sessionStart.getTime() + classType.duration_min * 60000);

        sessions.push({
          template_id: template.id,
          class_type_id: template.class_type_id,
          start_time: sessionStart.toISOString(),
          end_time: sessionEnd.toISOString(),
          coach_id: template.coach_id,
          resource_id: template.resource_id,
          max_participants: classType.max_participants,
          status: 'scheduled',
        });
      }
    }

    // Move to next week
    currentDate = addDays(currentDate, 7);
  }

  return sessions;
}

// Hebrew day names (Sunday = 0)
export const HEBREW_DAYS = [
  'ראשון',
  'שני',
  'שלישי',
  'רביעי',
  'חמישי',
  'שישי',
  'שבת',
] as const;

// Hebrew month names
export const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
] as const;

export function formatHebrewDate(date: Date): string {
  const day = date.getDate();
  const month = HEBREW_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

export function getHebrewDayName(dayIndex: number): string {
  return HEBREW_DAYS[dayIndex] || '';
}

// Session status translations
export const SESSION_STATUS_HEBREW: Record<string, string> = {
  scheduled: 'מתוכנן',
  in_progress: 'בתהליך',
  completed: 'הושלם',
  cancelled: 'בוטל',
};

export function getStatusColor(status: string): string {
  switch (status) {
    case 'scheduled':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
    case 'cancelled':
      return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
