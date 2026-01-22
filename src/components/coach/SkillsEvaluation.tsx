import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Award, Loader2, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import confetti from 'canvas-confetti';

interface SkillsEvaluationProps {
  swimmer: {
    id: string;
    first_name: string;
    last_name: string;
    skill_level?: string;
  };
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  level_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface Evaluation {
  id: string;
  swimmer_id: string;
  skill_id: string;
  achieved: boolean;
  achieved_at: string | null;
  evaluated_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function SkillsEvaluation({ swimmer }: SkillsEvaluationProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [levelUpAlert, setLevelUpAlert] = useState<{ show: boolean; skillName: string }>({
    show: false,
    skillName: '',
  });

  // Fetch all skills
  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['skills'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('skills' as any)
        .select('*')
        .order('sort_order') as any);

      if (error) throw error;
      return (data || []) as Skill[];
    },
  });

  // Fetch swimmer's evaluations
  const { data: evaluations = [], isLoading: evaluationsLoading } = useQuery({
    queryKey: ['swimmer-evaluations', swimmer.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('swimmer_evaluations' as any)
        .select('*')
        .eq('swimmer_id', swimmer.id) as any);

      if (error) throw error;
      return (data || []) as Evaluation[];
    },
    enabled: !!swimmer.id,
  });

  // Toggle skill mutation
  const toggleSkill = useMutation({
    mutationFn: async ({ skillId, achieved }: { skillId: string; achieved: boolean }) => {
      const existingEval = evaluations.find((e) => e.skill_id === skillId);

      if (existingEval) {
        const { error } = await (supabase
          .from('swimmer_evaluations' as any)
          .update({
            achieved,
            achieved_at: achieved ? new Date().toISOString() : null,
            evaluated_by: user?.id,
          } as any)
          .eq('id', existingEval.id) as any);

        if (error) throw error;
      } else {
        const { error } = await (supabase
          .from('swimmer_evaluations' as any)
          .insert({
            swimmer_id: swimmer.id,
            skill_id: skillId,
            achieved,
            achieved_at: achieved ? new Date().toISOString() : null,
            evaluated_by: user?.id,
          } as any) as any);

        if (error) throw error;
      }

      return { achieved, skillId };
    },
    onSuccess: ({ achieved, skillId }) => {
      queryClient.invalidateQueries({ queryKey: ['swimmer-evaluations', swimmer.id] });
      
      if (achieved) {
        const skill = skills.find((s) => s.id === skillId);
        const achievedCount = evaluations.filter((e) => e.achieved).length + 1;
        
        // Check for level up (every 4 skills)
        if (achievedCount > 0 && achievedCount % 4 === 0) {
          setLevelUpAlert({ show: true, skillName: skill?.name || '' });
          // Trigger confetti
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
          });
        } else {
          toast.success(`${swimmer.first_name} השלים/ה: ${skill?.name}`, {
            icon: <Star className="h-4 w-4 text-yellow-500" />,
          });
        }
      }
    },
    onError: () => {
      toast.error('שגיאה בעדכון המיומנות');
    },
  });

  const isSkillAchieved = (skillId: string) => {
    return evaluations.some((e) => e.skill_id === skillId && e.achieved);
  };

  const achievedCount = evaluations.filter((e) => e.achieved).length;
  const progressPercent = skills.length > 0 ? Math.round((achievedCount / skills.length) * 100) : 0;

  if (skillsLoading || evaluationsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      {/* Progress Header */}
      <Card className="bg-gradient-to-l from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              <span className="font-medium">התקדמות כללית</span>
            </div>
            <Badge variant="secondary" className="text-lg px-3">
              {achievedCount}/{skills.length}
            </Badge>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 rounded-full"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-sm text-muted-foreground mt-2 text-center">
            {progressPercent}% מהמיומנויות הושלמו
          </p>
        </CardContent>
      </Card>

      {/* Skills List */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500" />
            מיומנויות
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {skills.map((skill) => {
            const achieved = isSkillAchieved(skill.id);
            return (
              <div
                key={skill.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer',
                  achieved
                    ? 'bg-green-50 border-green-300 dark:bg-green-950/30 dark:border-green-700'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => toggleSkill.mutate({ skillId: skill.id, achieved: !achieved })}
              >
                <Checkbox
                  checked={achieved}
                  className={cn(
                    'h-6 w-6 rounded-full',
                    achieved && 'bg-green-600 border-green-600'
                  )}
                  onCheckedChange={(checked) =>
                    toggleSkill.mutate({ skillId: skill.id, achieved: !!checked })
                  }
                />
                <div className="flex-1">
                  <p className={cn('font-medium', achieved && 'text-green-700 dark:text-green-300')}>
                    {skill.name}
                  </p>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground">{skill.description}</p>
                  )}
                </div>
                {achieved && (
                  <Badge className="bg-green-600 gap-1">
                    <Check className="h-3 w-3" />
                    הושלם
                  </Badge>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Level Up Alert */}
      <AlertDialog open={levelUpAlert.show} onOpenChange={(open) => setLevelUpAlert({ ...levelUpAlert, show: open })}>
        <AlertDialogContent dir="rtl" className="text-center">
          <AlertDialogHeader>
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center animate-bounce">
                <Award className="h-10 w-10 text-white" />
              </div>
            </div>
            <AlertDialogTitle className="text-2xl">🎉 מזל טוב! עברת שלב! 🎉</AlertDialogTitle>
            <AlertDialogDescription className="text-lg">
              {swimmer.first_name} {swimmer.last_name} סיים/ה את המיומנות:
              <br />
              <strong className="text-primary">{levelUpAlert.skillName}</strong>
              <br />
              <br />
              המשיכו כך! 💪
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="justify-center">
            <AlertDialogAction className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-lg px-8">
              יאללה להמשיך!
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
