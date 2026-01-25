import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Waves, Building2, Eye, Loader2, ArrowLeft, Sparkles } from "lucide-react";

export default function Welcome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [schoolName, setSchoolName] = useState("");

  // Check if user already has a school
  const { data: profile, isLoading } = useQuery({
    queryKey: ["user-profile-welcome", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("school_id, first_name, last_name")
        .eq("id", user.id)
        .single();
      
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Redirect to dashboard if user already has a school
  if (!isLoading && profile?.school_id) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  // Redirect to auth if not logged in
  if (!isLoading && !user) {
    navigate("/auth", { replace: true });
    return null;
  }

  const handleDemoMode = () => {
    // Navigate to dashboard with demo query param
    navigate("/dashboard?demo=true");
  };

  const handleCreateSchool = async () => {
    if (!schoolName.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם לבית הספר",
        variant: "destructive",
      });
      return;
    }

    setIsCreatingSchool(true);

    try {
      const { data: schoolId, error } = await supabase.rpc("create_school_and_owner", {
        p_school_name: schoolName.trim(),
        p_owner_first_name: profile?.first_name || "משתמש",
        p_owner_last_name: profile?.last_name || "חדש",
      });

      if (error || !schoolId) {
        console.error("School creation error:", error);
        toast({
          title: "שגיאה ביצירת בית הספר",
          description: error?.message || "נסה שוב מאוחר יותר",
          variant: "destructive",
        });
        return;
      }

      // Invalidate queries to refresh profile
      await queryClient.invalidateQueries({ queryKey: ["user-profile"] });
      await queryClient.invalidateQueries({ queryKey: ["user-profile-welcome"] });
      await queryClient.invalidateQueries({ queryKey: ["user-profile-school-check"] });

      toast({
        title: "נוצר בהצלחה! 🎉",
        description: `בית הספר "${schoolName}" מוכן לעבודה`,
      });

      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error("Create school error:", error);
      toast({
        title: "שגיאה",
        description: error.message || "אירעה שגיאה ביצירת בית הספר",
        variant: "destructive",
      });
    } finally {
      setIsCreatingSchool(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Waves className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">טוען...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      {/* Background Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
      </div>

      <div className="w-full max-w-2xl relative z-10 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary aqua-glow">
            <Waves className="h-10 w-10 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">ברוכים הבאים ל-AquaFlow! 🎉</h1>
            <p className="text-muted-foreground mt-2 text-lg">
              איך תרצו להתחיל?
            </p>
          </div>
        </div>

        {/* Action Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Option A: View Demo */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-xl hover:border-amber-500/50 border-2 border-dashed group"
            onClick={handleDemoMode}
          >
            <CardContent className="p-6 flex flex-col items-center text-center h-full">
              <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Eye className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-xl mb-2">סיור במערכת הדגמה</CardTitle>
              <CardDescription className="text-base">
                רוצה לראות איך זה עובד? כניסה למערכת מלאה בנתונים לדוגמה ללא התחייבות.
              </CardDescription>
              <div className="mt-auto pt-4">
                <span className="inline-flex items-center gap-2 text-amber-600 font-medium text-sm">
                  כניסה חופשית
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Option B: Create School */}
          <Card 
            className="cursor-pointer transition-all hover:shadow-xl hover:border-primary/50 border-2 group bg-gradient-to-br from-primary/5 to-transparent"
            onClick={() => setShowCreateModal(true)}
          >
            <CardContent className="p-6 flex flex-col items-center text-center h-full">
              <div className="h-16 w-16 rounded-2xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform relative">
                <Building2 className="h-8 w-8 text-primary-foreground" />
                <Sparkles className="h-5 w-5 text-yellow-400 absolute -top-1 -right-1" />
              </div>
              <CardTitle className="text-xl mb-2">הקמת בית ספר חדש</CardTitle>
              <CardDescription className="text-base">
                מוכן לצאת לדרך? הקמת סביבה חדשה ונקייה לניהול העסק שלך.
              </CardDescription>
              <div className="mt-auto pt-4">
                <span className="inline-flex items-center gap-2 text-primary font-medium text-sm">
                  בואו נתחיל
                  <ArrowLeft className="h-4 w-4" />
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Logout Link */}
        <div className="text-center">
          <button 
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate("/auth");
            }}
          >
            התנתק וחזור לדף הכניסה
          </button>
        </div>
      </div>

      {/* Create School Modal */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-xl gradient-primary mb-2">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <DialogTitle className="text-xl text-center">הקמת בית ספר חדש</DialogTitle>
            <DialogDescription className="text-center">
              בחר שם לבית הספר שלך. תוכל לשנות אותו מאוחר יותר.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="school-name">שם בית הספר *</Label>
              <Input
                id="school-name"
                placeholder="לדוגמה: בית ספר לשחייה - תל אביב"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateSchool();
                  }
                }}
                autoFocus
              />
            </div>

            <Button 
              className="w-full" 
              onClick={handleCreateSchool}
              disabled={isCreatingSchool || !schoolName.trim()}
            >
              {isCreatingSchool ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  יוצר בית ספר...
                </>
              ) : (
                "צור בית ספר והמשך"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
