import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import {
  Calendar as CalendarIcon,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useSchool } from '@/contexts/SchoolContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { WeeklyCalendar } from '@/components/calendar/WeeklyCalendar';
import { CalendarFilters } from '@/components/calendar/CalendarFilters';
import { SessionModal } from '@/components/calendar/SessionModal';
import { CreateSessionModal } from '@/components/calendar/CreateSessionModal';
import { HEBREW_MONTHS } from '@/lib/session-generator';
import { DashboardStats, DashboardToolbar, type ViewMode } from '@/components/dashboard';
import { cn } from '@/lib/utils';

export default function Calendar() {
  const queryClient = useQueryClient();
  const { user, isCoach, isAdmin } = useAuth();
  const { activeSchoolId, isLoadingSchool } = useSchool();
  const { notifyCancellation } = useNotifications();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedLocation, setSelectedLocation] = useState('all');
  const [selectedCoach, setSelectedCoach] = useState('all');
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [duplicateData, setDuplicateData] = useState<{
    class_type_id: string;
    coach_id: string | null;
    resource_id: string | null;
    max_participants: number;
    notes: string | null;
  } | null>(null);

  // Force coach filter for non-admin coaches
  useEffect(() => {
    if (isCoach && !isAdmin && user?.id) {
      setSelectedCoach(user.id);
    }
  }, [isCoach, isAdmin, user?.id]);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });

  // Fetch sessions for the current week
  const { data: sessions = [], isLoading: isLoadingSessions } = useQuery({
    queryKey: ['sessions', activeSchoolId, format(weekStart, 'yyyy-MM-dd'), format(weekEnd, 'yyyy-MM-dd'), isCoach && !isAdmin ? user?.id : null],
    queryFn: async () => {
      let query = supabase
        .from('sessions' as any)
        .select(`
          *,
          class_type:class_types(name),
          coach:profiles!sessions_coach_id_fkey(first_name, last_name),
          resource:resources(name, location:locations(name))
        `)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time');

      if (activeSchoolId) {
        query = query.eq('school_id', activeSchoolId);
      }

      if (isCoach && !isAdmin && user?.id) {
        query = query.eq('coach_id', user.id);
      }

      const { data, error } = await (query as any);

      if (error) throw error;
      return data || [];
    },
    enabled: !!user && !!activeSchoolId && !isLoadingSchool,
  });

  // Fetch locations for filter
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', activeSchoolId],
    queryFn: async () => {
      let query = supabase
        .from('locations')
        .select('*')
        .order('name');

      if (activeSchoolId) {
        query = query.eq('school_id', activeSchoolId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeSchoolId && !isLoadingSchool,
  });

  // Fetch coaches for filter
  const { data: coaches = [] } = useQuery({
    queryKey: ['coaches', activeSchoolId],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('*')
        .in('role', ['coach', 'admin'])
        .order('first_name');

      if (activeSchoolId) {
        query = query.eq('school_id', activeSchoolId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeSchoolId && !isLoadingSchool,
  });

  // Cancel session mutation
  const cancelSession = useMutation({
    mutationFn: async (sessionId: string) => {
      const { error } = await (supabase
        .from('sessions' as any)
        .update({ status: 'cancelled', is_cancelled: true } as any)
        .eq('id', sessionId) as any);

      if (error) throw error;
      return sessionId;
    },
    onSuccess: async (sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['sessions', activeSchoolId] });
      toast.success('השיעור בוטל בהצלחה');
      await notifyCancellation(sessionId);
    },
    onError: () => {
      toast.error('שגיאה בביטול השיעור');
    },
  });

  // Update session notes mutation
  const updateSessionNotes = useMutation({
    mutationFn: async ({ sessionId, notes }: { sessionId: string; notes: string }) => {
      const { error } = await (supabase
        .from('sessions' as any)
        .update({ notes } as any)
        .eq('id', sessionId) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sessions', activeSchoolId] });
      toast.success('ההערות נשמרו בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בשמירת ההערות');
    },
  });

  // Filter sessions based on selected filters and search
  const filteredSessions = useMemo(() => {
    return sessions.filter((session: any) => {
      // Location filter
      if (selectedLocation !== 'all') {
        const resourceLocationId = session.resource?.location?.id;
        if (resourceLocationId !== selectedLocation) return false;
      }
      // Coach filter
      if (selectedCoach !== 'all') {
        if (session.coach_id !== selectedCoach) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        if (session.status !== statusFilter) return false;
      }
      // Search filter
      if (searchQuery) {
        const search = searchQuery.toLowerCase();
        const name = session.class_type?.name?.toLowerCase() || '';
        const coachName = `${session.coach?.first_name || ''} ${session.coach?.last_name || ''}`.toLowerCase();
        const resourceName = session.resource?.name?.toLowerCase() || '';
        if (!name.includes(search) && !coachName.includes(search) && !resourceName.includes(search)) {
          return false;
        }
      }
      return true;
    });
  }, [sessions, selectedLocation, selectedCoach, statusFilter, searchQuery]);

  const handlePreviousWeek = () => {
    setCurrentDate(subWeeks(currentDate, 1));
  };

  const handleNextWeek = () => {
    setCurrentDate(addWeeks(currentDate, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleSessionClick = (session: any) => {
    setSelectedSession(session);
    setIsModalOpen(true);
  };

  const handleCancelSession = (sessionId: string) => {
    cancelSession.mutate(sessionId);
  };

  const handleUpdateNotes = (sessionId: string, notes: string) => {
    updateSessionNotes.mutate({ sessionId, notes });
  };

  const handleDuplicate = (sessionData: {
    class_type_id: string;
    coach_id: string | null;
    resource_id: string | null;
    max_participants: number;
    notes: string | null;
  }) => {
    setDuplicateData(sessionData);
    setIsCreateModalOpen(true);
  };

  // Stats
  const scheduledCount = filteredSessions.filter((s: any) => s.status === 'scheduled').length;
  const completedCount = filteredSessions.filter((s: any) => s.status === 'completed').length;
  const cancelledCount = filteredSessions.filter((s: any) => s.status === 'cancelled').length;
  const totalCount = filteredSessions.length;

  const stats = [
    { id: 'scheduled', label: 'מתוכננים', value: scheduledCount, color: 'text-blue-600' },
    { id: 'completed', label: 'הושלמו', value: completedCount, color: 'text-green-600' },
    { id: 'cancelled', label: 'בוטלו', value: cancelledCount, color: 'text-red-600' },
    { id: 'total', label: 'סה"כ', value: totalCount },
  ];

  const statusOptions = [
    { value: 'all', label: 'הכל' },
    { value: 'scheduled', label: 'מתוכנן' },
    { value: 'completed', label: 'הושלם' },
    { value: 'cancelled', label: 'בוטל' },
  ];

  if (isLoadingSchool) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-6" dir="rtl">
      {/* Premium Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center shadow-glow">
              <CalendarIcon className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">יומן שיעורים</h1>
              <p className="text-muted-foreground text-sm sm:text-base">
                ניהול וצפייה בלוח הזמנים השבועי
              </p>
            </div>
          </div>

          {isAdmin && (
            <Button onClick={() => setIsCreateModalOpen(true)} className="btn-premium gap-2">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">שיעור חדש</span>
            </Button>
          )}
        </div>

        {/* Week Navigation */}
        <div className="flex items-center justify-between sm:justify-end gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleToday}>
            היום
          </Button>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handleNextWeek}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <span className="text-xs sm:text-sm font-medium min-w-[140px] sm:min-w-[200px] text-center bg-muted/50 px-3 py-1.5 rounded-lg">
              {format(weekStart, 'dd')} - {format(weekEnd, 'dd')} {HEBREW_MONTHS[weekStart.getMonth()]}
            </span>
            <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" onClick={handlePreviousWeek}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <DashboardStats stats={stats} />

      {/* Toolbar */}
      {/* Toolbar with Filters */}
      <div className="space-y-4">
        <DashboardToolbar
          showSearch
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="חיפוש שיעור, מאמן, בריכה..."
          showViewToggle={false}
          showStatusFilter
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          statusOptions={statusOptions}
        />
        
        <CalendarFilters
          locations={locations}
          coaches={coaches}
          selectedLocation={selectedLocation}
          selectedCoach={selectedCoach}
          onLocationChange={setSelectedLocation}
          onCoachChange={setSelectedCoach}
          hideCoachFilter={isCoach && !isAdmin}
        />
      </div>

      {/* Weekly Calendar */}
      {isLoadingSessions ? (
        <div className="flex justify-center items-center h-[400px]">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <WeeklyCalendar
          currentDate={currentDate}
          sessions={filteredSessions}
          onSessionClick={handleSessionClick}
        />
      )}

      {/* Session Modal */}
      <SessionModal
        session={selectedSession}
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        onCancel={handleCancelSession}
        onUpdateNotes={handleUpdateNotes}
        onDuplicate={isAdmin ? handleDuplicate : undefined}
      />

      {/* Create Session Modal */}
      {isAdmin && (
        <CreateSessionModal
          open={isCreateModalOpen}
          onOpenChange={(open) => {
            setIsCreateModalOpen(open);
            if (!open) setDuplicateData(null);
          }}
          prefillData={duplicateData}
        />
      )}
    </div>
  );
}
