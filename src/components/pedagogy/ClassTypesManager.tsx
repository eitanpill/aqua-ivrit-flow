import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { BookOpen, Plus, Edit, Trash2, Clock, Users, Loader2 } from "lucide-react";

interface ClassType {
  id: string;
  name: string;
  description: string | null;
  duration_min: number;
  max_participants: number | null;
  level_id: string | null;
  level?: { name: string } | null;
}

interface ClassLevel {
  id: string;
  name: string;
}

export function ClassTypesManager() {
  const queryClient = useQueryClient();
  const { activeSchoolId } = useSchool();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ClassType | null>(null);
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration_min: 45,
    max_participants: 6,
    level_id: "",
  });

  // Fetch class types
  const { data: classTypes, isLoading } = useQuery({
    queryKey: ["class-types", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_types")
        .select("*, level:class_levels(name)")
        .eq("school_id", activeSchoolId)
        .order("name");
      
      if (error) throw error;
      return data as unknown as ClassType[];
    },
    enabled: !!activeSchoolId,
  });

  // Fetch class levels for dropdown
  const { data: levels } = useQuery({
    queryKey: ["class-levels", activeSchoolId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_levels")
        .select("id, name")
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
      if (editingType) {
        const { error } = await supabase
          .from("class_types")
          .update({
            name: form.name,
            description: form.description || null,
            duration_min: form.duration_min,
            max_participants: form.max_participants,
            level_id: form.level_id || null,
          })
          .eq("id", editingType.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_types")
          .insert({
            name: form.name,
            description: form.description || null,
            duration_min: form.duration_min,
            max_participants: form.max_participants,
            level_id: form.level_id || null,
            school_id: activeSchoolId,
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-types", activeSchoolId] });
      toast.success(editingType ? "סוג השיעור עודכן" : "סוג השיעור נוסף");
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
        .from("class_types")
        .delete()
        .eq("id", id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class-types", activeSchoolId] });
      toast.success("סוג השיעור נמחק");
    },
    onError: () => {
      toast.error("לא ניתן למחוק - קיימים שיעורים מסוג זה");
    },
  });

  const openCreate = () => {
    setEditingType(null);
    setForm({
      name: "",
      description: "",
      duration_min: 45,
      max_participants: 6,
      level_id: "",
    });
    setIsDialogOpen(true);
  };

  const openEdit = (type: ClassType) => {
    setEditingType(type);
    setForm({
      name: type.name,
      description: type.description || "",
      duration_min: type.duration_min,
      max_participants: type.max_participants || 6,
      level_id: type.level_id || "",
    });
    setIsDialogOpen(true);
  };

  const closeDialog = () => {
    setIsDialogOpen(false);
    setEditingType(null);
    setForm({
      name: "",
      description: "",
      duration_min: 45,
      max_participants: 6,
      level_id: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("שם השיעור הוא שדה חובה");
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            סוגי שיעורים
          </CardTitle>
          <CardDescription>
            הגדרת סוגי השיעורים, משך ומספר משתתפים
          </CardDescription>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary gap-2" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              הוסף סוג
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingType ? "עריכת סוג שיעור" : "הוספת סוג שיעור"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>שם סוג השיעור *</Label>
                <Input
                  placeholder='לדוגמה: "שיעור פרטי", "קבוצה קטנה"'
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>תיאור</Label>
                <Textarea
                  placeholder="תיאור קצר של סוג השיעור"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    משך (דקות)
                  </Label>
                  <Input
                    type="number"
                    min="15"
                    step="5"
                    value={form.duration_min}
                    onChange={(e) => setForm({ ...form, duration_min: parseInt(e.target.value) || 45 })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    מקסימום משתתפים
                  </Label>
                  <Input
                    type="number"
                    min="1"
                    value={form.max_participants}
                    onChange={(e) => setForm({ ...form, max_participants: parseInt(e.target.value) || 6 })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>רמה מקושרת</Label>
                <Select
                  value={form.level_id}
                  onValueChange={(value) => setForm({ ...form, level_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="בחר רמה (אופציונלי)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">ללא רמה</SelectItem>
                    {levels?.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  {editingType ? "שמור שינויים" : "הוסף"}
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
        ) : !classTypes?.length ? (
          <div className="text-center py-8">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">אין סוגי שיעורים במערכת</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם</TableHead>
                <TableHead className="text-right">משך</TableHead>
                <TableHead className="text-right">מקס׳ משתתפים</TableHead>
                <TableHead className="text-right">רמה</TableHead>
                <TableHead className="text-right">פעולות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell className="font-medium">{type.name}</TableCell>
                  <TableCell>{type.duration_min} דק׳</TableCell>
                  <TableCell>{type.max_participants || "-"}</TableCell>
                  <TableCell>{type.level?.name || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(type)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(type.id)}
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
