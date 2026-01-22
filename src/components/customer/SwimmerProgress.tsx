import { useQuery } from '@tanstack/react-query';
import { Award, Star, TrendingUp, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface SwimmerProgressProps {
  swimmerId: string;
  swimmerName: string;
  compact?: boolean;
}

interface Skill {
  id: string;
  name: string;
  description: string | null;
  level_id: string | null;
  sort_order: number;
}

interface EvaluationWithSkill {
  id: string;
  swimmer_id: string;
  skill_id: string;
  achieved: boolean;
  skill?: Skill;
}

export function SwimmerProgress({ swimmerId, swimmerName, compact = false }: SwimmerProgressProps) {
  // Fetch all skills
  const { data: skills = [] } = useQuery({
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
  const { data: evaluations = [] } = useQuery({
    queryKey: ['swimmer-evaluations', swimmerId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('swimmer_evaluations' as any)
        .select('*, skill:skills(*)')
        .eq('swimmer_id', swimmerId)
        .eq('achieved', true) as any);

      if (error) throw error;
      return (data || []) as EvaluationWithSkill[];
    },
    enabled: !!swimmerId,
  });

  const achievedCount = evaluations.length;
  const totalSkills = skills.length;
  const progressPercent = totalSkills > 0 ? Math.round((achievedCount / totalSkills) * 100) : 0;

  // Get achieved skill names for tooltip
  const achievedSkillNames = evaluations.map((e) => e.skill?.name).filter(Boolean) as string[];
  const remainingSkillNames = skills
    .filter((s) => !evaluations.some((e) => e.skill_id === s.id))
    .map((s) => s.name);

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1 text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  התקדמות
                </span>
                <Badge variant="secondary" className="text-xs">
                  {achievedCount}/{totalSkills}
                </Badge>
              </div>
              <Progress value={progressPercent} className="h-2" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs text-right" dir="rtl">
            <div className="space-y-2">
              <p className="font-medium">ההתקדמות של {swimmerName}</p>
              {achievedSkillNames.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">מיומנויות שהושלמו:</p>
                  <div className="flex flex-wrap gap-1">
                    {achievedSkillNames.slice(0, 5).map((name, i) => (
                      <Badge key={i} variant="secondary" className="text-xs bg-green-100 text-green-800">
                        {name}
                      </Badge>
                    ))}
                    {achievedSkillNames.length > 5 && (
                      <Badge variant="secondary" className="text-xs">
                        +{achievedSkillNames.length - 5} עוד
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className="border-primary/20" dir="rtl">
      <CardContent className="pt-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Award className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h3 className="font-bold">ההתקדמות שלי</h3>
              <p className="text-sm text-muted-foreground">{swimmerName}</p>
            </div>
          </div>
          <div className="text-left">
            <span className="text-3xl font-bold text-primary">{progressPercent}%</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progressPercent} className="h-4" />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{achievedCount} מיומנויות הושלמו</span>
            <span>{totalSkills - achievedCount} נותרו</span>
          </div>
        </div>

        {/* Achieved Skills */}
        {achievedSkillNames.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-1">
              <Star className="h-4 w-4 text-yellow-500" />
              מיומנויות שהושלמו
            </h4>
            <div className="flex flex-wrap gap-2">
              {achievedSkillNames.map((name, i) => (
                <Badge
                  key={i}
                  className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Remaining Skills */}
        {remainingSkillNames.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">מיומנויות הבאות</h4>
            <div className="flex flex-wrap gap-2">
              {remainingSkillNames.slice(0, 4).map((name, i) => (
                <Badge key={i} variant="outline" className="text-muted-foreground">
                  {name}
                </Badge>
              ))}
              {remainingSkillNames.length > 4 && (
                <Badge variant="outline" className="text-muted-foreground">
                  +{remainingSkillNames.length - 4} עוד
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
