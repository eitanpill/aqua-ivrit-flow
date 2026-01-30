import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { GraduationCap, Plus, Edit, Trash2, Loader2 } from "lucide-react";

interface ClassLevel {
  id: string;
  name: string;
  description: string | null;
  min_age: number | null;
  max_age: number | null;
  sort_order: number | null;
}

export function ClassLevelsManager() {
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<ClassLevel | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    min_age: "",
    max_age: "",
    sort_order: 0,
  });

  // Fetch class levels
  const { data: levels, isLoading } = useQuery({
    queryKey: ["class-levels-full", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_levels")
        .select("*")
        .eq("school_id", activeSchoolId)
        .order("sort_order");
      
      if (error) throw error;
      return data as ClassLevel[];
    },
    enabled: !!activeSchoolId,
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name,
        description: form.description || null,
        min_age: form.min_age ? parseInt(form.min_age) : null,
        max_age: form.max_age ? parseInt(form.max_age) : null,
        sort_order: form.sort_order,
      };

      if (editingLevel) {
        const { error } = await supabase
          .from("class_levels")
          .update(payload)
          .eq("id", editingLevel.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_levels")
          .insert({
            ...payload,
            school_id: activeSchoolId,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-levels-full", activeSchoolId] });
      queryClient.invalidateQueries({ queryKey: ["class_levels", activeSchoolId] });
      toast.success(editingLevel ? "הרמה עודכנה" : "הרמה נוספה");
      closeDialog();
    },
    onError: () => {
      toast.error("שגיאה בשמירה");
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("class_levels")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-levels-full", activeSchoolId] });
      queryClient.invalidateQueries({ queryKey: ["class_levels", activeSchoolId] });
      toast.success("הרמה נמחקה");
    },
    onError: () => {
      toast.error("לא ניתן למחוק - קיימים שיעורים או מיומנויות ברמה זו");
    },
  });

  const openCreate = () => {
    setEditingLevel(null);
    setForm({
      name: "",
      description: "",
      min_age: "",
      max_age: "",
      sort_order: (levels?.length || 0) + 1,
    });
    setIsDialogOpen(true);
  };

  const openEdit = (level: ClassLevel) => {
    setEditingLevel(level);
    setForm({
      name: level.name,
      description: level.description || "",
      min_age: level.min_age?.toString() || "",
      max_age: level.max_age?.toString() || "",
      sort_order: level.sort_order || 0,
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingLevel(null);
    setForm({
      name: "",
      description: "",
      min_age: "",
      max_age: "",
      sort_order: 0,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("שם הרמה הוא שדה חובה");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            רמות לימוד
          </CardTitle>
          <CardDescription>
            הגדרת רמות וטווחי גילאים
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              הוסף רמה
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingLevel ? "עריכת רמה" : "הוספת רמה"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>שם הרמה *</Label>
                <Input
                  placeholder='לדוגמה: "הסתגלות", "כריש"'
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>תיאור</Label>
                <Textarea
                  placeholder="תיאור הרמה ודרישות"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>גיל מינימום</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="לדוגמה: 4"
                    value={form.min_age}
                    onChange={(e) => setForm({ ...form, min_age: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label>גיל מקסימום</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="לדוגמה: 7"
                    value={form.max_age}
                    onChange={(e) => setForm({ ...form, max_age: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>סדר מיון</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="submit"
                  className="flex-1 gradient-primary"
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  ) : null}
                  {editingLevel ? "שמור שינויים" : "הוסף"}
                </Button>
                <Button type="button" variant="outline" onClick={closeDialog}>
                  ביטול
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !levels?.length ? (
          <div className="text-center py-8">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">אין רמות לימוד במערכת</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">תיאור</TableHead>
                <TableHead className="text-right">טווח גילאים</TableHead>
                <TableHead className="text-right">סדר</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {levels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell className="font-medium">{level.name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{level.description || "-"}</TableCell>
                  <TableCell>
                    {level.min_age || level.max_age
                      ? `${level.min_age || "?"}-${level.max_age || "?"}`
                      : "-"}
                  </TableCell>
                  <TableCell>{level.sort_order}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(level)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(level.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
