import { useQuery } from '@tanstack/react-query';
import { MessageSquare, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface CoachNotesDisplayProps {
  swimmerId: string;
  compact?: boolean;
}

interface EvaluationNote {
  id: string;
  notes: string | null;
  achieved_at: string | null;
  skill: {
    id: string;
    name: string;
  } | null;
  evaluator: {
    first_name: string | null;
    last_name: string | null;
  } | null;
}

export function CoachNotesDisplay({ swimmerId, compact = false }: CoachNotesDisplayProps) {
  // Fetch evaluations with notes
  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['swimmer-coach-notes', swimmerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('swimmer_evaluations')
        .select(`
          id,
          notes,
          achieved_at,
          skill:skills(id, name),
          evaluator:profiles!swimmer_evaluations_evaluated_by_fkey(first_name, last_name)
        `)
        .eq('swimmer_id', swimmerId)
        .not('notes', 'is', null)
        .order('achieved_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as EvaluationNote[];
    },
    enabled: !!swimmerId,
  });

  if (isLoading) {
    return <div className="animate-pulse h-12 bg-muted rounded" />;
  }

  if (notes.length === 0) {
    if (compact) return null;
    return (
      <div className="text-sm text-muted-foreground flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        אין הערות מהמדריך
      </div>
    );
  }

  if (compact) {
    // Show only the latest note in compact mode
    const latestNote = notes[0];
    return (
      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MessageSquare className="h-3.5 w-3.5" />
          הערת המדריך האחרונה
        </div>
        <p className="text-sm line-clamp-2">{latestNote.notes}</p>
        {latestNote.skill?.name && (
          <Badge variant="secondary" className="text-xs">
            {latestNote.skill.name}
          </Badge>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h4 className="font-medium flex items-center gap-2 text-sm">
        <MessageSquare className="h-4 w-4 text-primary" />
        הערות המדריך ({notes.length})
      </h4>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notes.map((note) => (
          <div key={note.id} className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm">{note.notes}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                {note.skill?.name && (
                  <Badge variant="secondary" className="text-xs">
                    {note.skill.name}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {note.evaluator?.first_name && (
                  <span className="flex items-center gap-1">
                    <UserIcon className="h-3 w-3" />
                    {note.evaluator.first_name} {note.evaluator.last_name}
                  </span>
                )}
                {note.achieved_at && (
                  <span>
                    {format(new Date(note.achieved_at), 'dd/MM/yyyy', { locale: he })}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
