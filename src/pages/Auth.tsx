import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Waves, Mail, Lock, User, Building2, AlertCircle, Play, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DEMO_CREDENTIALS } from "@/hooks/useDemoMode";

const loginSchema = z.object({
  email: z.string().email("כתובת אימייל לא תקינה"),
  password: z.string().min(6, "הסיסמה חייבת להכיל לפחות 6 תווים"),
});

const signupSchema = loginSchema.extend({
  firstName: z.string().min(2, "שם פרטי חייב להכיל לפחות 2 תווים"),
  lastName: z.string().min(2, "שם משפחה חייב להכיל לפחות 2 תווים"),
});

const schoolOwnerSchema = signupSchema.extend({
  schoolName: z.string().min(2, "שם בית הספר חייב להכיל לפחות 2 תווים"),
});

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
}

type AuthView = 'landing' | 'login' | 'signup' | 'create-school';

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const inviteSlug = searchParams.get("invite");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoLoading, setIsDemoLoading] = useState(false);
  const [invitedSchool, setInvitedSchool] = useState<SchoolInfo | null>(null);
  const [isLoadingSchool, setIsLoadingSchool] = useState(!!inviteSlug);
  const [schoolNotFound, setSchoolNotFound] = useState(false);
  const [authView, setAuthView] = useState<AuthView>(inviteSlug ? 'signup' : 'landing');
  
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({ 
    email: "", 
    password: "", 
    firstName: "", 
    lastName: "",
    schoolName: ""
  });

  // Fetch invited school info
  useEffect(() => {
    if (inviteSlug) {
      const fetchSchool = async () => {
        setIsLoadingSchool(true);
        const { data, error } = await supabase.rpc('get_school_by_slug', { 
          p_slug: inviteSlug 
        });
        
        if (error || !data || typeof data !== 'object' || !('id' in data)) {
          setSchoolNotFound(true);
        } else {
          setInvitedSchool(data as unknown as SchoolInfo);
          setAuthView('signup');
        }
        setIsLoadingSchool(false);
      };
      fetchSchool();
    }
  }, [inviteSlug]);

  // Track if we're in the middle of signup to prevent redirect
  const [isSigningUp, setIsSigningUp] = useState(false);

  useEffect(() => {
    // Don't set up redirect listener if we're in the process of creating a school
    if (isSigningUp) return;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session && !isSigningUp) {
        // Check if user has a school before redirecting
        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", session.user.id)
          .single();
        
        if (profile?.school_id) {
          navigate("/dashboard");
        } else {
          // User exists but has no school - they should be on create-school view
          // Don't redirect, let ProtectedRoute handle it
        }
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session && !isSigningUp) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("school_id")
          .eq("id", session.user.id)
          .single();
        
        if (profile?.school_id) {
          navigate("/dashboard");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, isSigningUp]);

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    
    const { error } = await supabase.auth.signInWithPassword({
      email: DEMO_CREDENTIALS.email,
      password: DEMO_CREDENTIALS.password,
    });

    if (error) {
      toast({
        title: "שגיאה בכניסה למצב הדגמה",
        description: "לא ניתן להתחבר למערכת ההדגמה כעת. נסה שוב מאוחר יותר.",
        variant: "destructive",
      });
    }
    setIsDemoLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const result = loginSchema.safeParse(loginForm);
    if (!result.success) {
      toast({
        title: "שגיאה",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginForm.email,
      password: loginForm.password,
    });

    if (error) {
      toast({
        title: "שגיאת כניסה",
        description: error.message === "Invalid login credentials" 
          ? "אימייל או סיסמה שגויים" 
          : error.message,
        variant: "destructive",
      });
    } else {
      // Login successful - navigate will happen via auth state change
      navigate("/dashboard");
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // For create-school flow, we only need basic signup - school creation happens on Welcome page
    const schema = signupSchema;
    const result = schema.safeParse(signupForm);
    
    if (!result.success) {
      toast({
        title: "שגיאה",
        description: result.error.errors[0].message,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setIsSigningUp(true); // Prevent automatic redirect during signup

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/welcome`,
          data: {
            first_name: signupForm.firstName,
            last_name: signupForm.lastName,
          },
        },
      });

      if (authError) {
        toast({
          title: "שגיאת הרשמה",
          description: authError.message === "User already registered"
            ? "משתמש עם אימייל זה כבר קיים במערכת"
            : authError.message,
          variant: "destructive",
        });
        setIsLoading(false);
        setIsSigningUp(false);
        return;
      }

      if (!authData.user) {
        toast({
          title: "שגיאה",
          description: "אירעה שגיאה ביצירת המשתמש",
          variant: "destructive",
        });
        setIsLoading(false);
        setIsSigningUp(false);
        return;
      }

      // Wait a moment for session to be established
      await new Promise(resolve => setTimeout(resolve, 500));

      // If joining via invite link, handle that flow
      if (inviteSlug) {
        const { data: joinResult, error: joinError } = await supabase.rpc(
          'join_school_by_slug',
          {
            p_user_id: authData.user!.id,
            p_school_slug: inviteSlug,
          }
        );

        if (joinError || !(joinResult as any)?.success) {
          console.error('Join school error:', joinError || joinResult);
          toast({
            title: "שגיאה בהצטרפות לבית הספר",
            description: (joinResult as any)?.error || joinError?.message || "נסה שוב",
            variant: "destructive",
          });
        } else {
          toast({
            title: "נרשמת בהצלחה!",
            description: `הצטרפת לבית הספר "${(joinResult as any).school_name}"`,
          });
          navigate("/dashboard", { replace: true });
          return;
        }
      }

      // For regular signup (create-school flow), redirect to Welcome page
      toast({
        title: "נרשמת בהצלחה! 🎉",
        description: "בואו נגדיר את החשבון שלך",
      });
      navigate("/welcome", { replace: true });
      
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "שגיאה",
        description: error.message || "אירעה שגיאה בתהליך ההרשמה",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      setIsSigningUp(false);
    }
  };

  if (isLoadingSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Waves className="h-12 w-12 text-primary mx-auto animate-pulse" />
          <p className="mt-4 text-muted-foreground">מאמת קישור הזמנה...</p>
        </div>
      </div>
    );
  }

  if (schoolNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <CardTitle className="text-xl mt-4">קישור הזמנה לא תקין</CardTitle>
            <CardDescription>
              בית הספר לא נמצא. ייתכן שהקישור פג תוקף או שהכתובת שגויה.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              className="w-full" 
              onClick={() => {
                setSchoolNotFound(false);
                setAuthView('landing');
                navigate("/auth");
              }}
            >
              חזרה לדף הראשי
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Landing Page with Split View
  if (authView === 'landing') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
          <div className="absolute -top-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-float" />
          <div className="absolute -bottom-40 -right-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl animate-float" style={{ animationDelay: "1.5s" }} />
        </div>

        <div className="w-full max-w-lg relative z-10 space-y-6">
          {/* Logo & Title */}
          <div className="text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl gradient-primary aqua-glow">
              <Waves className="h-10 w-10 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AquaFlow</h1>
              <p className="text-muted-foreground mt-1">מערכת ניהול בית ספר לשחייה</p>
            </div>
          </div>

          {/* Action Cards */}
          <div className="space-y-4">
            {/* Primary - Create School */}
            <Card 
              className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 border-2"
              onClick={() => setAuthView('create-school')}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl gradient-primary flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-primary-foreground" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">אני רוצה להקים בית ספר</h3>
                    <p className="text-sm text-muted-foreground">צור בית ספר לשחייה משלך ונהל אותו</p>
                  </div>
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>

            {/* Secondary - Demo Mode */}
            <Card 
              className="cursor-pointer transition-all hover:shadow-lg hover:border-amber-500/50 border-2 border-dashed"
              onClick={handleDemoLogin}
            >
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shrink-0">
                    <Play className="h-7 w-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">סיור במערכת הדגמה</h3>
                    <p className="text-sm text-muted-foreground">היכנס לגרסת דמו עם נתונים לדוגמה</p>
                  </div>
                  {isDemoLoading ? (
                    <div className="h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Existing User Link */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              כבר יש לך חשבון?{" "}
              <button 
                className="text-primary hover:underline font-medium"
                onClick={() => setAuthView('login')}
              >
                התחבר
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Login View
  if (authView === 'login') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        </div>

        <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
              <Waves className="h-8 w-8 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold">התחברות</CardTitle>
              <CardDescription>הזן את פרטי החשבון שלך</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">אימייל</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pr-10"
                    value={loginForm.email}
                    onChange={(e) => setLoginForm({ ...loginForm, email: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">סיסמה</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pr-10"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    dir="ltr"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={isLoading}>
                {isLoading ? "מתחבר..." : "התחבר"}
              </Button>
            </form>
            
            <div className="mt-4 space-y-2 text-center">
              <button 
                className="text-sm text-primary hover:underline font-medium block w-full"
                onClick={async () => {
                  if (!loginForm.email) {
                    toast({
                      title: "שגיאה",
                      description: "יש להזין כתובת אימייל",
                      variant: "destructive",
                    });
                    return;
                  }
                  setIsLoading(true);
                  const { error } = await supabase.auth.resetPasswordForEmail(loginForm.email, {
                    redirectTo: `${window.location.origin}/auth`,
                  });
                  setIsLoading(false);
                  if (error) {
                    toast({
                      title: "שגיאה",
                      description: error.message,
                      variant: "destructive",
                    });
                  } else {
                    toast({
                      title: "נשלח בהצלחה",
                      description: "מייל לשחזור סיסמה נשלח לכתובת שהזנת",
                    });
                  }
                }}
                disabled={isLoading}
              >
                שכחתי סיסמה
              </button>
              <button 
                className="text-sm text-muted-foreground hover:text-primary"
                onClick={() => setAuthView('landing')}
              >
                ← חזרה לדף הראשי
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Create School / Signup View
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      </div>

      <Card className="w-full max-w-md relative z-10 shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary aqua-glow">
            <Waves className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">
              {invitedSchool ? "הצטרפות לבית ספר" : "הרשמה ל-AquaFlow"}
            </CardTitle>
            {invitedSchool ? (
              <CardDescription>
                הצטרפות לבית הספר: <span className="font-semibold text-foreground">{invitedSchool.name}</span>
              </CardDescription>
            ) : (
              <CardDescription>צור חשבון והתחל לנהל את בית הספר שלך</CardDescription>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="signup-firstname">שם פרטי</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-firstname"
                    type="text"
                    placeholder="ישראל"
                    className="pr-10"
                    value={signupForm.firstName}
                    onChange={(e) => setSignupForm({ ...signupForm, firstName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-lastname">שם משפחה</Label>
                <Input
                  id="signup-lastname"
                  type="text"
                  placeholder="ישראלי"
                  value={signupForm.lastName}
                  onChange={(e) => setSignupForm({ ...signupForm, lastName: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-email">אימייל</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-email"
                  type="email"
                  placeholder="your@email.com"
                  className="pr-10"
                  value={signupForm.email}
                  onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="signup-password">סיסמה</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="signup-password"
                  type="password"
                  placeholder="••••••••"
                  className="pr-10"
                  value={signupForm.password}
                  onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full gradient-primary" 
              disabled={isLoading}
            >
              {isLoading ? "נרשם..." : invitedSchool ? "הצטרף לבית הספר" : "הירשם והמשך"}
            </Button>
          </form>
          
          <div className="mt-4 text-center space-y-2">
            <button 
              className="text-sm text-muted-foreground hover:text-primary"
              onClick={() => setAuthView('landing')}
            >
              ← חזרה לדף הראשי
            </button>
            <p className="text-sm text-muted-foreground">
              כבר יש לך חשבון?{" "}
              <button 
                className="text-primary hover:underline font-medium"
                onClick={() => setAuthView('login')}
              >
                התחבר
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
