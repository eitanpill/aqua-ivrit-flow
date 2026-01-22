import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit, Trash2, Calendar, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { format, differenceInYears } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const SKILL_LEVELS = {
  beginner: 'מתחיל',
  intermediate: 'בינוני',
  advanced: 'מתקדם',
  competitive: 'תחרותי',
};

const GENDER_OPTIONS = {
  male: 'זכר',
  female: 'נקבה',
  other: 'אחר',
};

export default function MyFamily() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingSwimmer, setEditingSwimmer] = useState<any>(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    birth_date: '',
    gender: '',
    skill_level: 'beginner',
    medical_notes: '',
  });

  // Fetch swimmers
  const { data: swimmers = [], isLoading } = useQuery({
    queryKey: ['my-swimmers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('swimmers')
        .select('*')
        .eq('parent_id', user?.id)
        .order('first_name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Fetch wallet
  const { data: wallet } = useQuery({
    queryKey: ['my-wallet', user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from('customer_wallets' as any)
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle() as any);

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Add swimmer mutation
  const addSwimmer = useMutation({
    mutationFn: async (data: typeof formData) => {
      const { error } = await supabase
        .from('swimmers')
        .insert({
          ...data,
          parent_id: user?.id,
          birth_date: data.birth_date || null,
          gender: data.gender || null,
        } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-swimmers'] });
      toast.success('הילד נוסף בהצלחה!');
      setIsAddDialogOpen(false);
      resetForm();
    },
    onError: () => {
      toast.error('שגיאה בהוספת הילד');
    },
  });

  // Update swimmer mutation
  const updateSwimmer = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const { error } = await supabase
        .from('swimmers')
        .update({
          ...data,
          birth_date: data.birth_date || null,
          gender: data.gender || null,
        } as any)
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-swimmers'] });
      toast.success('הפרטים עודכנו בהצלחה!');
      setEditingSwimmer(null);
      resetForm();
    },
    onError: () => {
      toast.error('שגיאה בעדכון הפרטים');
    },
  });

  // Delete swimmer mutation
  const deleteSwimmer = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('swimmers')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-swimmers'] });
      toast.success('הילד הוסר בהצלחה');
    },
    onError: () => {
      toast.error('שגיאה בהסרת הילד');
    },
  });

  const resetForm = () => {
    setFormData({
      first_name: '',
      last_name: '',
      birth_date: '',
      gender: '',
      skill_level: 'beginner',
      medical_notes: '',
    });
  };

  const handleEdit = (swimmer: any) => {
    setEditingSwimmer(swimmer);
    setFormData({
      first_name: swimmer.first_name,
      last_name: swimmer.last_name,
      birth_date: swimmer.birth_date || '',
      gender: swimmer.gender || '',
      skill_level: swimmer.skill_level || 'beginner',
      medical_notes: swimmer.medical_notes || '',
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSwimmer) {
      updateSwimmer.mutate({ id: editingSwimmer.id, data: formData });
    } else {
      addSwimmer.mutate(formData);
    }
  };

  const calculateAge = (birthDate: string) => {
    if (!birthDate) return null;
    return differenceInYears(new Date(), new Date(birthDate));
  };

  const SwimmerForm = () => (
    <form onSubmit={handleSubmit} className="space-y-4" dir="rtl">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="first_name">שם פרטי *</Label>
          <Input
            id="first_name"
            value={formData.first_name}
            onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_name">שם משפחה *</Label>
          <Input
            id="last_name"
            value={formData.last_name}
            onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
            required
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="birth_date">תאריך לידה</Label>
          <Input
            id="birth_date"
            type="date"
            value={formData.birth_date}
            onChange={(e) => setFormData({ ...formData, birth_date: e.target.value })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="gender">מגדר</Label>
          <Select
            value={formData.gender}
            onValueChange={(value) => setFormData({ ...formData, gender: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="בחר מגדר" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(GENDER_OPTIONS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="skill_level">רמת שחייה</Label>
        <Select
          value={formData.skill_level}
          onValueChange={(value) => setFormData({ ...formData, skill_level: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="בחר רמה" />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(SKILL_LEVELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="medical_notes">הערות רפואיות</Label>
        <Textarea
          id="medical_notes"
          value={formData.medical_notes}
          onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
          placeholder="אלרגיות, מגבלות רפואיות..."
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" disabled={addSwimmer.isPending || updateSwimmer.isPending}>
          {editingSwimmer ? 'עדכן פרטים' : 'הוסף ילד'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setEditingSwimmer(null);
            setIsAddDialogOpen(false);
            resetForm();
          }}
        >
          ביטול
        </Button>
      </div>
    </form>
  );

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Users className="h-8 w-8 text-primary" />
            המשפחה שלי
          </h1>
          <p className="text-muted-foreground mt-1">
            ניהול הילדים והרשמה לשיעורים
          </p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => navigate('/booking')} variant="outline" className="gap-2">
            <Calendar className="h-4 w-4" />
            הרשמה לשיעורים
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                הוסף ילד
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]" dir="rtl">
              <DialogHeader>
                <DialogTitle>הוספת ילד חדש</DialogTitle>
              </DialogHeader>
              <SwimmerForm />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Wallet Card */}
      <Card className="bg-gradient-to-l from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            הארנק שלי
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-primary">
              {wallet?.credits_balance ?? 0}
            </span>
            <span className="text-muted-foreground">קרדיטים זמינים</span>
          </div>
        </CardContent>
      </Card>

      {/* Children Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="h-48" />
            </Card>
          ))}
        </div>
      ) : swimmers.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">עדיין לא הוספת ילדים</h3>
            <p className="text-muted-foreground mb-4">
              הוסף את הילדים שלך כדי להתחיל להירשם לשיעורים
            </p>
            <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              הוסף ילד ראשון
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {swimmers.map((swimmer: any) => {
            const age = calculateAge(swimmer.birth_date);
            return (
              <Card key={swimmer.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">
                        {swimmer.first_name} {swimmer.last_name}
                      </CardTitle>
                      <CardDescription>
                        {age !== null && `גיל ${age}`}
                        {swimmer.gender && ` • ${GENDER_OPTIONS[swimmer.gender as keyof typeof GENDER_OPTIONS]}`}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">
                      {SKILL_LEVELS[swimmer.skill_level as keyof typeof SKILL_LEVELS] || 'מתחיל'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {swimmer.medical_notes && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {swimmer.medical_notes}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <Dialog
                      open={editingSwimmer?.id === swimmer.id}
                      onOpenChange={(open) => !open && setEditingSwimmer(null)}
                    >
                      <DialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-1"
                          onClick={() => handleEdit(swimmer)}
                        >
                          <Edit className="h-3 w-3" />
                          עריכה
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-[500px]" dir="rtl">
                        <DialogHeader>
                          <DialogTitle>עריכת פרטי ילד</DialogTitle>
                        </DialogHeader>
                        <SwimmerForm />
                      </DialogContent>
                    </Dialog>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-destructive gap-1">
                          <Trash2 className="h-3 w-3" />
                          הסרה
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                          <AlertDialogTitle>האם להסיר את {swimmer.first_name}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            פעולה זו תמחק את הילד וכל ההרשמות שלו לשיעורים.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex gap-2">
                          <AlertDialogCancel>ביטול</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteSwimmer.mutate(swimmer.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            הסר ילד
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
