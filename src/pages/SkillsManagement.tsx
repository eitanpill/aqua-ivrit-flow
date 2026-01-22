import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Award, 
  Plus, 
  Trash2, 
  Edit2, 
  Star, 
  GripVertical,
  Loader2,
  Save,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/empty-state';

interface Skill {
  id: string;
  name: string;
  description: string | null;
  level_id: string | null;
  sort_order: number | null;
  required_for_graduation: boolean;
  created_at: string;
  updated_at: string;
}

interface ClassLevel {
  id: string;
  name: string;
}

export default function SkillsManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  
  // Form state
  const [skillName, setSkillName] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [skillLevelId, setSkillLevelId] = useState<string>('');
  const [isRequired, setIsRequired] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  // Fetch skills
  const { data: skills = [], isLoading: skillsLoading } = useQuery({
    queryKey: ['skills-management'],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('skills' as any)
        .select('*')
        .order('sort_order') as any);

      if (error) throw error;
      return (data || []) as Skill[];
    },
  });

  // Fetch class levels
  const { data: levels = [] } = useQuery({
    queryKey: ['class-levels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_levels')
        .select('id, name')
        .order('sort_order');

      if (error) throw error;
      return (data || []) as ClassLevel[];
    },
  });

  // Create skill mutation
  const createSkillMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase
        .from('skills' as any)
        .insert({
          name: skillName,
          description: skillDescription || null,
          level_id: skillLevelId || null,
          required_for_graduation: isRequired,
          sort_order: sortOrder,
        } as any) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills-management'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('המיומנות נוספה בהצלחה');
      resetForm();
      setDialogOpen(false);
    },
    onError: () => {
      toast.error('שגיאה בהוספת המיומנות');
    },
  });

  // Update skill mutation
  const updateSkillMutation = useMutation({
    mutationFn: async () => {
      if (!editingSkill) return;
      
      const { error } = await (supabase
        .from('skills' as any)
        .update({
          name: skillName,
          description: skillDescription || null,
          level_id: skillLevelId || null,
          required_for_graduation: isRequired,
          sort_order: sortOrder,
        } as any)
        .eq('id', editingSkill.id) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills-management'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('המיומנות עודכנה בהצלחה');
      resetForm();
      setDialogOpen(false);
    },
    onError: () => {
      toast.error('שגיאה בעדכון המיומנות');
    },
  });

  // Delete skill mutation
  const deleteSkillMutation = useMutation({
    mutationFn: async (skillId: string) => {
      const { error } = await (supabase
        .from('skills' as any)
        .delete()
        .eq('id', skillId) as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['skills-management'] });
      queryClient.invalidateQueries({ queryKey: ['skills'] });
      toast.success('המיומנות נמחקה');
    },
    onError: () => {
      toast.error('שגיאה במחיקת המיומנות');
    },
  });

  const resetForm = () => {
    setSkillName('');
    setSkillDescription('');
    setSkillLevelId('');
    setIsRequired(false);
    setSortOrder(skills.length);
    setEditingSkill(null);
  };

  const openEditDialog = (skill: Skill) => {
    setEditingSkill(skill);
    setSkillName(skill.name);
    setSkillDescription(skill.description || '');
    setSkillLevelId(skill.level_id || '');
    setIsRequired(skill.required_for_graduation);
    setSortOrder(skill.sort_order || 0);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setSortOrder(skills.length);
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!skillName.trim()) {
      toast.error('נא להזין שם מיומנות');
      return;
    }

    if (editingSkill) {
      updateSkillMutation.mutate();
    } else {
      createSkillMutation.mutate();
    }
  };

  const getLevelName = (levelId: string | null) => {
    if (!levelId) return null;
    const level = levels.find(l => l.id === levelId);
    return level?.name;
  };

  // Group skills by level
  const skillsByLevel = skills.reduce((acc, skill) => {
    const levelId = skill.level_id || 'general';
    if (!acc[levelId]) {
      acc[levelId] = [];
    }
    acc[levelId].push(skill);
    return acc;
  }, {} as Record<string, Skill[]>);

  if (skillsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8 text-primary" />
            ניהול מיומנויות
          </h1>
          <p className="text-muted-foreground mt-1">
            הגדר מיומנויות ודרישות מעבר לכל רמה
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog} className="gap-2">
              <Plus className="h-4 w-4" />
              מיומנות חדשה
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl" className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingSkill ? 'עריכת מיומנות' : 'מיומנות חדשה'}
              </DialogTitle>
              <DialogDescription>
                {editingSkill ? 'ערוך את פרטי המיומנות' : 'הוסף מיומנות חדשה למערכת'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="skill-name">שם המיומנות *</Label>
                <Input
                  id="skill-name"
                  value={skillName}
                  onChange={(e) => setSkillName(e.target.value)}
                  placeholder="לדוגמה: צפה על הגב"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="skill-description">תיאור</Label>
                <Textarea
                  id="skill-description"
                  value={skillDescription}
                  onChange={(e) => setSkillDescription(e.target.value)}
                  placeholder="תיאור מפורט של המיומנות..."
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>רמה</Label>
                <Select value={skillLevelId || "general"} onValueChange={(val) => setSkillLevelId(val === "general" ? "" : val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר רמה (אופציונלי)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">כללי</SelectItem>
                    {levels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort-order">סדר מיון</Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
                  min={0}
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                <Checkbox
                  id="required"
                  checked={isRequired}
                  onCheckedChange={(checked) => setIsRequired(!!checked)}
                />
                <div>
                  <Label htmlFor="required" className="font-medium flex items-center gap-1">
                    <Star className="h-4 w-4 text-amber-500" />
                    חובה למעבר רמה
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    מיומנות זו נדרשת לקידום לרמה הבאה
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                ביטול
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createSkillMutation.isPending || updateSkillMutation.isPending}
              >
                {(createSkillMutation.isPending || updateSkillMutation.isPending) ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Save className="h-4 w-4 ml-2" />
                    {editingSkill ? 'עדכן' : 'הוסף'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Skills List */}
      {skills.length === 0 ? (
        <EmptyState
          icon={Award}
          title="לא הוגדרו עדיין מיומנויות שחייה"
          description="התחל להוסיף מיומנויות למעקב התקדמות השחיינים"
          actionLabel="הוסף מיומנות ראשונה"
          onAction={openCreateDialog}
        />
      ) : (
        <div className="space-y-6">
          {/* General Skills */}
          {skillsByLevel['general']?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">מיומנויות כלליות</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {skillsByLevel['general'].map((skill) => (
                  <SkillRow
                    key={skill.id}
                    skill={skill}
                    onEdit={() => openEditDialog(skill)}
                    onDelete={() => deleteSkillMutation.mutate(skill.id)}
                    isDeleting={deleteSkillMutation.isPending}
                  />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Skills by Level */}
          {levels.map((level) => {
            const levelSkills = skillsByLevel[level.id];
            if (!levelSkills?.length) return null;

            return (
              <Card key={level.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Badge variant="outline">{level.name}</Badge>
                    <span className="text-sm font-normal text-muted-foreground">
                      ({levelSkills.length} מיומנויות)
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {levelSkills.map((skill) => (
                    <SkillRow
                      key={skill.id}
                      skill={skill}
                      onEdit={() => openEditDialog(skill)}
                      onDelete={() => deleteSkillMutation.mutate(skill.id)}
                      isDeleting={deleteSkillMutation.isPending}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Skill row component
function SkillRow({
  skill,
  onEdit,
  onDelete,
  isDeleting,
}: {
  skill: Skill;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
      
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{skill.name}</span>
          {skill.required_for_graduation && (
            <Badge className="bg-amber-500 text-xs gap-1">
              <Star className="h-3 w-3" />
              חובה
            </Badge>
          )}
        </div>
        {skill.description && (
          <p className="text-sm text-muted-foreground">{skill.description}</p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Edit2 className="h-4 w-4" />
        </Button>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent dir="rtl">
            <AlertDialogHeader>
              <AlertDialogTitle>מחיקת מיומנות</AlertDialogTitle>
              <AlertDialogDescription>
                האם אתה בטוח שברצונך למחוק את המיומנות "{skill.name}"?
                פעולה זו תמחק גם את כל ההערכות הקשורות.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>ביטול</AlertDialogCancel>
              <AlertDialogAction
                onClick={onDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'מחק'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
