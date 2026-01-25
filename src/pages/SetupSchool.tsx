import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Waves, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export default function SetupSchool() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user, loading: authLoading } = useAuth();
  
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    schoolName: "",
    firstName: "",
    lastName: "",
  });

  // Check if user already has a school
  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth", { replace: true });
      return;
    }

    const checkSchool = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("school_id, first_name, last_name")
        .eq("id", user.id)
        .single();
      
      if (data?.school_id) {
        // User already has a school, redirect to dashboard
        navigate("/dashboard", { replace: true });
      } else if (data) {
        // Pre-fill name if available
        setFormData(prev => ({
          ...prev,
          firstName: data.first_name || "",
          lastName: data.last_name || "",
        }));
      }
    };
    
    checkSchool();
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.schoolName.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם בית ספר",
        variant: "destructive",
      });
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      toast({
        title: "שגיאה",
        description: "יש להזין שם מלא",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      const { data: schoolId, error } = await supabase.rpc("create_school_and_owner", {
        p_school_name: formData.schoolName,
        p_owner_first_name: formData.firstName,
        p_owner_last_name: formData.lastName,
      });

      if (error) {
        throw error;
      }

      if (!schoolId) {
        throw new Error("שגיאה ביצירת בית הספר");
      }

      // Invalidate queries to refresh user data
      await queryClient.invalidateQueries({ queryKey: ["user-profile-school-check"] });
      await queryClient.invalidateQueries({ queryKey: ["school"] });

      toast({
        title: "בית הספר נוצר בהצלחה! 🎉",
        description: `ברוכים הבאים ל-${formData.schoolName}`,
      });

      // Navigate to dashboard
      navigate("/dashboard", { replace: true });
    } catch (error: any) {
      console.error("Error creating school:", error);
      toast({
        title: "שגיאה ביצירת בית הספר",
        description: error.message || "נסה שוב מאוחר יותר",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
            <Waves className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">הקמת בית ספר חדש</CardTitle>
            <CardDescription>מלא את הפרטים כדי להשלים את ההרשמה</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schoolName">שם בית הספר לשחייה *</Label>
              <div className="relative">
                <Building2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="schoolName"
                  placeholder='לדוגמה: "בית הספר לשחייה אקווה"'
                  className="pr-10"
                  value={formData.schoolName}
                  onChange={(e) => setFormData({ ...formData, schoolName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">שם פרטי *</Label>
                <Input
                  id="firstName"
                  placeholder="ישראל"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">שם משפחה *</Label>
                <Input
                  id="lastName"
                  placeholder="ישראלי"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  יוצר בית ספר...
                </>
              ) : (
                "צור בית ספר והמשך"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
