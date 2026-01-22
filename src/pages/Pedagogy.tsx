import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, GraduationCap, CalendarDays, Edit, Trash2, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { he } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Season {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  active: boolean;
}

interface ClassLevel {
  id: string;
  name: string;
  description: string | null;
  sort_order: number | null;
}

export default function Pedagogy() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Seasons state
  const [isSeasonDialogOpen, setIsSeasonDialogOpen] = useState(false);
  const [seasonForm, setSeasonForm] = useState({
    name: "",
    start_date: undefined as Date | undefined,
    end_date: undefined as Date | undefined,
    active: false,
  });

  // Levels state
  const [isLevelDialogOpen, setIsLevelDialogOpen] = useState(false);
  const [levelForm, setLevelForm] = useState({
    name: "",
    description: "",
    sort_order: 0,
  });

  // Fetch seasons
  const { data: seasons, isLoading: seasonsLoading } = useQuery({
    queryKey: ["seasons"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("seasons" as any)
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Season[];
    },
  });

  // Fetch class levels
  const { data: levels, isLoading: levelsLoading } = useQuery({
    queryKey: ["class_levels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_levels" as any)
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as unknown as ClassLevel[];
    },
  });

  // Create season mutation
  const createSeasonMutation = useMutation({
    mutationFn: async (newSeason: { name: string; start_date: string; end_date: string; active: boolean }) => {
      const { error } = await supabase.from("seasons" as any).insert([newSeason]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      setIsSeasonDialogOpen(false);
      setSeasonForm({ name: "", start_date: undefined, end_date: undefined, active: false });
      toast({ title: "העונה נוספה בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  // Delete season mutation
  const deleteSeasonMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seasons" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["seasons"] });
      toast({ title: "העונה נמחקה בהצלחה" });
    },
  });

  // Create level mutation
  const createLevelMutation = useMutation({
    mutationFn: async (newLevel: { name: string; description: string; sort_order: number }) => {
      const { error } = await supabase.from("class_levels" as any).insert([newLevel]);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_levels"] });
      setIsLevelDialogOpen(false);
      setLevelForm({ name: "", description: "", sort_order: 0 });
      toast({ title: "הרמה נוספה בהצלחה" });
    },
    onError: (error: Error) => {
      toast({ title: "שגיאה", description: error.message, variant: "destructive" });
    },
  });

  // Delete level mutation
  const deleteLevelMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("class_levels" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_levels"] });
      toast({ title: "הרמה נמחקה בהצלחה" });
    },
  });

  const handleSeasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!seasonForm.name.trim() || !seasonForm.start_date || !seasonForm.end_date) {
      toast({ title: "שגיאה", description: "יש למלא את כל השדות הנדרשים", variant: "destructive" });
      return;
    }
    createSeasonMutation.mutate({
      name: seasonForm.name,
      start_date: format(seasonForm.start_date, "yyyy-MM-dd"),
      end_date: format(seasonForm.end_date, "yyyy-MM-dd"),
      active: seasonForm.active,
    });
  };

  const handleLevelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelForm.name.trim()) {
      toast({ title: "שגיאה", description: "שם הרמה הוא שדה חובה", variant: "destructive" });
      return;
    }
    createLevelMutation.mutate(levelForm);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">הגדרות פדגוגיות</h1>
        <p className="text-muted-foreground mt-1">ניהול רמות לימוד ועונות פעילות</p>
      </div>

      <Tabs defaultValue="levels" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="levels" className="gap-2">
            <GraduationCap className="h-4 w-4" />
            רמות לימוד
          </TabsTrigger>
          <TabsTrigger value="seasons" className="gap-2">
            <CalendarDays className="h-4 w-4" />
            עונות פעילות
          </TabsTrigger>
        </TabsList>

        {/* Class Levels Tab */}
        <TabsContent value="levels" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                רמות לימוד
              </CardTitle>
              <Dialog open={isLevelDialogOpen} onOpenChange={setIsLevelDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף רמה
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>הוספת רמה חדשה</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLevelSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="level-name">שם הרמה *</Label>
                      <Input
                        id="level-name"
                        placeholder='לדוגמה: "הסתגלות", "כריש"'
                        value={levelForm.name}
                        onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level-desc">תיאור</Label>
                      <Textarea
                        id="level-desc"
                        placeholder="תיאור הרמה ודרישות"
                        value={levelForm.description}
                        onChange={(e) => setLevelForm({ ...levelForm, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="level-order">סדר מיון</Label>
                      <Input
                        id="level-order"
                        type="number"
                        placeholder="0"
                        value={levelForm.sort_order}
                        onChange={(e) => setLevelForm({ ...levelForm, sort_order: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1 gradient-primary" disabled={createLevelMutation.isPending}>
                        {createLevelMutation.isPending ? "מוסיף..." : "הוסף"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsLevelDialogOpen(false)}>
                        ביטול
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {levelsLoading ? (
                <div className="text-center py-8 text-muted-foreground">טוען...</div>
              ) : levels && levels.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם הרמה</TableHead>
                      <TableHead className="text-right">תיאור</TableHead>
                      <TableHead className="text-right">סדר</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levels.map((level) => (
                      <TableRow key={level.id}>
                        <TableCell className="font-medium">{level.name}</TableCell>
                        <TableCell>{level.description || "-"}</TableCell>
                        <TableCell>{level.sort_order}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteLevelMutation.mutate(level.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">אין רמות לימוד במערכת עדיין</p>
                  <p className="text-sm text-muted-foreground">לחץ על "הוסף רמה" כדי להתחיל</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Seasons Tab */}
        <TabsContent value="seasons" className="mt-6">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-primary" />
                עונות פעילות
              </CardTitle>
              <Dialog open={isSeasonDialogOpen} onOpenChange={setIsSeasonDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary gap-2">
                    <Plus className="h-4 w-4" />
                    הוסף עונה
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>הוספת עונה חדשה</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSeasonSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="season-name">שם העונה *</Label>
                      <Input
                        id="season-name"
                        placeholder='לדוגמה: "חורף 2026"'
                        value={seasonForm.name}
                        onChange={(e) => setSeasonForm({ ...seasonForm, name: e.target.value })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>תאריך התחלה *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-right font-normal",
                                !seasonForm.start_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {seasonForm.start_date
                                ? format(seasonForm.start_date, "dd/MM/yyyy", { locale: he })
                                : "בחר תאריך"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={seasonForm.start_date}
                              onSelect={(date) => setSeasonForm({ ...seasonForm, start_date: date })}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <Label>תאריך סיום *</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-right font-normal",
                                !seasonForm.end_date && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="ml-2 h-4 w-4" />
                              {seasonForm.end_date
                                ? format(seasonForm.end_date, "dd/MM/yyyy", { locale: he })
                                : "בחר תאריך"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={seasonForm.end_date}
                              onSelect={(date) => setSeasonForm({ ...seasonForm, end_date: date })}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Switch
                        id="season-active"
                        checked={seasonForm.active}
                        onCheckedChange={(checked) => setSeasonForm({ ...seasonForm, active: checked })}
                      />
                      <Label htmlFor="season-active">עונה פעילה</Label>
                    </div>
                    <div className="flex gap-2 pt-4">
                      <Button type="submit" className="flex-1 gradient-primary" disabled={createSeasonMutation.isPending}>
                        {createSeasonMutation.isPending ? "מוסיף..." : "הוסף"}
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsSeasonDialogOpen(false)}>
                        ביטול
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              {seasonsLoading ? (
                <div className="text-center py-8 text-muted-foreground">טוען...</div>
              ) : seasons && seasons.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם העונה</TableHead>
                      <TableHead className="text-right">תאריך התחלה</TableHead>
                      <TableHead className="text-right">תאריך סיום</TableHead>
                      <TableHead className="text-right">סטטוס</TableHead>
                      <TableHead className="text-right">פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasons.map((season) => (
                      <TableRow key={season.id}>
                        <TableCell className="font-medium">{season.name}</TableCell>
                        <TableCell>{format(new Date(season.start_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>{format(new Date(season.end_date), "dd/MM/yyyy")}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
                              season.active
                                ? "bg-success/10 text-success"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {season.active ? "פעילה" : "לא פעילה"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => deleteSeasonMutation.mutate(season.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12">
                  <CalendarDays className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                  <p className="text-muted-foreground">אין עונות פעילות במערכת עדיין</p>
                  <p className="text-sm text-muted-foreground">לחץ על "הוסף עונה" כדי להתחיל</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
