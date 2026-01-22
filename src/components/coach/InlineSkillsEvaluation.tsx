import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Award, Loader2, Star, Info, Sparkles } from 'lucide-react';
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

const SKILL_LEVEL_MAP: Record<string, string> = {
  beginner: 'מתחילים',
  intermediate: 'מתקדמים',
  advanced: 'מתקדמים פלוס',
  competitive: 'תחרותי',
};

export function InlineSkillsEvaluation({ swimmers, classTypeId }: InlineSkillsEvaluationProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

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

  const getSkillsForSwimmer = (swimmer: typeof swimmers[0]) => {
    const levelName = SKILL_LEVEL_MAP[swimmer.skill_level || 'beginner'];
    return allSkills.filter(
      s => s.level?.name === levelName || !s.level_id
    );
  };

  if (skillsLoading || evaluationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">טוען מיומנויות...</p>
        </div>
      </div>
    );
  }

  if (swimmers.length === 0) {
    return (
      <Card className="border-dashed border-2 border-muted bg-muted/20 rounded-2xl">
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
            <Star className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">אין משתתפים להערכת מיומנויות</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center gap-2 p-4 bg-primary/5 rounded-2xl border border-primary/10">
        <Info className="h-5 w-5 text-primary shrink-0" />
        <p className="text-sm text-muted-foreground">
          לחץ על מיומנות כדי לסמן השלמה. מוצגות רק המיומנויות הרלוונטיות לרמת כל שחיין.
        </p>
      </div>

      {swimmers.map((swimmer, index) => {
        const swimmerSkills = getSkillsForSwimmer(swimmer);
        const progress = getSwimmerProgress(swimmer.id, swimmerSkills);
        const achievedCount = swimmerSkills.filter(s => isSkillAchieved(swimmer.id, s.id)).length;

        return (
          <Card 
            key={swimmer.id} 
            className="card-premium overflow-hidden rounded-2xl border-0 animate-slide-up"
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <CardContent className="p-0">
              {/* Swimmer Header */}
              <div className="flex items-center gap-4 p-5 bg-gradient-to-l from-primary/5 via-transparent to-transparent border-b border-border/50">
                <div className="w-14 h-14 rounded-2xl gradient-primary flex items-center justify-center text-lg font-bold text-primary-foreground shadow-glow">
                  {swimmer.first_name?.[0]}{swimmer.last_name?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg flex items-center gap-2">
                    {swimmer.first_name} {swimmer.last_name}
                    {progress === 100 && (
                      <Sparkles className="h-4 w-4 text-warning animate-pulse-soft" />
                    )}
                  </h3>
                  <div className="flex items-center gap-3 mt-1">
                    <Badge variant="secondary" className="text-xs">
                      {SKILL_LEVEL_MAP[swimmer.skill_level || 'beginner'] || 'מתחיל'}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {achievedCount}/{swimmerSkills.length} הושלמו
                    </span>
                  </div>
                </div>
                <div className="w-20 flex flex-col items-center gap-1">
                  <span className="text-xl font-bold text-primary">{progress}%</span>
                  <Progress value={progress} className="h-2 w-full" />
                </div>
              </div>

              {/* Skills Grid */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {swimmerSkills.length === 0 ? (
                  <p className="text-muted-foreground text-sm col-span-2 text-center py-4">
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
                          'flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-right w-full',
                          'active:scale-[0.98] touch-manipulation relative overflow-hidden',
                          achieved
                            ? 'bg-success/10 border-success/30'
                            : 'hover:bg-muted/50 border-muted hover:border-primary/30'
                        )}
                      >
                        {achieved && (
                          <div className="absolute inset-0 bg-shimmer bg-shimmer animate-shimmer opacity-10" />
                        )}
                        <Checkbox
                          checked={achieved}
                          className={cn(
                            'h-7 w-7 rounded-lg pointer-events-none relative z-10',
                            achieved && 'bg-success border-success text-success-foreground'
                          )}
                        />
                        <div className="flex-1 min-w-0 relative z-10">
                          <p
                            className={cn(
                              'font-medium truncate',
                              achieved && 'text-success'
                            )}
                          >
                            {skill.name}
                          </p>
                          {skill.required_for_graduation && (
                            <Badge className="mt-1.5 bg-warning text-warning-foreground text-[10px] px-2 py-0.5 gap-1">
                              <Award className="h-3 w-3" />
                              חובה
                            </Badge>
                          )}
                        </div>
                        {achieved && (
                          <div className="w-8 h-8 rounded-full bg-success flex items-center justify-center shrink-0 relative z-10">
                            <Check className="h-5 w-5 text-success-foreground" />
                          </div>
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
