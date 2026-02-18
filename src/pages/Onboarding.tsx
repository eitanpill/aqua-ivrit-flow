import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { 
  Building2, 
  MapPin, 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight,
  Waves,
  Sparkles,
  CheckCircle2,
  Loader2
} from "lucide-react";
import confetti from "canvas-confetti";

interface OnboardingData {
  schoolName: string;
  location: {
    name: string;
    address: string;
    phone: string;
  };
  season: {
    name: string;
    startDate: string;
    endDate: string;
  };
}

const STEPS = [
  { id: 1, title: "שם בית הספר", icon: Building2 },
  { id: 2, title: "הבריכה הראשונה", icon: MapPin },
  { id: 3, title: "העונה הנוכחית", icon: CalendarDays },
  { id: 4, title: "סיום", icon: Sparkles },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAdmin, loading: authLoading } = useAuth();
  const { activeSchoolId } = useSchool();
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<OnboardingData>({
    schoolName: "",
    location: { name: "", address: "", phone: "" },
    season: { 
      name: "", 
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    },
  });

  // Check if onboarding is needed (no locations exist)
  const { data: hasLocations, isLoading: locationsLoading } = useQuery({
    queryKey: ["onboarding-locations-check"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("locations")
        .select("*", { count: "exact", head: true });
      if (error) throw error;
      return (count || 0) > 0;
    },
    staleTime: 0, // Always check fresh
  });

  // Redirect if not admin or if already has locations
  useEffect(() => {
    if (authLoading || locationsLoading) return;
    
    // If not admin, redirect to dashboard
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
      return;
    }
    
    // If already has locations, skip onboarding
    if (hasLocations === true) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, hasLocations, authLoading, locationsLoading, navigate]);

  // Show loading while checking
  if (authLoading || locationsLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Don't render if redirecting
  if (!isAdmin || hasLocations === true) {
    return null;
  }

  const progress = ((currentStep - 1) / (STEPS.length - 1)) * 100;

  const createLocationMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("locations").insert([{
        name: data.location.name || data.schoolName,
        address: data.location.address || null,
        phone: data.location.phone || null,
        school_id: activeSchoolId,
      }]);
      if (error) throw error;
    },
  });

  const createSeasonMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("seasons").insert([{
        name: data.season.name,
        start_date: data.season.startDate,
        end_date: data.season.endDate,
        active: true,
        school_id: activeSchoolId,
      }]);
      if (error) throw error;
    },
  });

  const handleNext = async () => {
    if (currentStep === 1 && !data.schoolName.trim()) {
      toast({ title: "שגיאה", description: "נא להזין שם בית ספר", variant: "destructive" });
      return;
    }
    if (currentStep === 2 && !data.location.name.trim()) {
      toast({ title: "שגיאה", description: "נא להזין שם בריכה", variant: "destructive" });
      return;
    }
    if (currentStep === 3 && !data.season.name.trim()) {
      toast({ title: "שגיאה", description: "נא להזין שם עונה", variant: "destructive" });
      return;
    }

    if (currentStep === 3) {
      // Create location and season
      try {
        await createLocationMutation.mutateAsync();
        await createSeasonMutation.mutateAsync();
        
        // Invalidate queries
        queryClient.invalidateQueries({ queryKey: ["locations"] });
        queryClient.invalidateQueries({ queryKey: ["seasons"] });
        queryClient.invalidateQueries({ queryKey: ["onboarding-check-locations"] });

        setCurrentStep(4);
        
        // Trigger confetti
        setTimeout(() => {
          confetti({
            particleCount: 100,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#0ea5e9', '#14b8a6', '#22c55e']
          });
        }, 300);
      } catch (error: any) {
        toast({ 
          title: "שגיאה", 
          description: error.message || "אירעה שגיאה בשמירת הנתונים", 
          variant: "destructive" 
        });
        return;
      }
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleFinish = () => {
    navigate("/dashboard", { replace: true });
    toast({ title: "ברוכים הבאים!", description: "ההגדרות נשמרו בהצלחה" });
  };

  const isPending = createLocationMutation.isPending || createSeasonMutation.isPending;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center">
              <Waves className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-gradient-primary">AquaFlow</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">ברוכים הבאים!</h1>
          <p className="text-muted-foreground">בואו נגדיר את המערכת שלכם בכמה צעדים פשוטים</p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <Progress value={progress} className="h-2 mb-4" />
          <div className="flex justify-between">
            {STEPS.map((step) => (
              <div
                key={step.id}
                className={`flex flex-col items-center gap-1 ${
                  step.id <= currentStep ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`h-10 w-10 rounded-full flex items-center justify-center transition-all ${
                    step.id < currentStep
                      ? "gradient-primary text-primary-foreground"
                      : step.id === currentStep
                      ? "border-2 border-primary bg-primary/10"
                      : "border-2 border-muted bg-muted"
                  }`}
                >
                  {step.id < currentStep ? (
                    <CheckCircle2 className="h-5 w-5" />
                  ) : (
                    <step.icon className="h-5 w-5" />
                  )}
                </div>
                <span className="text-xs font-medium hidden sm:block">{step.title}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Step Content */}
        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {currentStep === 1 && "איך קוראים לבית הספר?"}
              {currentStep === 2 && "בוא נקים את הבריכה הראשונה"}
              {currentStep === 3 && "מהי העונה הנוכחית?"}
              {currentStep === 4 && "🎉 מעולה! הכל מוכן"}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {/* Step 1: School Name */}
            {currentStep === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="schoolName">שם בית הספר לשחייה</Label>
                  <Input
                    id="schoolName"
                    placeholder='לדוגמה: "בית הספר לשחייה אקווה"'
                    value={data.schoolName}
                    onChange={(e) => setData({ ...data, schoolName: e.target.value })}
                    className="text-lg"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  שם זה ישמש לזיהוי בית הספר שלכם במערכת
                </p>
              </div>
            )}

            {/* Step 2: Location */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="locationName">שם הבריכה *</Label>
                  <Input
                    id="locationName"
                    placeholder={data.schoolName || "בריכה מרכזית"}
                    value={data.location.name}
                    onChange={(e) =>
                      setData({ ...data, location: { ...data.location, name: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationAddress">כתובת</Label>
                  <Input
                    id="locationAddress"
                    placeholder="רחוב הרצל 1, תל אביב"
                    value={data.location.address}
                    onChange={(e) =>
                      setData({ ...data, location: { ...data.location, address: e.target.value } })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="locationPhone">טלפון</Label>
                  <Input
                    id="locationPhone"
                    placeholder="03-1234567"
                    value={data.location.phone}
                    onChange={(e) =>
                      setData({ ...data, location: { ...data.location, phone: e.target.value } })
                    }
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {/* Step 3: Season */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="seasonName">שם העונה *</Label>
                  <Input
                    id="seasonName"
                    placeholder='לדוגמה: "חורף 2026"'
                    value={data.season.name}
                    onChange={(e) =>
                      setData({ ...data, season: { ...data.season, name: e.target.value } })
                    }
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">תאריך התחלה</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={data.season.startDate}
                      onChange={(e) =>
                        setData({ ...data, season: { ...data.season, startDate: e.target.value } })
                      }
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">תאריך סיום</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={data.season.endDate}
                      onChange={(e) =>
                        setData({ ...data, season: { ...data.season, endDate: e.target.value } })
                      }
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: Complete */}
            {currentStep === 4 && (
              <div className="text-center py-6">
                <div className="h-20 w-20 rounded-full gradient-primary flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="h-10 w-10 text-primary-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">המערכת מוכנה!</h3>
                <p className="text-muted-foreground mb-6">
                  יצרנו את הבריכה הראשונה ואת העונה הנוכחית. 
                  <br />
                  עכשיו אפשר להתחיל להוסיף שיעורים ושחיינים.
                </p>
                <div className="flex flex-col gap-2 text-sm text-right bg-muted/50 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>בריכה: {data.location.name || data.schoolName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span>עונה: {data.season.name}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-8">
              {currentStep < 4 ? (
                <>
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    disabled={currentStep === 1 || isPending}
                    className="gap-2"
                  >
                    <ChevronRight className="h-4 w-4" />
                    הקודם
                  </Button>
                  <Button
                    onClick={handleNext}
                    disabled={isPending}
                    className="flex-1 gradient-primary gap-2"
                  >
                    {isPending ? "שומר..." : currentStep === 3 ? "סיום" : "הבא"}
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                </>
              ) : (
                <Button onClick={handleFinish} className="w-full gradient-primary gap-2">
                  <Sparkles className="h-4 w-4" />
                  למעבר לדשבורד
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
