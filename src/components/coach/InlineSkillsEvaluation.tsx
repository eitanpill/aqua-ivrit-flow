import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Award, Loader2, Star, Info } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface InlineSkillsEvaluationProps {
  swimmers: Array<{
    id: string;
    first_name: string;
    last_name: string;
    skill_level?: string | null;
  }>;
  classTypeId?: string;
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  level_id: string | null;
  sort_order: number;
  required_for_graduation: boolean;
  level?: {
    id: string;
    name: string;
  } | null;
}

interface Evaluation {
  id: string;
  swimmer_id: string;
  skill_id: string;
  achieved: boolean;
}

// Map skill_level enum to level names for filtering
const SKILL_LEVEL_MAP: Record<string, string> = {
  beginner: 'מתחילים',
  intermediate: 'מתקדמים',
  advanced: 'מתקדמים פלוס',
  competitive: 'תחרותי',
};

export function InlineSkillsEvaluation({ swimmers, classTypeId }: InlineSkillsEvaluationProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch skills with level info
  const { data: allSkills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['skills-with-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('skills')
        .select(`
          *,
          level:class_levels(id, name)
        `)
        .order('sort_order');

      if (error) throw error;
      return (data || []) as Skill[];
    },
  });

  // Fetch all evaluations for these swimmers
  const swimmerIds = swimmers.map(s => s.id);
  const { data: evaluations = [], isLoading: evaluationsLoading } = useQuery({
    queryKey: ['swimmer-evaluations-batch', swimmerIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('swimmer_evaluations')
        .select('id, swimmer_id, skill_id, achieved')
        .in('swimmer_id', swimmerIds);

      if (error) throw error;
      return (data || []) as Evaluation[];
    },
    enabled: swimmerIds.length > 0,
  });

  // Toggle skill mutation
  const toggleSkill = useMutation({
    mutationFn: async ({
      swimmerId,
      skillId,
      achieved,
    }: {
      swimmerId: string;
      skillId: string;
      achieved: boolean;
    }) => {
      const existingEval = evaluations.find(
        e => e.swimmer_id === swimmerId && e.skill_id === skillId
      );

      if (existingEval) {
        const { error } = await supabase
          .from('swimmer_evaluations')
          .update({
            achieved,
            achieved_at: achieved ? new Date().toISOString() : null,
            evaluated_by: user?.id,
          })
          .eq('id', existingEval.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('swimmer_evaluations')
          .insert({
            swimmer_id: swimmerId,
            skill_id: skillId,
            achieved,
            achieved_at: achieved ? new Date().toISOString() : null,
            evaluated_by: user?.id,
          });

        if (error) throw error;
      }

      return { achieved, skillId, swimmerId };
    },
    onSuccess: ({ achieved, skillId, swimmerId }) => {
      queryClient.invalidateQueries({ queryKey: ['swimmer-evaluations-batch', swimmerIds] });

      if (achieved) {
        const skill = allSkills.find(s => s.id === skillId);
        const swimmer = swimmers.find(s => s.id === swimmerId);
        
        // Check if required for graduation
        if (skill?.required_for_graduation) {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.7 },
          });
          toast.success(`🌟 ${swimmer?.first_name} השלים/ה מיומנות חובה: ${skill.name}!`);
        } else {
          toast.success(`${swimmer?.first_name}: ${skill?.name} ✓`);
        }
      }
    },
    onError: () => {
      toast.error('שגיאה בעדכון');
    },
  });

  const isSkillAchieved = (swimmerId: string, skillId: string) => {
    return evaluations.some(
      e => e.swimmer_id === swimmerId && e.skill_id === skillId && e.achieved
    );
  };

  const getSwimmerProgress = (swimmerId: string, levelSkills: Skill[]) => {
    const achieved = levelSkills.filter(s => isSkillAchieved(swimmerId, s.id)).length;
    return levelSkills.length > 0 ? Math.round((achieved / levelSkills.length) * 100) : 0;
  };

  // Get skills filtered by swimmer's level
  const getSkillsForSwimmer = (swimmer: typeof swimmers[0]) => {
    const levelName = SKILL_LEVEL_MAP[swimmer.skill_level || 'beginner'];
    return allSkills.filter(
      s => s.level?.name === levelName || !s.level_id
    );
  };

  if (skillsLoading || evaluationsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (swimmers.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <Star className="h-12 w-12 text-muted-foreground mb-3" />
          <p className="text-muted-foreground">אין משתתפים להערכת מיומנויות</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
        <Info className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          לחץ על מיומנות כדי לסמן השלמה. מוצגות רק המיומנויות הרלוונטיות לרמת כל שחיין.
        </p>
      </div>

      {swimmers.map(swimmer => {
        const swimmerSkills = getSkillsForSwimmer(swimmer);
        const progress = getSwimmerProgress(swimmer.id, swimmerSkills);

        return (
          <Card key={swimmer.id} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Swimmer Header */}
              <div className="flex items-center gap-3 p-4 bg-gradient-to-l from-primary/5 to-transparent border-b">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                  {swimmer.first_name?.[0]}{swimmer.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg">
                    {swimmer.first_name} {swimmer.last_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {SKILL_LEVEL_MAP[swimmer.skill_level || 'beginner'] || 'מתחיל'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {progress}% הושלם
                    </span>
                  </div>
                </div>
                <div className="w-16">
                  <Progress value={progress} className="h-2" />
                </div>
              </div>

              {/* Skills Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {swimmerSkills.length === 0 ? (
                  <p className="text-muted-foreground text-sm col-span-2">
                    אין מיומנויות מוגדרות לרמה זו
                  </p>
                ) : (
                  swimmerSkills.map(skill => {
                    const achieved = isSkillAchieved(swimmer.id, skill.id);
                    return (
                      <button
                        key={skill.id}
                        onClick={() =>
                          toggleSkill.mutate({
                            swimmerId: swimmer.id,
                            skillId: skill.id,
                            achieved: !achieved,
                          })
                        }
                        disabled={toggleSkill.isPending}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-lg border transition-all text-right w-full',
                          'active:scale-[0.98] touch-manipulation',
                          achieved
                            ? 'bg-green-50 border-green-400 dark:bg-green-950/40 dark:border-green-600'
                            : 'hover:bg-muted/50 border-muted'
                        )}
                      >
                        <Checkbox
                          checked={achieved}
                          className={cn(
                            'h-7 w-7 rounded-md pointer-events-none',
                            achieved && 'bg-green-600 border-green-600'
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <p
                            className={cn(
                              'font-medium truncate',
                              achieved && 'text-green-700 dark:text-green-300'
                            )}
                          >
                            {skill.name}
                          </p>
                          {skill.required_for_graduation && (
                            <Badge className="mt-1 bg-amber-500 text-[10px] px-1.5 py-0">
                              חובה
                            </Badge>
                          )}
                        </div>
                        {achieved && (
                          <Check className="h-5 w-5 text-green-600 shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
