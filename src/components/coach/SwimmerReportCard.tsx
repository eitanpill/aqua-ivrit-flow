import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  Award, 
  TrendingUp, 
  Star, 
  CheckCircle2, 
  XCircle,
  ArrowUp,
  Minus,
  Loader2,
  Download
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SwimmerReportCardProps {
  swimmerId: string;
  swimmerName: string;
  onClose?: () => void;
}

interface SkillReport {
  id: string;
  name: string;
  description: string | null;
  required_for_graduation: boolean;
  sort_order: number;
  achieved: boolean;
  achieved_at: string | null;
  notes: string | null;
}

interface ReportData {
  success: boolean;
  swimmer: {
    id: string;
    name: string;
    level: string | null;
  };
  skills: SkillReport[] | null;
  summary: {
    achieved: number;
    total: number;
    required_achieved: number;
    required_total: number;
    percentage: number;
  };
  recommendation: 'move_up' | 'stay';
}

export function SwimmerReportCard({ swimmerId, swimmerName, onClose }: SwimmerReportCardProps) {
  const { data: report, isLoading, error } = useQuery({
    queryKey: ['swimmer-report', swimmerId],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as any)('get_swimmer_report', {
        p_swimmer_id: swimmerId,
      });

      if (error) throw error;
      return data as unknown as ReportData;
    },
    enabled: !!swimmerId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report?.success) {
    return (
      <Card className="border-destructive">
        <CardContent className="py-8 text-center">
          <XCircle className="h-12 w-12 text-destructive mx-auto mb-3" />
          <p className="text-destructive">שגיאה בטעינת הדוח</p>
        </CardContent>
      </Card>
    );
  }

  const skills = report.skills || [];
  const requiredSkills = skills.filter(s => s.required_for_graduation);
  const regularSkills = skills.filter(s => !s.required_for_graduation);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Report Header */}
      <Card className="bg-gradient-to-l from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                <FileText className="h-7 w-7 text-primary-foreground" />
              </div>
              <div>
                <h2 className="text-xl font-bold">דוח סוף תקופה</h2>
                <p className="text-muted-foreground">{swimmerName}</p>
              </div>
            </div>
            <Badge variant="outline" className="text-sm">
              {format(new Date(), 'MM/yyyy')}
            </Badge>
          </div>

          {/* Progress Summary */}
          <div className="bg-background/60 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">התקדמות כללית</span>
              <span className="text-2xl font-bold text-primary">
                {report.summary.percentage}%
              </span>
            </div>
            <Progress value={report.summary.percentage} className="h-3" />
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{report.summary.achieved} מיומנויות הושלמו</span>
              <span>{report.summary.total - report.summary.achieved} נותרו</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recommendation Card */}
      <Card className={cn(
        'border-2',
        report.recommendation === 'move_up' 
          ? 'border-green-500 bg-green-50 dark:bg-green-950/20'
          : 'border-amber-500 bg-amber-50 dark:bg-amber-950/20'
      )}>
        <CardContent className="py-4">
          <div className="flex items-center gap-4">
            <div className={cn(
              'w-12 h-12 rounded-full flex items-center justify-center',
              report.recommendation === 'move_up'
                ? 'bg-green-500'
                : 'bg-amber-500'
            )}>
              {report.recommendation === 'move_up' ? (
                <ArrowUp className="h-6 w-6 text-white" />
              ) : (
                <Minus className="h-6 w-6 text-white" />
              )}
            </div>
            <div>
              <h3 className="font-bold text-lg">
                {report.recommendation === 'move_up' 
                  ? 'המלצה: מעבר לרמה הבאה! 🎉'
                  : 'המלצה: המשך ברמה הנוכחית'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {report.recommendation === 'move_up'
                  ? `השלים/ה ${report.summary.required_achieved}/${report.summary.required_total} מיומנויות חובה`
                  : 'יש להשלים עוד מיומנויות לפני מעבר'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Required Skills */}
      {requiredSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              מיומנויות חובה למעבר
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requiredSkills.map((skill) => (
              <div
                key={skill.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  skill.achieved
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                    : 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800'
                )}
              >
                {skill.achieved ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="font-medium">{skill.name}</p>
                  {skill.description && (
                    <p className="text-sm text-muted-foreground">{skill.description}</p>
                  )}
                </div>
                {skill.achieved && skill.achieved_at && (
                  <Badge variant="secondary" className="text-xs">
                    {format(new Date(skill.achieved_at), 'dd/MM')}
                  </Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Regular Skills */}
      {regularSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              מיומנויות נוספות
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {regularSkills.map((skill) => (
              <div
                key={skill.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border',
                  skill.achieved
                    ? 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800'
                    : 'bg-muted/50'
                )}
              >
                {skill.achieved ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className={cn('font-medium', !skill.achieved && 'text-muted-foreground')}>
                    {skill.name}
                  </p>
                </div>
                {skill.achieved && (
                  <Badge className="bg-green-600 text-xs">הושלם</Badge>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" className="flex-1 gap-2" disabled>
          <Download className="h-4 w-4" />
          הורדת דוח PDF
        </Button>
        {onClose && (
          <Button variant="secondary" onClick={onClose}>
            סגור
          </Button>
        )}
      </div>
    </div>
  );
}
